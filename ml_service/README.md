# 🧠 ML Accident Detection Service

Replaces the old `2.5G threshold` rule in the Arduino with a trained **LSTM model** that understands full time-series patterns from the helmet sensors.

---

## How It Works

```
Arduino (CSV sensor data at 50Hz)
    ↓  USB Serial
arduino_bridge.py  (buffers 50 readings)
    ↓  HTTP POST /predict
main.py (FastAPI ML service)
    ↓  LSTM model prediction
    ↓  "accident" with confidence ≥ 65%?
    ↓  YES → prints SOS URL
App (SosPage) ← open URL → Firebase SOS triggered
```

---

## Quick Start

### 1. Install Python dependencies
```bash
cd ml_service
pip install -r requirements.txt
```

### 2. Start the ML service
```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Open http://localhost:8001/docs to see the API.

### 3. Connect Arduino & run bridge
```bash
# Find your Arduino port first:
ls /dev/cu.*       # Mac
# OR Device Manager on Windows (COM3, COM4 etc.)

python arduino_bridge.py --port /dev/cu.usbmodem14101 --lat 28.6139 --lon 77.2090
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Check if service + model are running |
| `/predict` | POST | Send 50 readings, get accident prediction |
| `/predict/single` | POST | Send 1 reading at a time (auto-buffered) |

### Example Request
```bash
curl -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{"readings": [[0.1,-9.8,0.2,1.0,-0.5,0.3], ...]}'
```

### Example Response
```json
{
  "prediction":  "accident",
  "confidence":  0.94,
  "severity":    "critical",
  "mode":        "lstm",
  "trigger_sos": true
}
```

---

## Model Modes

| Mode | When it runs | Description |
|---|---|---|
| `demo` | Before training | Physics-based rules (G-force + gyro thresholds). Works immediately. |
| `lstm` | After training | Trained LSTM on SisFall dataset. Higher accuracy, fewer false alarms. |

---

## Train the Real Model (Optional Upgrade)

1. Download [SisFall Dataset](http://sistemic.udea.edu.co/en/research/projects/english-falls/)
2. Place files: `data/Falls/*.csv` and `data/ADL/*.csv`
3. Run training:
```bash
python ../ML_Accident_Detection_Implementation.md   # follow Step 4–5
# OR run the train script directly from the guide
```
4. The trained model saves to `model/accident_model.h5`
5. Restart the ML service — it will auto-load the trained model.

---

## Files

| File | Purpose |
|---|---|
| `main.py` | FastAPI REST API server |
| `model.py` | LSTM model loader + demo fallback |
| `arduino_bridge.py` | Reads Arduino serial → calls ML → triggers SOS |
| `requirements.txt` | Python dependencies |
