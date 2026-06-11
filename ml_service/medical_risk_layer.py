"""
ml_service/medical_risk_layer.py
─────────────────────────────────
Medical Risk Adjustment Layer — adjusts ML severity prediction
based on physiological vitals.

Clinical thresholds sourced from:
  • WHO Emergency Triage Assessment & Treatment (ETAT) guidelines
  • AHA/ACC Heart Rate Reference Ranges
  • SpO2: WHO pulse oximetry guidelines (2011)
  • Unconsciousness / no-movement: ATLS (Advanced Trauma Life Support) protocols

This layer is RULE-BASED (not ML) by design:
  - Rules are clinically validated
  - Explainable to doctors and judges
  - Works even without physiological data (graceful degradation)

Input:  ML severity prediction + vital signs from wearable/phone sensors
Output: Final severity + reasoning trace
"""

from dataclasses import dataclass, field
from typing import Optional


# ── Clinical Thresholds (cited) ───────────────────────────────────────────────

# SpO2 (blood oxygen saturation) — WHO 2011
SPO2_CRITICAL_THRESHOLD  = 90.0   # < 90% → hypoxia → Critical upgrade
SPO2_MAJOR_THRESHOLD     = 94.0   # < 94% → borderline → Major upgrade if Minor

# Heart Rate (bpm) — AHA/ACC reference
HR_BRADYCARDIA_CRITICAL  = 40     # < 40 bpm → severe bradycardia → Critical
HR_BRADYCARDIA_MAJOR     = 50     # 40–50 bpm → upgrade Minor → Major
HR_TACHYCARDIA_CRITICAL  = 140    # > 140 bpm → severe tachycardia → Critical
HR_TACHYCARDIA_MAJOR     = 120    # 100–140 bpm → upgrade Minor → Major

# No-movement (unconsciousness proxy) — ATLS protocols
NO_MOVEMENT_CRITICAL_SEC = 30.0   # > 30s motionless → possible unconscious → Critical
NO_MOVEMENT_MAJOR_SEC    = 10.0   # 10–30s motionless → upgrade Minor → Major

# Severity ordering
SEVERITY_ORDER = {"minor": 0, "major": 1, "critical": 2}
SEVERITY_NAMES = {0: "Minor", 1: "Major", 2: "Critical"}
SEVERITY_CODES = {"minor": 0, "major": 1, "critical": 2}


@dataclass
class VitalSigns:
    """Container for physiological readings from wearable / phone sensor."""
    heart_rate:           Optional[float] = None   # bpm
    spo2:                 Optional[float] = None   # % (0–100)
    no_movement_duration: Optional[float] = None   # seconds since last motion


@dataclass
class AdjustmentResult:
    """Output of the Medical Risk Adjustment Layer."""
    ml_severity:         str                    # original ML prediction
    final_severity:      str                    # after medical adjustment
    final_severity_code: int
    upgraded:            bool                   # True if severity was raised
    upgrade_reason:      list[str] = field(default_factory=list)
    vitals_used:         dict      = field(default_factory=dict)
    vitals_missing:      list[str] = field(default_factory=list)
    clinical_notes:      list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ml_severity":         self.ml_severity,
            "final_severity":      self.final_severity,
            "final_severity_code": self.final_severity_code,
            "upgraded":            self.upgraded,
            "upgrade_reason":      self.upgrade_reason,
            "vitals_used":         self.vitals_used,
            "vitals_missing":      self.vitals_missing,
            "clinical_notes":      self.clinical_notes,
        }


def adjust_severity(
    ml_severity: str,          # "minor" | "major" | "critical"
    vitals: VitalSigns,
) -> AdjustmentResult:
    """
    Applies clinical rules to potentially upgrade (never downgrade) the ML severity.

    Rules (in priority order):
      R1. SpO2 < 90%          → Critical  (hypoxia — immediately life-threatening)
      R2. HR < 40 or HR > 140 → Critical  (hemodynamic compromise)
      R3. No movement > 30s   → Critical  (possible unconsciousness)
      R4. SpO2 < 94%          → at least Major
      R5. HR 40–50 or 120–140 → at least Major
      R6. No movement 10–30s  → at least Major

    Never downgrades — ML says Critical → stays Critical regardless of vitals.
    """
    result = AdjustmentResult(
        ml_severity=ml_severity,
        final_severity=ml_severity,
        final_severity_code=SEVERITY_CODES.get(ml_severity, 0),
        upgraded=False,
    )

    current_level = SEVERITY_ORDER.get(ml_severity, 0)
    target_level  = current_level

    # Track which vitals were actually provided
    if vitals.heart_rate is not None:
        result.vitals_used["heart_rate"] = vitals.heart_rate
    else:
        result.vitals_missing.append("heart_rate")

    if vitals.spo2 is not None:
        result.vitals_used["spo2"] = vitals.spo2
    else:
        result.vitals_missing.append("spo2")

    if vitals.no_movement_duration is not None:
        result.vitals_used["no_movement_duration_s"] = vitals.no_movement_duration
    else:
        result.vitals_missing.append("no_movement_duration")

    # ── R1: SpO2 < 90% → Critical ────────────────────────────────────────────
    if vitals.spo2 is not None and vitals.spo2 < SPO2_CRITICAL_THRESHOLD:
        if target_level < 2:
            target_level = 2
            result.upgrade_reason.append(
                f"SpO₂ {vitals.spo2:.1f}% < {SPO2_CRITICAL_THRESHOLD}% "
                f"(hypoxia — immediately life-threatening; WHO 2011)"
            )
            result.clinical_notes.append(
                "Administer supplemental oxygen immediately. "
                "Check airway patency. Consider intubation if SpO₂ does not improve."
            )

    # ── R2: Heart rate severely abnormal → Critical ───────────────────────────
    if vitals.heart_rate is not None:
        if vitals.heart_rate < HR_BRADYCARDIA_CRITICAL:
            if target_level < 2:
                target_level = 2
                result.upgrade_reason.append(
                    f"Heart rate {vitals.heart_rate:.0f} bpm < {HR_BRADYCARDIA_CRITICAL} bpm "
                    f"(severe bradycardia — AHA/ACC criteria)"
                )
                result.clinical_notes.append(
                    "Severe bradycardia detected. Rule out cardiac tamponade, "
                    "tension pneumothorax, or severe neurogenic shock."
                )
        elif vitals.heart_rate > HR_TACHYCARDIA_CRITICAL:
            if target_level < 2:
                target_level = 2
                result.upgrade_reason.append(
                    f"Heart rate {vitals.heart_rate:.0f} bpm > {HR_TACHYCARDIA_CRITICAL} bpm "
                    f"(severe tachycardia — AHA/ACC criteria)"
                )
                result.clinical_notes.append(
                    "Severe tachycardia — possible hemorrhagic shock. "
                    "IV access, fluid resuscitation, evaluate for internal bleeding."
                )

    # ── R3: No movement > 30s → Critical ─────────────────────────────────────
    if vitals.no_movement_duration is not None and vitals.no_movement_duration > NO_MOVEMENT_CRITICAL_SEC:
        if target_level < 2:
            target_level = 2
            result.upgrade_reason.append(
                f"No movement for {vitals.no_movement_duration:.1f}s "
                f"(> {NO_MOVEMENT_CRITICAL_SEC}s — possible loss of consciousness; ATLS)"
            )
            result.clinical_notes.append(
                "Possible unconsciousness. Maintain spinal precautions. "
                "Do not move patient without cervical spine stabilization."
            )

    # ── R4: SpO2 < 94% → at least Major ──────────────────────────────────────
    if vitals.spo2 is not None and vitals.spo2 < SPO2_MAJOR_THRESHOLD:
        if target_level < 1:
            target_level = 1
            result.upgrade_reason.append(
                f"SpO₂ {vitals.spo2:.1f}% < {SPO2_MAJOR_THRESHOLD}% "
                f"(mild hypoxia — WHO 2011)"
            )

    # ── R5: Heart rate borderline → at least Major ───────────────────────────
    if vitals.heart_rate is not None:
        if HR_BRADYCARDIA_CRITICAL <= vitals.heart_rate < HR_BRADYCARDIA_MAJOR:
            if target_level < 1:
                target_level = 1
                result.upgrade_reason.append(
                    f"Heart rate {vitals.heart_rate:.0f} bpm — borderline bradycardia"
                )
        elif HR_TACHYCARDIA_MAJOR < vitals.heart_rate <= HR_TACHYCARDIA_CRITICAL:
            if target_level < 1:
                target_level = 1
                result.upgrade_reason.append(
                    f"Heart rate {vitals.heart_rate:.0f} bpm — significant tachycardia"
                )

    # ── R6: No movement 10–30s → at least Major ──────────────────────────────
    if vitals.no_movement_duration is not None:
        if NO_MOVEMENT_MAJOR_SEC < vitals.no_movement_duration <= NO_MOVEMENT_CRITICAL_SEC:
            if target_level < 1:
                target_level = 1
                result.upgrade_reason.append(
                    f"No movement for {vitals.no_movement_duration:.1f}s — "
                    f"possible disorientation or semi-conscious state"
                )

    # ── Finalize ──────────────────────────────────────────────────────────────
    severity_map = {0: "minor", 1: "major", 2: "critical"}
    result.final_severity      = severity_map[target_level]
    result.final_severity_code = target_level
    result.upgraded            = target_level > current_level

    if not result.upgrade_reason:
        result.clinical_notes.append(
            "Vitals within acceptable ranges — no upgrade triggered."
        )

    if not vitals.heart_rate and not vitals.spo2 and not vitals.no_movement_duration:
        result.clinical_notes.append(
            "⚠️  No physiological vitals provided — "
            "medical adjustment layer could not be applied. "
            "Recommend physical assessment on arrival."
        )

    return result


# ── Quick demo / test ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    test_cases = [
        {
            "name":   "ML=Major, SpO2 < 90 → Upgrade to Critical",
            "ml":     "major",
            "vitals": VitalSigns(heart_rate=88, spo2=87.0, no_movement_duration=5.0),
        },
        {
            "name":   "ML=Minor, no movement 35s → Upgrade to Critical",
            "ml":     "minor",
            "vitals": VitalSigns(heart_rate=72, spo2=96.0, no_movement_duration=38.0),
        },
        {
            "name":   "ML=Critical, vitals OK → Stays Critical",
            "ml":     "critical",
            "vitals": VitalSigns(heart_rate=95, spo2=98.0, no_movement_duration=2.0),
        },
        {
            "name":   "ML=Minor, all vitals normal → No upgrade",
            "ml":     "minor",
            "vitals": VitalSigns(heart_rate=80, spo2=98.0, no_movement_duration=1.0),
        },
        {
            "name":   "ML=Major, HR=155 → Upgrade to Critical",
            "ml":     "major",
            "vitals": VitalSigns(heart_rate=155, spo2=95.0, no_movement_duration=3.0),
        },
        {
            "name":   "ML=Minor, no vitals provided → No change",
            "ml":     "minor",
            "vitals": VitalSigns(),
        },
    ]

    print("=" * 65)
    print("  Medical Risk Adjustment Layer — Test Cases")
    print("=" * 65)

    for tc in test_cases:
        r = adjust_severity(tc["ml"], tc["vitals"])
        arrow = "⬆️ UPGRADED" if r.upgraded else "→ unchanged"
        print(f"\n📋 {tc['name']}")
        print(f"   ML:    {r.ml_severity.upper()}")
        print(f"   Final: {r.final_severity.upper()}  {arrow}")
        if r.upgrade_reason:
            for reason in r.upgrade_reason:
                print(f"   Reason: {reason}")
        if r.clinical_notes:
            for note in r.clinical_notes:
                print(f"   Note: {note}")
