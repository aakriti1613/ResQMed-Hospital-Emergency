"""
ml_service/severity_train.py
─────────────────────────────
Model 2 — Severity Classification Training Pipeline

Model: Random Forest Classifier
  Chosen over neural networks because:
  1. Works well on small-to-medium tabular datasets
  2. Handles missing features (NaN) with imputation
  3. Provides feature importance (explainable to judges / doctors)
  4. No GPU required

Severity classes: 0=Minor, 1=Major, 2=Critical

Run (after downloading SisFall):
  python severity_train.py --sisfall-dir ./data/SisFall
  python severity_train.py --sisfall-dir ./data/SisFall --crss ./data/CRSS/ACCIDENT.CSV
"""

import argparse
import os
import json
import numpy as np
import pandas as pd
import joblib
import warnings
warnings.filterwarnings("ignore")

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    classification_report, confusion_matrix,
    accuracy_score, f1_score
)

from severity_feature_engineering import (
    load_sisfall_dataset, load_crss_speed_features,
    LABEL_MAP, LABEL_NAMES
)

MODEL_DIR  = os.path.join(os.path.dirname(__file__), "model")
MODEL_PATH = os.path.join(MODEL_DIR, "severity_model.joblib")
META_PATH  = os.path.join(MODEL_DIR, "severity_meta.json")

# Features used by the model (in order — must match inference)
FEATURE_COLS = [
    "acceleration_magnitude",
    "gyro_magnitude",
    "impact_force",
    "tilt_angle_after_impact",
    "no_movement_duration_s",
    "pre_impact_acc_mean",
    "speed_before_impact",    # NaN if no GPS / no CRSS data
    "speed_drop",             # NaN if no post-crash speed
]


def build_model_pipeline():
    """
    Pipeline:
      1. Median imputation for NaN features (speed_before, speed_drop)
         Median is more robust to outliers than mean for crash data
      2. Random Forest — 300 trees, class_weight balanced (handles class imbalance)
    """
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("clf", RandomForestClassifier(
            n_estimators=300,
            max_depth=10,
            min_samples_leaf=5,
            class_weight="balanced",   # handles Minor/Major/Critical imbalance
            random_state=42,
            n_jobs=-1,
        )),
    ])


def train(sisfall_dir: str, crss_csv: str | None = None):
    os.makedirs(MODEL_DIR, exist_ok=True)

    # ── Load SisFall ─────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("  LOADING DATASETS")
    print("="*60)

    df_sis = load_sisfall_dataset(sisfall_dir)

    # ── Optionally enrich with CRSS speed features ────────────────────────────
    if crss_csv:
        df_crss = load_crss_speed_features(crss_csv)
        if df_crss is not None:
            df = pd.concat([df_sis, df_crss], ignore_index=True, sort=False)
            print(f"\n[TRAIN] Combined dataset: {len(df)} samples")
        else:
            df = df_sis
    else:
        df = df_sis

    # ── Prepare features and labels ───────────────────────────────────────────
    X = df[FEATURE_COLS].copy()
    y = df["severity_code"].astype(int)

    print(f"\n[TRAIN] Class distribution:")
    for code, name in LABEL_NAMES.items():
        count = int((y == code).sum())
        print(f"  {name:10s}: {count:5d} samples ({count/len(y)*100:.1f}%)")

    # ── Train/Val/Test split ──────────────────────────────────────────────────
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )
    print(f"\n[TRAIN] Split → Train:{len(X_train)} | Val:{len(X_val)} | Test:{len(X_test)}")

    # ── Build and train ───────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("  TRAINING RANDOM FOREST")
    print("="*60)

    pipeline = build_model_pipeline()
    pipeline.fit(X_train, y_train)

    # ── Cross-validation (5-fold, stratified) ─────────────────────────────────
    print("\n[TRAIN] 5-Fold Cross-Validation (on training set)...")
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5,
                                scoring="f1_weighted", n_jobs=-1)
    print(f"  CV F1-weighted: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # ── Validation evaluation ─────────────────────────────────────────────────
    y_val_pred = pipeline.predict(X_val)
    val_acc    = accuracy_score(y_val, y_val_pred)
    val_f1     = f1_score(y_val, y_val_pred, average="weighted")

    print(f"\n[VAL] Accuracy  : {val_acc:.4f}")
    print(f"[VAL] F1-weighted: {val_f1:.4f}")

    # ── Test evaluation (only run ONCE — final number) ────────────────────────
    print("\n" + "="*60)
    print("  TEST SET EVALUATION  (final — run only once)")
    print("="*60)

    y_test_pred = pipeline.predict(X_test)
    test_acc    = accuracy_score(y_test, y_test_pred)
    test_f1     = f1_score(y_test, y_test_pred, average="weighted")

    print(f"\nTest Accuracy  : {test_acc:.4f}")
    print(f"Test F1-weighted: {test_f1:.4f}")

    print("\nClassification Report:")
    print(classification_report(
        y_test, y_test_pred,
        target_names=[LABEL_NAMES[i] for i in sorted(LABEL_NAMES.keys())]
    ))

    print("Confusion Matrix (rows=actual, cols=predicted):")
    cm = confusion_matrix(y_test, y_test_pred)
    header = "          " + "  ".join(f"{LABEL_NAMES[i]:8s}" for i in range(3))
    print(header)
    for i, row in enumerate(cm):
        print(f"{LABEL_NAMES[i]:8s}  " + "  ".join(f"{v:8d}" for v in row))

    # ── Feature importance ────────────────────────────────────────────────────
    rf = pipeline.named_steps["clf"]
    importances = rf.feature_importances_
    importance_dict = dict(zip(FEATURE_COLS, [round(float(v), 4) for v in importances]))

    print("\n[TRAIN] Feature Importances:")
    for feat, imp in sorted(importance_dict.items(), key=lambda x: -x[1]):
        bar = "█" * int(imp * 40)
        print(f"  {feat:35s}: {imp:.4f}  {bar}")

    # ── Save model and metadata ───────────────────────────────────────────────
    joblib.dump(pipeline, MODEL_PATH)

    meta = {
        "model_type":       "RandomForestClassifier",
        "n_estimators":     300,
        "features":         FEATURE_COLS,
        "classes":          {str(k): v for k, v in LABEL_NAMES.items()},
        "datasets_used":    ["SisFall (IMU features)"] +
                            (["NHTSA CRSS (speed features)"] if crss_csv else []),
        "test_accuracy":    round(test_acc, 4),
        "test_f1_weighted": round(test_f1, 4),
        "cv_f1_mean":       round(float(cv_scores.mean()), 4),
        "cv_f1_std":        round(float(cv_scores.std()), 4),
        "feature_importance": importance_dict,
        "n_train_samples":  len(X_train),
        "n_test_samples":   len(X_test),
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n✅ Model saved → {MODEL_PATH}")
    print(f"✅ Metadata    → {META_PATH}")
    return pipeline, meta


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Severity Classification Model")
    parser.add_argument("--sisfall-dir", required=True,
                        help="Path to SisFall data directory (containing Falls/ and ADL/)")
    parser.add_argument("--crss",        default=None,
                        help="Optional: path to NHTSA CRSS ACCIDENT.CSV")
    args = parser.parse_args()

    train(args.sisfall_dir, args.crss)
