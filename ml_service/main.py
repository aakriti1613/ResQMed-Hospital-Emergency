"""
ml_service/main.py
──────────────────
FastAPI service — Aarogya Raksha ML Helmet Service

Endpoints:
  GET  /health              → status of Model 1 + Model 2
  POST /predict             → Model 1: accident vs normal (50 readings)
  POST /predict/single      → Model 1: single reading (auto-buffers)
  POST /predict/severity    → Model 2: severity + medical risk adjustment

Run:
  uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import collections
import model as ml_model   # Model 1: accident detection (model.py)

# Model 2: severity classification
try:
    from severity_inference import predict_severity as _predict_severity
    import severity_inference as _sev_module
    _severity_available = True
except Exception as _sev_err:
    print(f"[main] Model 2 import failed: {_sev_err}")
    _severity_available = False
    _sev_module = None

app = FastAPI(
    title="Aarogya Raksha — ML Helmet Service",
    description="Model 1: Accident detection | Model 2: Severity + Medical Risk",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WINDOW_SIZE = 50
_rolling_buffer: collections.deque = collections.deque(maxlen=WINDOW_SIZE)


# ── Schemas ───────────────────────────────────────────────────────────────────
class SensorWindow(BaseModel):
    readings: list[list[float]] = Field(
        ..., min_length=WINDOW_SIZE, max_length=WINDOW_SIZE,
        description="50 readings × 6 values [Acc_X,Acc_Y,Acc_Z,Gyr_X,Gyr_Y,Gyr_Z]"
    )

class SingleReading(BaseModel):
    acc_x: float; acc_y: float; acc_z: float
    gyr_x: float; gyr_y: float; gyr_z: float

class PredictionResponse(BaseModel):
    prediction:  str
    confidence:  float
    severity:    str
    mode:        str
    trigger_sos: bool
    debug:       Optional[dict] = None

class SeverityRequest(BaseModel):
    readings: list[list[float]] = Field(
        ..., min_length=WINDOW_SIZE, max_length=WINDOW_SIZE
    )
    speed_before_kmh:     Optional[float] = None
    speed_after_kmh:      Optional[float] = None
    heart_rate:           Optional[float] = None
    spo2:                 Optional[float] = Field(None, ge=0, le=100)
    no_movement_duration: Optional[float] = Field(None, ge=0)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Check status of both models."""
    # Model 2 status
    if _severity_available and _sev_module:
        sev_mode = "trained_rf" if _sev_module._using_trained else "demo_rules"
        sev_acc  = _sev_module._meta.get("test_accuracy")  if _sev_module._meta else None
        sev_f1   = _sev_module._meta.get("test_f1_weighted") if _sev_module._meta else None
    else:
        sev_mode, sev_acc, sev_f1 = "unavailable", None, None

    return {
        "status": "✅ running",
        "models": {
            "model1_accident_detection": {
                "status":      "✅ working",
                "mode":        "trained_rf" if ml_model._using_trained_model else "demo_rules",
                "trained":     ml_model._model is not None,
                "description": "Detects accident vs normal movement from 50 sensor readings",
            },
            "model2_severity_classification": {
                "status":      "✅ working" if _severity_available else "❌ unavailable",
                "mode":        sev_mode,
                "trained":     sev_mode == "trained_rf",
                "test_accuracy": sev_acc,
                "test_f1":     sev_f1,
                "description": "Classifies accident severity (Minor/Major/Critical) + medical risk adjustment",
            },
        },
        "endpoints": {
            "POST /predict":          "Model 1 — accident detection",
            "POST /predict/single":   "Model 1 — single reading (auto-buffered)",
            "POST /predict/severity": "Model 2 — severity + medical risk",
            "GET  /docs":             "Interactive API docs (Swagger UI)",
        }
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(body: SensorWindow):
    """Model 1 — Accident vs Normal Movement from 50 sensor readings."""
    for r in body.readings:
        if len(r) != 6:
            raise HTTPException(422, "Each reading must have exactly 6 values")
    result = ml_model.predict(body.readings)
    result["trigger_sos"] = (
        result["prediction"] == "accident" and result["confidence"] >= 0.65
    )
    return result


@app.post("/predict/single", response_model=PredictionResponse)
def predict_single(reading: SingleReading):
    """Model 1 — Send one reading at a time. Service buffers 50 then predicts."""
    _rolling_buffer.append([
        reading.acc_x, reading.acc_y, reading.acc_z,
        reading.gyr_x, reading.gyr_y, reading.gyr_z,
    ])
    if len(_rolling_buffer) < WINDOW_SIZE:
        return PredictionResponse(
            prediction="buffering", confidence=0.0, severity="low",
            mode="buffering", trigger_sos=False,
            debug={"buffered": len(_rolling_buffer), "needed": WINDOW_SIZE}
        )
    result = ml_model.predict(list(_rolling_buffer))
    result["trigger_sos"] = (
        result["prediction"] == "accident" and result["confidence"] >= 0.65
    )
    return result


@app.post("/predict/severity")
def predict_severity_endpoint(body: SeverityRequest):
    """
    Model 2 — Severity Classification + Medical Risk Adjustment.
    Returns full AI-ready ER output including triage color and clinical notes.
    """
    if not _severity_available:
        raise HTTPException(503, "Model 2 not available — check server logs")
    for r in body.readings:
        if len(r) != 6:
            raise HTTPException(422, "Each reading must have exactly 6 values")
    result = _predict_severity(
        sensor_window=body.readings,
        speed_before_kmh=body.speed_before_kmh,
        speed_after_kmh=body.speed_after_kmh,
        heart_rate=body.heart_rate,
        spo2=body.spo2,
        no_movement_duration=body.no_movement_duration,
    )

    # ── Model 3: Injury Risk Assessment (Runs only for Major/Critical) ──
    final_sev = result.get("final_severity", "").lower()
    if final_sev in ["major", "critical"]:
        try:
            from injury_inference import assess_injury_risk
            features = {
                "gyro_magnitude": result["crash_features"].get("peak_gyro_dps"),
                "impact_force": result["crash_features"].get("impact_force_N"),
                "acceleration_magnitude": result["crash_features"].get("peak_acceleration_G"),
                "heart_rate": body.heart_rate,
            }
            injury_res = assess_injury_risk(features, final_sev)
            
            # Merge Model 3 outputs into the main ER payload
            result["head_trauma_risk"] = injury_res["head_trauma_risk"]
            result["spine_injury_risk"] = injury_res["spine_injury_risk"]
            result["lower_body_injury_risk"] = injury_res["lower_body_injury_risk"]
            result["hospital_alert"] = injury_res["hospital_alert"]
            
        except Exception as e:
            print(f"[main] Model 3 error: {e}")

    return result
