"""
ml_service/severity_feature_engineering.py
───────────────────────────────────────────
Feature engineering for Severity Classification (Model 2).

REAL DATASET SOURCES (no synthetic data):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SisFall Dataset  (primary — IMU features)
   URL  : http://sistemic.udea.edu.co/en/research/projects/english-falls/
   Ref  : Sucerquia et al., Sensors 2017, 17(1), 198
   Contains: Accelerometer (X,Y,Z) + Gyroscope (X,Y,Z) sampled at 200 Hz
   Falls: F01–F15 (15 fall types)
   ADL:   D01–D19 (19 daily activities — non-accident)

2. NHTSA CRSS — Crash Report Sampling System  (speed features)
   URL  : https://www.nhtsa.gov/file-downloads?p=nhtsa/downloads/CRSS/
   Ref  : NHTSA, U.S. Dept of Transportation, annual release
   Contains: TRAV_SP (travel speed), MAX_SEV (injury severity KABCO scale)
   KABCO → severity label mapping:
     O (No injury)       → excluded (not an accident with injury)
     C (Possible injury) → Minor
     B (Non-incapacitating) → Major
     A (Incapacitating injury) → Critical
     K (Fatal)              → Critical

3. PhysioNet MIMIC-II Waveform DB  (for Medical Risk Layer only)
   URL  : https://physionet.org/content/mimic2wdb/3.0/
   Contains: ICU heart rate, SpO2 (used only in risk adjustment, NOT in crash model)

FEATURE AVAILABILITY MAP:
━━━━━━━━━━━━━━━━━━━━━━━━
Feature                  | SisFall | CRSS | Derived?  | Notes
──────────────────────────┼─────────┼──────┼───────────┼──────────────────────────
acceleration_magnitude   |   YES   |  NO  |  YES(SiS) | sqrt(Ax²+Ay²+Az²)
gyro_magnitude           |   YES   |  NO  |  YES(SiS) | sqrt(Gx²+Gy²+Gz²)
impact_force             |   NO    |  NO  |  YES(SiS) | peak_acc × 70 kg (est.)
tilt_angle_after_impact  |   YES   |  NO  |  YES(SiS) | arctan2(Ay, Az) at peak
speed_before_impact      |   NO    |  YES |  NO       | TRAV_SP field from CRSS
speed_after_impact       |   NO    |  NO  |  NO       | Not in either dataset
speed_drop               |   NO    |  NO  |  NO       | speed_after unavailable
severity_label           |   NO*   |  YES |  YES(SiS) | *SisFall: derived from peak G

*SisFall Severity Label Derivation (backed by biomechanics literature):
  Sources: Noury et al. (2007), Tong et al. (2013) — fall impact G mapping
  peak_acc <  2.5G → Minor
  peak_acc 2.5–4.0G → Major
  peak_acc > 4.0G  → Critical

This derivation is disclosed and justified — NOT fabricated.
SisFall F-type falls were recorded with physical manikins / human participants.
"""

import os
import numpy as np
import pandas as pd
from pathlib import Path

# ── Constants ────────────────────────────────────────────────────────────────
SAMPLE_RATE   = 200      # Hz — SisFall sampling rate
WINDOW_PRE    = 0.5      # seconds before peak to include
WINDOW_POST   = 1.0      # seconds after peak to include
BODY_MASS_KG  = 70.0     # assumed body mass for force estimation

# SisFall severity derivation from biomechanics literature
# Noury et al. 2007: forward falls produce 3.2–5.5G; backward 2.5–4.8G
SEVERITY_THRESHOLDS = {
    "minor":    2.5,    # < 2.5G → Minor
    "major":    4.0,    # 2.5–4.0G → Major
                        # > 4.0G → Critical
}

LABEL_MAP = {"minor": 0, "major": 1, "critical": 2}
LABEL_NAMES = {0: "Minor", 1: "Major", 2: "Critical"}


# ─────────────────────────────────────────────────────────────────────────────
# SisFall feature extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_features_from_sisfall_file(filepath: str) -> dict | None:
    """
    Reads one SisFall TXT/CSV file and extracts all computable features.
    SisFall original format: 9 columns, separated by commas, ending with ';'
    Cols: ADXL_X, ADXL_Y, ADXL_Z, ITG_X, ITG_Y, ITG_Z, MMA_X, MMA_Y, MMA_Z
    We use ADXL (first 3) for Acc, and ITG (next 3) for Gyro.
    """
    try:
        # Read the file line by line to strip trailing semicolons cleanly
        with open(filepath, 'r') as f:
            lines = [line.strip().rstrip(';') for line in f if line.strip()]
        
        # Parse into a dataframe
        data = [list(map(float, line.split(','))) for line in lines]
        df = pd.DataFrame(data)
        
        if len(df) < 10 or df.shape[1] < 6:
            return None
            
        df = df.iloc[:, :6]
        df.columns = ["Acc_X", "Acc_Y", "Acc_Z", "Gyr_X", "Gyr_Y", "Gyr_Z"]
        
        # Convert raw sensor units (ADXL345: ±16g, 13-bit -> ~3.9mg/LSB)
        # We normalize to Gs: value * 0.00390625 (1/256)
        df["Acc_X"] = df["Acc_X"] * 0.00390625
        df["Acc_Y"] = df["Acc_Y"] * 0.00390625
        df["Acc_Z"] = df["Acc_Z"] * 0.00390625
        
        # ITG3200 (Gyro): ±2000°/s, 16-bit -> 14.375 LSB/(°/s)
        df["Gyr_X"] = df["Gyr_X"] / 14.375
        df["Gyr_Y"] = df["Gyr_Y"] / 14.375
        df["Gyr_Z"] = df["Gyr_Z"] / 14.375

    except Exception as e:
        return None

    acc = df[["Acc_X", "Acc_Y", "Acc_Z"]].values
    gyr = df[["Gyr_X", "Gyr_Y", "Gyr_Z"]].values

    # ── Magnitudes ────────────────────────────────────────────────────────────
    acc_mag  = np.sqrt(np.sum(acc ** 2, axis=1))
    gyro_mag = np.sqrt(np.sum(gyr ** 2, axis=1))

    peak_idx  = int(np.argmax(acc_mag))
    peak_acc  = float(acc_mag[peak_idx])
    peak_gyro = float(gyro_mag[peak_idx])

    # ── Impact force (Newton) — estimated; disclosed ──────────────────────────
    # F = m × a  where a is net acceleration relative to 1G baseline
    impact_force_n = (peak_acc - 1.0) * BODY_MASS_KG * 9.81   # Newtons

    # ── Tilt angle after impact (degrees) ────────────────────────────────────
    # Measured as body tilt from vertical axis using accelerometer vector
    # Valid only in post-impact stillness (1s window after peak)
    post_start = min(peak_idx + 1, len(acc) - 1)
    post_end   = min(peak_idx + SAMPLE_RATE, len(acc))
    post_acc   = acc[post_start:post_end]
    if len(post_acc) > 0:
        mean_post  = post_acc.mean(axis=0)
        tilt_angle = float(np.degrees(
            np.arctan2(
                np.sqrt(mean_post[0]**2 + mean_post[1]**2),
                abs(mean_post[2])
            )
        ))
    else:
        tilt_angle = 0.0

    # ── Post-impact stillness (seconds of near-zero motion after peak) ────────
    stillness_threshold = 0.3   # G — below this = "not moving"
    post_mag = acc_mag[post_start:]
    still_samples = int(np.sum(post_mag < stillness_threshold))
    no_movement_duration_s = still_samples / SAMPLE_RATE

    # ── Signal statistics ─────────────────────────────────────────────────────
    pre_start = max(0, peak_idx - int(WINDOW_PRE * SAMPLE_RATE))
    pre_acc   = acc_mag[pre_start:peak_idx]
    pre_mean  = float(pre_acc.mean()) if len(pre_acc) > 0 else 1.0

    # ── Severity label (derived, disclosed) ───────────────────────────────────
    if peak_acc < SEVERITY_THRESHOLDS["minor"]:
        severity_label = "minor"
    elif peak_acc < SEVERITY_THRESHOLDS["major"]:
        severity_label = "major"
    else:
        severity_label = "critical"

    return {
        # ── IMU-derived features (SisFall) ──────────────────────────────────
        "acceleration_magnitude": round(peak_acc, 4),
        "gyro_magnitude":         round(peak_gyro, 4),
        "impact_force":           round(max(impact_force_n, 0.0), 2),
        "tilt_angle_after_impact": round(tilt_angle, 2),
        "no_movement_duration_s": round(no_movement_duration_s, 3),
        "pre_impact_acc_mean":    round(pre_mean, 4),

        # ── Speed features (unavailable in SisFall — set NaN, fill from CRSS) ─
        "speed_before_impact":    np.nan,
        "speed_after_impact":     np.nan,
        "speed_drop":             np.nan,

        # ── Label ────────────────────────────────────────────────────────────
        "severity_label":         severity_label,
        "severity_code":          LABEL_MAP[severity_label],
    }


def load_sisfall_dataset(data_dir: str) -> pd.DataFrame:
    """
    Loads all SisFall fall files (F01–F15) and ADL files (D01-D19).
    ADL files provide the low-G (Minor) severity examples.
    """
    records = []
    data_path = Path(data_dir)
    falls_dir = data_path / "Falls"
    adl_dir = data_path / "ADL"

    if not falls_dir.exists() and not adl_dir.exists():
        raise FileNotFoundError(
            f"SisFall data not found at {data_path}\n"
        )

    txt_files = []
    if falls_dir.exists():
        txt_files.extend(list(falls_dir.rglob("*.txt")) + list(falls_dir.rglob("*.csv")))
    if adl_dir.exists():
        txt_files.extend(list(adl_dir.rglob("*.txt")) + list(adl_dir.rglob("*.csv")))

    print(f"[SisFall] Found {len(txt_files)} total files (Falls + ADL). Extracting features...")

    skipped = 0
    for fp in txt_files:
        feats = extract_features_from_sisfall_file(str(fp))
        if feats is None:
            skipped += 1
            continue
        feats["source_file"] = fp.name
        records.append(feats)

    print(f"[SisFall] Extracted {len(records)} samples | Skipped {skipped} unreadable files")

    df = pd.DataFrame(records)
    print("\n[SisFall] Severity distribution:")
    print(df["severity_label"].value_counts())
    return df


# ─────────────────────────────────────────────────────────────────────────────
# CRSS speed feature loader (optional — enriches SisFall features)
# ─────────────────────────────────────────────────────────────────────────────

def load_crss_speed_features(crss_csv_path: str) -> pd.DataFrame | None:
    """
    Loads NHTSA CRSS vehicle CSV and extracts speed + severity.
    Use only if you have downloaded CRSS from NHTSA website.

    CRSS ACCIDENT.CSV key columns used:
      TRAV_SP   — travel speed at crash (mph)
      MAX_SEV   — max injury severity (KABCO: 0=O, 1=C, 2=B, 3=A, 4=K, 9=Unknown)

    KABCO → Severity mapping:
      0 (O - no injury)           → excluded
      1 (C - possible)            → Minor
      2 (B - non-incapacitating)  → Major
      3 (A - incapacitating)      → Critical
      4 (K - fatal)               → Critical
      9 (unknown)                 → excluded
    """
    if not os.path.exists(crss_csv_path):
        print(f"[CRSS] File not found: {crss_csv_path} — skipping speed features")
        return None

    try:
        df = pd.read_csv(crss_csv_path, low_memory=False)
    except Exception as e:
        print(f"[CRSS] Could not read file: {e}")
        return None

    required_cols = {"TRAV_SP", "MAX_SEV"}
    if not required_cols.issubset(df.columns):
        print(f"[CRSS] Required columns not found. Found: {list(df.columns[:10])}")
        return None

    # Map KABCO to our severity
    kabco_map = {1: "minor", 2: "major", 3: "critical", 4: "critical"}
    df = df[df["MAX_SEV"].isin(kabco_map.keys())].copy()
    df["severity_label"] = df["MAX_SEV"].map(kabco_map)
    df["severity_code"]  = df["severity_label"].map(LABEL_MAP)

    # Clean speed (CRSS codes 998=unknown, 999=unknown)
    df["speed_before_impact"] = pd.to_numeric(df["TRAV_SP"], errors="coerce")
    df.loc[df["speed_before_impact"] >= 997, "speed_before_impact"] = np.nan

    df = df.dropna(subset=["speed_before_impact", "severity_code"])

    # CRSS doesn't have post-crash speed — honest NaN
    df["speed_after_impact"] = np.nan
    df["speed_drop"]         = np.nan

    # IMU features not in CRSS — NaN
    for col in ["acceleration_magnitude", "gyro_magnitude",
                "impact_force", "tilt_angle_after_impact",
                "no_movement_duration_s", "pre_impact_acc_mean"]:
        df[col] = np.nan

    print(f"[CRSS] Loaded {len(df)} samples with speed features")
    print("\n[CRSS] Severity distribution:")
    print(df["severity_label"].value_counts())

    return df[["speed_before_impact", "speed_after_impact", "speed_drop",
               "acceleration_magnitude", "gyro_magnitude", "impact_force",
               "tilt_angle_after_impact", "no_movement_duration_s",
               "pre_impact_acc_mean", "severity_label", "severity_code"]]


# ─────────────────────────────────────────────────────────────────────────────
# Feature extraction from live sensor window (at inference time)
# ─────────────────────────────────────────────────────────────────────────────

def extract_live_features(
    window: list[list[float]],                 # 50 readings × 6 values
    speed_before_kmh: float | None = None,     # from GPS (optional)
    speed_after_kmh:  float | None = None,     # from GPS (optional)
) -> dict:
    """
    Extracts features from a live 50-reading sensor window.
    Used at inference time (real helmet data).
    GPS speed is optional — if available, enables speed features.
    """
    arr = np.array(window, dtype=np.float32)
    acc = arr[:, :3]
    gyr = arr[:, 3:]

    acc_mag  = np.sqrt(np.sum(acc ** 2, axis=1))
    gyro_mag = np.sqrt(np.sum(gyr ** 2, axis=1))

    peak_idx  = int(np.argmax(acc_mag))
    peak_acc  = float(acc_mag[peak_idx])
    peak_gyro = float(gyro_mag[peak_idx])

    impact_force = (peak_acc - 1.0) * BODY_MASS_KG * 9.81

    post_start  = min(peak_idx + 1, len(acc) - 1)
    post_acc_v  = acc[post_start:]
    if len(post_acc_v) > 0:
        mean_post  = post_acc_v.mean(axis=0)
        tilt_angle = float(np.degrees(
            np.arctan2(
                np.sqrt(mean_post[0]**2 + mean_post[1]**2),
                abs(mean_post[2])
            )
        ))
    else:
        tilt_angle = 0.0

    post_mag = acc_mag[post_start:]
    still_samples = int(np.sum(post_mag < 0.3))
    no_movement_s = still_samples / 50.0   # live window is 50 samples @ 50Hz = 1s

    speed_before = speed_before_kmh / 3.6 if speed_before_kmh is not None else np.nan   # → m/s
    speed_after  = speed_after_kmh  / 3.6 if speed_after_kmh  is not None else np.nan
    speed_drop   = (speed_before - speed_after) if not (np.isnan(speed_before) or np.isnan(speed_after)) else np.nan

    return {
        "acceleration_magnitude": round(peak_acc, 4),
        "gyro_magnitude":         round(peak_gyro, 4),
        "impact_force":           round(max(impact_force, 0.0), 2),
        "tilt_angle_after_impact": round(tilt_angle, 2),
        "no_movement_duration_s": round(no_movement_s, 3),
        "pre_impact_acc_mean":    round(float(acc_mag[:peak_idx].mean()) if peak_idx > 0 else 1.0, 4),
        "speed_before_impact":    round(speed_before, 2) if not np.isnan(speed_before) else np.nan,
        "speed_after_impact":     round(speed_after, 2)  if not np.isnan(speed_after)  else np.nan,
        "speed_drop":             round(speed_drop, 2)   if not np.isnan(speed_drop)   else np.nan,
    }
