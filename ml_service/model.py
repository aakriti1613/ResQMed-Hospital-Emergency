"""
ml_service/model.py
───────────────────
LSTM model definition for accident vs normal movement detection.

Two modes:
  1. TRAINED  — loads model/accident_model.h5 if it exists (after you train on SisFall)
  2. DEMO     — uses a physics-based rule that mimics what the model will learn,
                so the API works immediately even before training.
"""

import os
import numpy as np
import joblib

WINDOW_SIZE = 50   # 50 sensor readings = ~1 second at 50 Hz
N_FEATURES  = 6    # Acc_X, Acc_Y, Acc_Z, Gyr_X, Gyr_Y, Gyr_Z
MODEL_PATH  = os.path.join(os.path.dirname(__file__), "model", "accident_model.joblib")

_model = None   # cached after first load

# ── Try to load trained Random Forest model ──────────────────────────────────
def _try_load_rf():
    global _model
    if not os.path.exists(MODEL_PATH):
        return False
    try:
        _model = joblib.load(MODEL_PATH)
        print(f"[ML] ✅ Loaded trained RandomForest model from {MODEL_PATH}")
        return True
    except Exception as e:
        print(f"[ML] ⚠️  Could not load model: {e}  → falling back to demo mode")
        return False

_using_trained_model = _try_load_rf()

def extract_window_features(window: np.ndarray) -> np.ndarray:
    acc = window[:, :3]
    gyr = window[:, 3:]
    acc_mag = np.sqrt(np.sum(acc**2, axis=1))
    gyro_mag = np.sqrt(np.sum(gyr**2, axis=1))
    return np.array([
        float(np.max(acc_mag)),
        float(np.min(acc_mag)),
        float(np.mean(acc_mag)),
        float(np.std(acc_mag)),
        float(np.max(gyro_mag)),
        float(np.mean(gyro_mag)),
        float(np.std(gyro_mag))
    ], dtype=np.float32)

# ── Main prediction function ──────────────────────────────────────────────────
def predict(window: list[list[float]]) -> dict:
    arr = np.array(window, dtype=np.float32)

    if _using_trained_model and _model is not None:
        return _predict_rf(arr)
    else:
        return _predict_demo(arr)

# ── RF inference (trained model) ─────────────────────────────────────────────
def _predict_rf(arr: np.ndarray) -> dict:
    features = extract_window_features(arr).reshape(1, -1)
    proba = _model.predict_proba(features)[0]
    prob_fall = float(proba[1]) # Probability of class 1 (Accident)

    prediction = "accident" if prob_fall > 0.60 else "normal"
    severity   = _severity_from_prob(prob_fall)

    return {
        "prediction": prediction,
        "confidence": round(prob_fall if prediction == "accident" else float(proba[0]), 4),
        "severity":   severity,
        "mode":       "trained_rf",
        "debug": {
            "peak_acc_g": float(features[0, 0]),
            "peak_gyro_dps": float(features[0, 4]),
        }
    }


# ── Demo physics-based predictor (no model file needed) ─────────────────────
def _predict_demo(arr: np.ndarray) -> dict:
    """
    Replicates what the LSTM learns, using physics rules:
      • Compute resultant acceleration magnitude per reading
      • Peak magnitude > 2.5 G  → possible accident
      • Peak magnitude > 3.5 G  → critical accident
      • Also check gyroscope angular velocity for sudden rotation
    """
    acc   = arr[:, :3]   # Acc_X, Acc_Y, Acc_Z
    gyro  = arr[:, 3:]   # Gyr_X, Gyr_Y, Gyr_Z

    # Resultant acceleration magnitude
    acc_mag  = np.sqrt(np.sum(acc ** 2, axis=1))   # shape (50,)
    gyro_mag = np.sqrt(np.sum(gyro ** 2, axis=1))

    peak_acc  = float(acc_mag.max())
    peak_gyro = float(gyro_mag.max())

    # Crash pattern: sudden spike followed by near-zero (body still after impact)
    spike_idx   = int(acc_mag.argmax())
    post_impact = float(acc_mag[spike_idx:].mean()) if spike_idx < WINDOW_SIZE - 1 else peak_acc

    is_accident = (
        peak_acc > 2.5 or                 # hard impact
        (peak_acc > 1.8 and peak_gyro > 200)  # moderate impact + heavy rotation (skid)
    )
    prob = _demo_probability(peak_acc, peak_gyro)

    return {
        "prediction": "accident" if is_accident else "normal",
        "confidence": round(prob, 4),
        "severity":   _severity_from_peak(peak_acc),
        "mode":       "demo",
        "debug": {
            "peak_acc_g":   round(peak_acc, 3),
            "peak_gyro_dps": round(peak_gyro, 2),
            "post_impact_mean": round(post_impact, 3),
        }
    }


# ── Helpers ───────────────────────────────────────────────────────────────────
def _severity_from_prob(prob: float) -> str:
    if prob > 0.85:   return "critical"
    if prob > 0.60:   return "medium"
    return "low"

def _severity_from_peak(peak_g: float) -> str:
    if peak_g > 3.5:  return "critical"
    if peak_g > 2.5:  return "medium"
    return "low"

def _demo_probability(peak_g: float, peak_gyro: float) -> float:
    """Sigmoid-like mapping of G-force to confidence 0–1."""
    raw = (peak_g - 1.0) / 3.0 + (peak_gyro / 1000.0)
    return float(1 / (1 + np.exp(-5 * (raw - 0.5))))
