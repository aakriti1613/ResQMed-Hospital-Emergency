"""
ml_service/severity_inference.py
──────────────────────────────────
Full inference pipeline — Model 2 (Severity Classification)
Combines: ML prediction → Medical Risk Adjustment → ER Output

Works in two modes:
  TRAINED: loads model/severity_model.joblib (after running severity_train.py)
  DEMO:    physics-based rules (works immediately without training)
"""

import os
import json
import numpy as np
import warnings
warnings.filterwarnings("ignore")

from severity_feature_engineering import extract_live_features, LABEL_NAMES
from medical_risk_layer import adjust_severity, VitalSigns

MODEL_DIR   = os.path.join(os.path.dirname(__file__), "model")
MODEL_PATH  = os.path.join(MODEL_DIR, "severity_model.joblib")
META_PATH   = os.path.join(MODEL_DIR, "severity_meta.json")

FEATURE_COLS = [
    "acceleration_magnitude",
    "gyro_magnitude",
    "impact_force",
    "tilt_angle_after_impact",
    "no_movement_duration_s",
    "pre_impact_acc_mean",
    "speed_before_impact",
    "speed_drop",
]

_pipeline = None
_meta     = None

def _load_model():
    global _pipeline, _meta
    if _pipeline is not None:
        return True
    if not os.path.exists(MODEL_PATH):
        return False
    try:
        import joblib
        _pipeline = joblib.load(MODEL_PATH)
        if os.path.exists(META_PATH):
            with open(META_PATH) as f:
                _meta = json.load(f)
        print(f"[Severity] ✅ Loaded trained model from {MODEL_PATH}")
        if _meta:
            print(f"[Severity]    Test accuracy: {_meta.get('test_accuracy')}")
            print(f"[Severity]    Test F1:       {_meta.get('test_f1_weighted')}")
        return True
    except Exception as e:
        print(f"[Severity] ⚠️  Could not load model: {e} → using demo rules")
        return False

_using_trained = _load_model()


# ── Demo severity classifier (no trained model needed) ────────────────────────
def _demo_classify(features: dict) -> tuple[str, float]:
    """
    Physics-based severity classification.
    Uses same thresholds as feature_engineering severity derivation.
    Returns (severity_label, confidence)
    """
    acc  = features.get("acceleration_magnitude", 1.0)
    gyro = features.get("gyro_magnitude", 0.0)
    tilt = features.get("tilt_angle_after_impact", 0.0)
    spd  = features.get("speed_before_impact")
    drop = features.get("speed_drop")

    score = 0.0

    # Acceleration component (most important — 0 to 3 points)
    if acc < 2.5:   score += 0.0
    elif acc < 4.0: score += 1.5
    else:           score += 3.0

    # Gyroscope component (0 to 1 point)
    if gyro > 300:   score += 1.0
    elif gyro > 150: score += 0.5

    # Tilt angle — heavy tilt after impact = likely unable to recover (0–0.5)
    if tilt > 60:  score += 0.5
    elif tilt > 30: score += 0.25

    # Speed component if available (0–1.5 points)
    if spd is not None and not np.isnan(spd):
        if spd > 80:   score += 1.5
        elif spd > 40: score += 0.75
    if drop is not None and not np.isnan(drop):
        if drop > 60:  score += 1.0
        elif drop > 30: score += 0.5

    # Map score → severity
    if score < 1.5:
        label, conf = "minor",    min(0.5 + (1.5 - score) / 3.0, 0.95)
    elif score < 3.5:
        label, conf = "major",    0.60 + min((score - 1.5) / 5.0, 0.35)
    else:
        label, conf = "critical", min(0.70 + (score - 3.5) / 5.0, 0.99)

    return label, round(conf, 4)


def predict_severity(
    sensor_window:       list[list[float]],         # 50 × 6 readings
    speed_before_kmh:    float | None = None,
    speed_after_kmh:     float | None = None,
    heart_rate:          float | None = None,
    spo2:                float | None = None,
    no_movement_duration: float | None = None,
) -> dict:
    """
    Full inference pipeline:
      1. Extract features from sensor window
      2. ML severity classification (or demo rules)
      3. Medical Risk Adjustment Layer
      4. Build AI-ready ER output

    Returns complete prediction dict ready to send to the hospital ER dashboard.
    """
    # ── Step 1: Feature extraction ────────────────────────────────────────────
    features = extract_live_features(
        window=sensor_window,
        speed_before_kmh=speed_before_kmh,
        speed_after_kmh=speed_after_kmh,
    )

    # ── Step 2: ML Severity Prediction ───────────────────────────────────────
    if _using_trained and _pipeline is not None:
        import pandas as pd
        X = pd.DataFrame([{col: features.get(col, np.nan) for col in FEATURE_COLS}])
        proba     = _pipeline.predict_proba(X)[0]
        ml_code   = int(np.argmax(proba))
        ml_label  = LABEL_NAMES[ml_code].lower()
        ml_conf   = round(float(proba[ml_code]), 4)
        ml_mode   = "trained_rf"
        proba_map = {LABEL_NAMES[i].lower(): round(float(p), 4)
                     for i, p in enumerate(proba)}
    else:
        ml_label, ml_conf = _demo_classify(features)
        ml_code   = {"minor": 0, "major": 1, "critical": 2}[ml_label]
        ml_mode   = "demo_rules"
        proba_map = {ml_label: ml_conf}

    # ── Step 3: Medical Risk Adjustment ──────────────────────────────────────
    vitals = VitalSigns(
        heart_rate=heart_rate,
        spo2=spo2,
        no_movement_duration=no_movement_duration,
    )
    adjustment = adjust_severity(ml_label, vitals)

    # ── Step 4: ER Output ─────────────────────────────────────────────────────
    er_output = build_er_output(
        features=features,
        ml_severity=ml_label,
        ml_confidence=ml_conf,
        ml_mode=ml_mode,
        ml_proba=proba_map,
        adjustment=adjustment,
    )

    return er_output


def build_er_output(
    features:      dict,
    ml_severity:   str,
    ml_confidence: float,
    ml_mode:       str,
    ml_proba:      dict,
    adjustment,
) -> dict:
    """Builds the final AI-ready ER alert payload."""

    final = adjustment.final_severity
    code  = adjustment.final_severity_code

    # Triage colour code (standard ER START triage)
    triage_color = {"minor": "green", "major": "yellow", "critical": "red"}[final]
    triage_action = {
        "minor":    "Delayed — treat within 60 minutes",
        "major":    "Urgent — treat within 15 minutes",
        "critical": "Immediate — treat now, activate trauma team",
    }[final]

    return {
        # ── Model output ─────────────────────────────────────────────────────
        "model_2_severity": {
            "ml_prediction":   ml_severity,
            "ml_confidence":   ml_confidence,
            "ml_model_mode":   ml_mode,
            "class_proba":     ml_proba,
        },

        # ── Medical adjustment ────────────────────────────────────────────────
        "medical_adjustment": adjustment.to_dict(),

        # ── Final decision ────────────────────────────────────────────────────
        "final_severity":       final.capitalize(),
        "final_severity_code":  code,
        "triage_color":         triage_color,
        "triage_action":        triage_action,
        "severity_upgraded":    adjustment.upgraded,

        # ── Sensor features (for ER doctor context) ───────────────────────────
        "crash_features": {
            "impact_force_N":          None if np.isnan(features.get("impact_force", np.nan)) else features.get("impact_force"),
            "peak_acceleration_G":     None if np.isnan(features.get("acceleration_magnitude", np.nan)) else features.get("acceleration_magnitude"),
            "peak_gyro_dps":           None if np.isnan(features.get("gyro_magnitude", np.nan)) else features.get("gyro_magnitude"),
            "tilt_angle_deg":          None if np.isnan(features.get("tilt_angle_after_impact", np.nan)) else features.get("tilt_angle_after_impact"),
            "no_movement_duration_s":  None if np.isnan(features.get("no_movement_duration_s", np.nan)) else features.get("no_movement_duration_s"),
            "speed_before_impact_ms":  None if np.isnan(features.get("speed_before_impact", np.nan)) else features.get("speed_before_impact"),
            "speed_drop_ms":           None if np.isnan(features.get("speed_drop", np.nan)) else features.get("speed_drop"),
        },

        # ── Vitals ────────────────────────────────────────────────────────────
        "vitals_received": adjustment.vitals_used,
        "vitals_missing":  adjustment.vitals_missing,

        # ── Clinical notes ────────────────────────────────────────────────────
        "clinical_notes": adjustment.clinical_notes,
        "upgrade_reasons": adjustment.upgrade_reason,
    }


# ── Quick test without trained model ──────────────────────────────────────────
if __name__ == "__main__":
    import json as _json

    # Simulate a 50-reading crash window (4G impact)
    crash_window = []
    for i in range(50):
        if i == 25:  # spike at reading 25
            crash_window.append([3.8, -2.1, 0.3, 280.0, -120.0, 90.0])
        else:
            crash_window.append([0.05, 0.10, 1.0, 2.0, 1.5, 0.8])

    result = predict_severity(
        sensor_window=crash_window,
        speed_before_kmh=65.0,
        heart_rate=145,
        spo2=88.0,
        no_movement_duration=25.0,
    )

    print("="*65)
    print("  FULL SEVERITY INFERENCE RESULT")
    print("="*65)
    print(_json.dumps(result, indent=2))
