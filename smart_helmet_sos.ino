/**
 * smart_helmet_sos.ino
 * ─────────────────────────────────────────────────────────────────────────────
 * Aarogya Raksha — Smart Helmet Sensor
 *
 * NEW: Outputs sensor data as CSV every 20ms (50 Hz) so the ML bridge
 *      (ml_service/arduino_bridge.py) can buffer 50 readings and run
 *      the LSTM accident detection model.
 *
 * CSV format (one line per reading):
 *   acc_x,acc_y,acc_z,gyr_x,gyr_y,gyr_z
 *
 * Hardware:
 *   - GPS module on pins 3 (RX) and 4 (TX)
 *   - MPU6050 accelerometer/gyroscope on I2C (A4=SDA, A5=SCL)
 *     (if not available, uses simulated values for demo)
 *
 * IMPORTANT: The ML model now decides accident vs normal — no threshold here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

#include <TinyGPS++.h>
#include <SoftwareSerial.h>

// ── GPS Setup ──────────────────────────────────────────────────────────────
TinyGPSPlus gps;
SoftwareSerial gpsSerial(4, 3);   // TX=4, RX=3

// ── Try to use real MPU6050 if available ──────────────────────────────────
// Uncomment the line below if you have an MPU6050 wired to I2C:
// #define USE_MPU6050

#ifdef USE_MPU6050
  #include <Wire.h>
  const int MPU_ADDR = 0x68;
  int16_t rawAx, rawAy, rawAz, rawGx, rawGy, rawGz;

  void initMPU() {
    Wire.begin();
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x6B);   // PWR_MGMT_1
    Wire.write(0);      // Wake up
    Wire.endTransmission(true);
  }

  void readMPU(float &ax, float &ay, float &az,
               float &gx, float &gy, float &gz) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);   // Start at ACCEL_XOUT_H
    Wire.endTransmission(false);
    Wire.requestFrom(MPU_ADDR, 14, true);

    rawAx = Wire.read() << 8 | Wire.read();
    rawAy = Wire.read() << 8 | Wire.read();
    rawAz = Wire.read() << 8 | Wire.read();
    Wire.read(); Wire.read();   // skip temp
    rawGx = Wire.read() << 8 | Wire.read();
    rawGy = Wire.read() << 8 | Wire.read();
    rawGz = Wire.read() << 8 | Wire.read();

    // Convert to G and deg/sec (default ±2G, ±250°/s sensitivity)
    ax = rawAx / 16384.0;
    ay = rawAy / 16384.0;
    az = rawAz / 16384.0;
    gx = rawGx / 131.0;
    gy = rawGy / 131.0;
    gz = rawGz / 131.0;
  }
#endif

// ── State ─────────────────────────────────────────────────────────────────
unsigned long lastPrint = 0;
float lastLat = 0.0, lastLon = 0.0;

void setup() {
  Serial.begin(9600);
  gpsSerial.begin(9600);

  #ifdef USE_MPU6050
    initMPU();
    Serial.println("# MPU6050 initialized");
  #else
    Serial.println("# Demo mode — simulated sensor values");
  #endif

  Serial.println("# Format: acc_x,acc_y,acc_z,gyr_x,gyr_y,gyr_z");
  Serial.println("# Ready.");
  delay(1000);
}

void loop() {
  // ── Read GPS ─────────────────────────────────────────────────────────────
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
  if (gps.location.isUpdated()) {
    lastLat = gps.location.lat();
    lastLon = gps.location.lng();
  }

  // ── Output sensor data at 50 Hz (every 20ms) ─────────────────────────────
  unsigned long now = millis();
  if (now - lastPrint >= 20) {
    lastPrint = now;

    float ax, ay, az, gx, gy, gz;

    #ifdef USE_MPU6050
      // ── Real sensor ──────────────────────────────────────────────────────
      readMPU(ax, ay, az, gx, gy, gz);
    #else
      // ── Simulated sensor (demo — replace with real MPU6050 values) ───────
      // Normal riding: ~0G horizontal, ~1G vertical (gravity), low rotation
      ax = random(-20, 20) / 100.0;          //  -0.20 to +0.20 G
      ay = random(-20, 20) / 100.0;
      az = 1.0 + random(-10, 10) / 100.0;   //  ~1G (gravity)
      gx = random(-50, 50) / 10.0;          //  -5 to +5 deg/sec
      gy = random(-50, 50) / 10.0;
      gz = random(-50, 50) / 10.0;

      // ── Simulate a crash every ~200 readings for demo ─────────────────────
      // Remove this block when using real hardware
      static int counter = 0;
      counter++;
      if (counter % 200 == 0) {
        // Spike: 4G impact + 300 deg/sec rotation
        ax = 3.8 + random(0, 50) / 100.0;
        ay = -2.1;
        az = 0.3;
        gx = 280.0 + random(0, 50);
        gy = -120.0;
        gz = 90.0;
        Serial.println("# [SIMULATED CRASH READING]");
      }
    #endif

    // Output as CSV — the ML bridge parses this line
    Serial.print(ax, 4); Serial.print(",");
    Serial.print(ay, 4); Serial.print(",");
    Serial.print(az, 4); Serial.print(",");
    Serial.print(gx, 4); Serial.print(",");
    Serial.print(gy, 4); Serial.print(",");
    Serial.println(gz, 4);
  }
}
