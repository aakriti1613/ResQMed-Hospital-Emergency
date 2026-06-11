#!/usr/bin/env python3
"""
accident_train.py
─────────────────
Trains Model 1 (Accident Detection) on raw SisFall IMU waveforms.
Input: 50x6 windows of [Acc_X, Acc_Y, Acc_Z, Gyr_X, Gyr_Y, Gyr_Z].
Output: 0 (Normal/ADL) or 1 (Accident/Fall).
Saves to model/accident_model.joblib.

Using RandomForest instead of LSTM for native compatibility across Python versions.
"""

import os
import argparse
import numpy as np
import pandas as pd
from pathlib import Path
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

WINDOW_SIZE = 50
MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")

def extract_window_features(window: np.ndarray) -> np.ndarray:
    """
    Extract statistical features from the 50x6 window.
    """
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

def load_sisfall_for_rf(data_dir: str):
    data_path = Path(data_dir)
    falls_dir = data_path / "Falls"
    adl_dir = data_path / "ADL"
    
    if not falls_dir.exists() and not adl_dir.exists():
        raise FileNotFoundError(f"SisFall data not found at {data_path}")

    X, y = [], []
    
    def process_dir(directory, label):
        files = list(directory.rglob("*.txt")) + list(directory.rglob("*.csv"))
        extracted = 0
        
        for fp in files:
            try:
                with open(fp, 'r') as f:
                    lines = [line.strip().rstrip(';') for line in f if line.strip()]
                data = [list(map(float, line.split(','))) for line in lines]
                df = pd.DataFrame(data).iloc[:, :6]
                
                if len(df) < WINDOW_SIZE:
                    continue
                
                df.iloc[:, 0] = df.iloc[:, 0] * 0.00390625
                df.iloc[:, 1] = df.iloc[:, 1] * 0.00390625
                df.iloc[:, 2] = df.iloc[:, 2] * 0.00390625
                df.iloc[:, 3] = df.iloc[:, 3] / 14.375
                df.iloc[:, 4] = df.iloc[:, 4] / 14.375
                df.iloc[:, 5] = df.iloc[:, 5] / 14.375
                
                arr = df.values
                
                if label == 1:
                    acc_mag = np.sqrt(np.sum(arr[:, :3]**2, axis=1))
                    peak_idx = int(np.argmax(acc_mag))
                    start_idx = max(0, peak_idx - 25)
                    end_idx = start_idx + WINDOW_SIZE
                    if end_idx > len(arr):
                        end_idx = len(arr)
                        start_idx = max(0, end_idx - WINDOW_SIZE)
                        
                    window = arr[start_idx:end_idx]
                    if len(window) == WINDOW_SIZE:
                        X.append(extract_window_features(window))
                        y.append(label)
                        extracted += 1
                else:
                    for _ in range(3): # Sample 3 ADL windows per file to balance
                        start_idx = np.random.randint(0, len(arr) - WINDOW_SIZE)
                        window = arr[start_idx : start_idx + WINDOW_SIZE]
                        X.append(extract_window_features(window))
                        y.append(label)
                        extracted += 1
                        
            except Exception as e:
                pass
                
        print(f"Extracted {extracted} windows for label={label} from {directory.name}")

    if falls_dir.exists():
        process_dir(falls_dir, 1)
    if adl_dir.exists():
        process_dir(adl_dir, 0)
        
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32)

def train_rf(sisfall_dir: str):
    print("=" * 60)
    print("  TRAINING MODEL 1: RANDOM FOREST ACCIDENT DETECTION")
    print("=" * 60)
    
    X, y = load_sisfall_for_rf(sisfall_dir)
    print(f"\n[Model 1] Dataset size: X={X.shape}, y={y.shape}")
    
    if len(X) == 0:
        print("[ERROR] No data loaded. Check SisFall path.")
        return
        
    model = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42)
    model.fit(X, y)
    
    acc = accuracy_score(y, model.predict(X))
    print(f"\n[Model 1] Training Accuracy: {acc:.4f}")
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    out_path = os.path.join(MODEL_DIR, "accident_model.joblib")
    joblib.dump(model, out_path)
    
    print("\n" + "=" * 60)
    print(f"✅ Trained Model 1 saved -> {out_path}")
    print("=" * 60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sisfall-dir", type=str, default="./data/SisFall")
    args = parser.parse_args()
    train_rf(args.sisfall_dir)
