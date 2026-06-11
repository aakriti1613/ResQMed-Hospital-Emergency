"""
injury_inference.py
───────────────────
Inference layer for Model 3: Injury Risk Assessment.
Calculates the Empirical CDF (percentile) of a new crash against all known major/critical falls.
Generates an AI-Ready ER Hospital Alert payload.
"""

import os
import joblib
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "injury_kdes.joblib")
_models = None

def _load_models():
    global _models
    if _models is None:
        if os.path.exists(MODEL_PATH):
            _models = joblib.load(MODEL_PATH)
        else:
            _models = {}

def get_risk_level(cdf_score: float) -> str:
    """Map CDF percentile to risk string."""
    if cdf_score < 0.4:
        return "Low"
    elif cdf_score < 0.75:
        return "Medium"
    else:
        return "High"

def assess_injury_risk(features: dict, severity: str) -> dict:
    """
    Given the extracted IMU features and the predicted severity, calculate bodily risks.
    """
    _load_models()
    
    # Fallback default if model isn't trained yet
    res = {
        "head_trauma_risk": {"level": "Unknown", "confidence": 0.0},
        "spine_injury_risk": {"level": "Unknown", "confidence": 0.0},
        "lower_body_injury_risk": {"level": "Unknown", "confidence": 0.0},
        "hospital_alert": {
            "priority": "UNKNOWN",
            "prepare": []
        }
    }
    
    if not _models:
        return res
        
    def score_feature(name: str) -> float:
        model = _models.get(name)
        if not model:
            return 0.0
        val = features.get(model["feature"], 0.0)
        sorted_vals = model["sorted_values"]
        # Calculate empirical CDF (percentile)
        # Searchsorted returns the index where `val` would be inserted.
        idx = np.searchsorted(sorted_vals, val, side='right')
        cdf = idx / len(sorted_vals)
        return float(cdf)

    head_cdf = score_feature("head")
    spine_cdf = score_feature("spine")
    lower_cdf = score_feature("lower")
    
    # Optional context modifiers (e.g., if heart rate drops, boost spine risk due to shock)
    hr = features.get("heart_rate")
    if hr and (hr < 50 or hr > 130):
        spine_cdf = min(1.0, spine_cdf + 0.1)

    res["head_trauma_risk"] = {"level": get_risk_level(head_cdf), "confidence": round(head_cdf, 2)}
    res["spine_injury_risk"] = {"level": get_risk_level(spine_cdf), "confidence": round(spine_cdf, 2)}
    res["lower_body_injury_risk"] = {"level": get_risk_level(lower_cdf), "confidence": round(lower_cdf, 2)}
    
    # Generate ER Action Plan
    priority = "HIGH" if severity == "critical" else "MEDIUM"
    prepare_list = ["Trauma Bed", "Emergency Team"]
    
    if res["head_trauma_risk"]["level"] == "High":
        prepare_list.extend(["CT Scan", "Neuro Consult"])
    if res["spine_injury_risk"]["level"] == "High":
        prepare_list.append("Spine Immobilization Kit")
    if res["lower_body_injury_risk"]["level"] in ["Medium", "High"]:
        prepare_list.append("Orthopedic Evaluation")
        
    # Deduplicate
    prepare_list = list(dict.fromkeys(prepare_list))

    res["hospital_alert"] = {
        "priority": priority,
        "prepare": prepare_list
    }
    
    return res
