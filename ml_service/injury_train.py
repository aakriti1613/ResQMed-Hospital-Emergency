#!/usr/bin/env python3
"""
injury_train.py
───────────────
Model 3: Injury Risk Assessment
Trains Kernel Density Estimation (KDE) models on actual fall data to score the extremity of impacts.
This avoids fabricating fake anatomical injury labels while providing mathematically sound risk probabilities.
"""

import os
import argparse
import joblib
import numpy as np
import pandas as pd
from sklearn.neighbors import KernelDensity
from sklearn.preprocessing import StandardScaler

from severity_feature_engineering import load_sisfall_dataset

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")

def train_injury_models(sisfall_dir: str):
    print("=" * 60)
    print("  LOADING DATA FOR INJURY RISK ASSESSMENT (Model 3)")
    print("=" * 60)
    
    # Load all data
    df = load_sisfall_dataset(sisfall_dir)
    
    # FILTER: We only want to train the KDE on ACTUAL FALLS (Major & Critical)
    # This way, the KDE learns what a "normal fall" vs an "extreme fall" looks like.
    df_falls = df[df["severity_label"].isin(["major", "critical"])].copy()
    
    print(f"[INJURY_TRAIN] Found {len(df_falls)} true falls out of {len(df)} total samples.")
    if len(df_falls) == 0:
        print("[ERROR] No falls found. Cannot train KDE.")
        return
        
    # ── DEFINE BIOMECHANICAL FEATURE MAPPINGS ────────────────────────────────
    # Head Trauma Risk: Strongly linked to rotational acceleration and lying flat
    head_features = ["gyro_magnitude", "tilt_angle_after_impact"]
    
    # Spine Injury Risk: Strongly linked to vertical compression and paralysis
    spine_features = ["impact_force", "no_movement_duration_s"]
    
    # Lower Body Risk: Strongly linked to hard stops and sudden deceleration
    lower_features = ["acceleration_magnitude"]

    # Fill NaNs just in case
    df_falls = df_falls.fillna(0.0)

    # ── FIT EMPIRICAL CDF MODELS ──────────────────────────────────────────────
    print("\n[INJURY_TRAIN] Building Empirical CDF models...")
    
    models = {}
    
    def fit_ecdf(name, feature_col):
        # We just need the sorted values to calculate percentile of a new sample
        values = df_falls[feature_col].values
        sorted_vals = np.sort(values)
        
        models[name] = {
            "feature": feature_col,
            "sorted_values": sorted_vals
        }
        print(f"  ✅ Built Empirical CDF for {name} Risk (Feature: {feature_col})")

    # For simplicity, we use the primary driving feature for each anatomical region
    fit_ecdf("head", "gyro_magnitude")
    fit_ecdf("spine", "impact_force")
    fit_ecdf("lower", "acceleration_magnitude")
    
    # ── SAVE MODELS ───────────────────────────────────────────────────────────
    os.makedirs(MODEL_DIR, exist_ok=True)
    out_path = os.path.join(MODEL_DIR, "injury_kdes.joblib") # Keeping name for compatibility
    joblib.dump(models, out_path)
    
    print("\n" + "=" * 60)
    print(f"✅ Injury Risk Models saved -> {out_path}")
    print("=" * 60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sisfall-dir", type=str, default="./data/SisFall")
    args = parser.parse_args()
    
    train_injury_models(args.sisfall_dir)
