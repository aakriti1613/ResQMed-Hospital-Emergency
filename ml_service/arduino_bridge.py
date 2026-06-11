"""
ml_service/arduino_bridge.py
────────────────────────────
Reads sensor data from the Arduino helmet via USB serial,
sends it to the ML service, and triggers Firebase SOS if accident detected.

Usage:
  python arduino_bridge.py --port /dev/cu.usbmodem14101 --firebase-url https://your-app.web.app
"""

import argparse
import collections
import json
import time
import sys
import requests

ML_SERVICE_URL = "http://localhost:8001"
WINDOW_SIZE    = 50
SOS_COOLDOWN   = 30   # seconds between SOS triggers (prevent double-firing)

_buffer: collections.deque = collections.deque(maxlen=WINDOW_SIZE)
_last_sos_time = 0.0


def parse_arduino_line(line: str) -> list[float] | None:
    """
    Expects Arduino to output CSV: acc_x,acc_y,acc_z,gyr_x,gyr_y,gyr_z
    Example: 0.12,-9.78,0.45,2.1,-0.3,0.8
    Returns None if the line is not parseable (startup messages etc.)
    """
    try:
        parts = [float(v.strip()) for v in line.split(",")]
        if len(parts) == 6:
            return parts
    except ValueError:
        pass
    return None


def trigger_sos(lat: float, lon: float, severity: str, confidence: float, peak_g: float = 2.0):
    """Open the Aarogya Raksha SOS page via a direct Firebase write."""
    global _last_sos_time
    now = time.time()

    if now - _last_sos_time < SOS_COOLDOWN:
        print(f"[BRIDGE] ⏸  SOS suppressed — cooldown active ({SOS_COOLDOWN}s)")
        return

    _last_sos_time = now
    print(f"\n{'='*60}")
    print(f"🚨 ACCIDENT DETECTED by ML Model!")
    print(f"   Severity:   {severity.upper()}")
    print(f"   Confidence: {confidence:.1%}")
    print(f"   Location:   lat={lat}, lon={lon}")
    url_params = f"crash=1&lat={lat}&lon={lon}&severity={severity}&gforce={peak_g:.2f}"
    print(f"   SOS URL: /#/app/sos?{url_params}")
    print(f"{'='*60}\n")

    # Option A: Print the SOS URL (open manually in browser for demo)
    print(f"👉 Open this in your browser to trigger SOS:")
    print(f"   http://localhost:5173/#/app/sos?{url_params}\n")


def run_bridge(port: str, baud: int, lat: float, lon: float):
    """Main loop: read Arduino → buffer → predict → maybe trigger SOS."""
    try:
        import serial
    except ImportError:
        print("❌ pyserial not installed. Run: pip install pyserial")
        sys.exit(1)

    print(f"[BRIDGE] 🟢 Connecting to Arduino on {port} at {baud} baud...")

    try:
        ser = serial.Serial(port, baud, timeout=2)
        print(f"[BRIDGE] ✅ Connected!\n")
    except Exception as e:
        print(f"[BRIDGE] ❌ Cannot open serial port: {e}")
        sys.exit(1)

    time.sleep(2)   # wait for Arduino to reset after serial connect

    print("[BRIDGE] Listening for sensor data (CSV format: acc_x,acc_y,acc_z,gyr_x,gyr_y,gyr_z)...")
    print("[BRIDGE] Press Ctrl+C to stop.\n")

    while True:
        try:
            raw = ser.readline().decode("utf-8", errors="ignore").strip()
            if not raw:
                continue

            reading = parse_arduino_line(raw)
            if reading is None:
                print(f"[BRIDGE] (skipped) {raw}")
                continue

            _buffer.append(reading)
            print(f"[BRIDGE] 📡 Reading #{len(_buffer):>3}/50 | "
                  f"Acc: ({reading[0]:+.2f}, {reading[1]:+.2f}, {reading[2]:+.2f}) | "
                  f"Gyr: ({reading[3]:+.2f}, {reading[4]:+.2f}, {reading[5]:+.2f})")

            # Call ML service once buffer is full
            if len(_buffer) == WINDOW_SIZE:
                try:
                    resp = requests.post(
                        f"{ML_SERVICE_URL}/predict",
                        json={"readings": list(_buffer)},
                        timeout=5,
                    )
                    result = resp.json()
                    prediction = result.get("prediction", "normal")
                    confidence = result.get("confidence", 0.0)
                    severity   = result.get("severity", "low")
                    trigger    = result.get("trigger_sos", False)
                    mode       = result.get("mode", "demo")
                    debug      = result.get("debug", {})
                    peak_g     = debug.get("peak_acc_g", 2.0)

                    status_icon = "🚨" if trigger else "✅"
                    print(f"\n[ML]  {status_icon} Prediction: {prediction.upper()} "
                          f"| Confidence: {confidence:.1%} "
                          f"| Severity: {severity} "
                          f"| Mode: {mode}\n")

                    if trigger:
                        trigger_sos(lat, lon, severity, confidence, peak_g)

                    # Slide window by 25 (50% overlap for continuous monitoring)
                    for _ in range(25):
                        if _buffer:
                            _buffer.popleft()

                except requests.exceptions.ConnectionError:
                    print("[BRIDGE] ❌ ML service not reachable — is it running? "
                          "(uvicorn ml_service.main:app --port 8001)")
                except Exception as e:
                    print(f"[BRIDGE] ❌ Prediction error: {e}")

        except KeyboardInterrupt:
            print("\n[BRIDGE] 🛑 Stopped.")
            ser.close()
            break
        except Exception as e:
            print(f"[BRIDGE] Error reading serial: {e}")
            time.sleep(0.5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aarogya Raksha Arduino Bridge")
    parser.add_argument("--port",  default="/dev/cu.usbmodem14101",
                        help="Arduino serial port (e.g. /dev/cu.usbmodem14101 on Mac, COM3 on Windows)")
    parser.add_argument("--baud",  type=int, default=9600)
    parser.add_argument("--lat",   type=float, default=28.6139, help="Your GPS latitude")
    parser.add_argument("--lon",   type=float, default=77.2090, help="Your GPS longitude")
    args = parser.parse_args()

    run_bridge(args.port, args.baud, args.lat, args.lon)
