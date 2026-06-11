"""
ml_service/test_manual.py
─────────────────────────
Tests the ML service with manual inputs — no Arduino needed.
Shows prediction results and accuracy on known test cases.

Run:
  python test_manual.py
"""

import requests
import json

ML_URL = "http://localhost:8001"

def make_window(acc_x, acc_y, acc_z, gyr_x, gyr_y, gyr_z, count=50):
    """Generate 50 identical readings to simulate a sustained condition."""
    return [[acc_x, acc_y, acc_z, gyr_x, gyr_y, gyr_z]] * count

def predict(name, readings):
    try:
        r = requests.post(f"{ML_URL}/predict", json={"readings": readings}, timeout=5)
        result = r.json()
        icon = "🚨" if result["prediction"] == "accident" else "✅"
        print(f"\n{icon}  Test: {name}")
        print(f"   Prediction : {result['prediction'].upper()}")
        print(f"   Confidence : {result['confidence']:.1%}")
        print(f"   Severity   : {result['severity']}")
        print(f"   Mode       : {result['mode']}")
        print(f"   Trigger SOS: {result['trigger_sos']}")
        if result.get("debug"):
            d = result["debug"]
            print(f"   Peak Acc   : {d.get('peak_acc_g', '?')} G")
            print(f"   Peak Gyro  : {d.get('peak_gyro_dps', '?')} °/s")
        return result
    except Exception as e:
        print(f"❌ Error for '{name}': {e}")
        return None

# ─────────────────────────────────────────────────────────────────────────────
print("="*60)
print("  Aarogya Raksha — ML Accident Detection Manual Tests")
print("="*60)

# Check service health first
try:
    health = requests.get(f"{ML_URL}/health").json()
    print(f"\n✅ Service is running!")
    print(f"   Model mode: {health['model_mode']}")
    print(f"   Model loaded: {health['model_loaded']}")
except:
    print("❌ ML service is NOT running! Start it first:")
    print("   uvicorn main:app --port 8001")
    exit(1)

print("\n" + "─"*60)
print("  TEST CASES")
print("─"*60)

# ── Test 1: Normal riding (low acceleration, low rotation) ────────────────
predict(
    name = "Normal Riding (low G, low rotation) — Expected: NORMAL",
    readings = make_window(
        acc_x=0.05, acc_y=0.10, acc_z=1.0,    # ~1G gravity, normal
        gyr_x=2.0,  gyr_y=1.5,  gyr_z=0.8     # gentle rotation
    )
)

# ── Test 2: Speed bump (small spike, not an accident) ──────────────────────
predict(
    name = "Speed Bump (1.8G spike) — Expected: NORMAL",
    readings = make_window(
        acc_x=1.5, acc_y=0.5, acc_z=0.8,
        gyr_x=10.0, gyr_y=5.0, gyr_z=3.0
    )
)

# ── Test 3: Crash (high G + high rotation) ────────────────────────────────
predict(
    name = "Crash - High Impact (4G + 300°/s rotation) — Expected: ACCIDENT",
    readings = make_window(
        acc_x=3.8, acc_y=-2.1, acc_z=0.3,
        gyr_x=280.0, gyr_y=-120.0, gyr_z=90.0
    )
)

# ── Test 4: Critical crash (very high G) ─────────────────────────────────
predict(
    name = "Critical Crash (5.5G) — Expected: ACCIDENT (CRITICAL)",
    readings = make_window(
        acc_x=5.0, acc_y=-2.5, acc_z=0.1,
        gyr_x=350.0, gyr_y=-200.0, gyr_z=150.0
    )
)

# ── Test 5: Skid (moderate G + very high rotation) ────────────────────────
predict(
    name = "Bike Skid (2G + 250°/s) — Expected: ACCIDENT (MEDIUM)",
    readings = make_window(
        acc_x=1.8, acc_y=1.2, acc_z=0.5,
        gyr_x=220.0, gyr_y=80.0, gyr_z=50.0
    )
)

# ── Test 6: Walking (human fall pattern, ~2G) ─────────────────────────────
predict(
    name = "Person Walking Fast (1.5G) — Expected: NORMAL",
    readings = make_window(
        acc_x=0.8, acc_y=1.2, acc_z=0.9,
        gyr_x=30.0, gyr_y=20.0, gyr_z=10.0
    )
)

# ── Test 7: Helmet dropped (spike but no rotation) ────────────────────────
predict(
    name = "Helmet Dropped (3G but low rotation) — Expected: depends on model",
    readings = make_window(
        acc_x=2.8, acc_y=0.5, acc_z=0.2,
        gyr_x=15.0, gyr_y=8.0, gyr_z=5.0
    )
)

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  ACCURACY SUMMARY (Demo Mode)")
print("="*60)
print("""
  ┌─────────────────────────────────┬──────────┬──────────┐
  │ Test Case                       │ Expected │  Result  │
  ├─────────────────────────────────┼──────────┼──────────┤
  │ Normal Riding                   │  NORMAL  │  Check ↑ │
  │ Speed Bump (1.8G)               │  NORMAL  │  Check ↑ │
  │ Crash (4G + 300°/s)             │ ACCIDENT │  Check ↑ │
  │ Critical Crash (5.5G)           │ ACCIDENT │  Check ↑ │
  │ Bike Skid (2G + 250°/s)         │ ACCIDENT │  Check ↑ │
  │ Walking Fast                    │  NORMAL  │  Check ↑ │
  │ Helmet Dropped (3G, low rotate) │  GREY    │  Check ↑ │
  └─────────────────────────────────┴──────────┴──────────┘

  NOTE: Current mode = DEMO (physics-based rules)
        Train on SisFall dataset → switch to LSTM for ~95% accuracy
""")
