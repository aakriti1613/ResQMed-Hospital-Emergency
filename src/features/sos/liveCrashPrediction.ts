/**
 * liveCrashPrediction.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Adapter that maps a live HelmetDevice doc → SensorSample shape, runs the
 * EXISTING trained crash detector (`detectCrash` in crashDetection.ts) and
 * returns a UI-friendly summary.
 *
 * Why a separate file:
 *   - Doesn't touch existing logic (per integration constraint).
 *   - Lets the dashboard / settings show a continuous "Live Crash Risk" badge
 *     using the SAME thresholds the trained model uses, without rebuilding
 *     anything.
 *
 * Mapping notes (helmet sketch → SensorSample):
 *   helmet.vibration   (0..4095 analog)   → vibration 0..100 (normalized)
 *   helmet.accel.{x,y,z} (m/s², Adafruit) → accelerationG (magnitude / 9.81)
 *   |az| (gravity axis)                    → orientation 'flipped' if |az|<5
 *   speedKmh — not exposed by helmet       → 0  (the rule still fires on
 *                                                impact + flip without speed)
 *
 * Once the user runs the Python ML service and sets VITE_ML_SEVERITY_URL,
 * the dashboard can additionally POST the raw fields for the Random-Forest
 * + medical-risk severity. Until then this rule layer is the live prediction.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { HelmetDevice } from '../../data/helmet';
import { detectCrash, type SensorSample, type CrashDetection } from './crashDetection';

export type LiveCrashRisk =
  | 'low'
  | 'elevated'
  | 'high'
  | 'critical';

export type LivePrediction = {
  /** Bucketed risk label for the UI. */
  risk: LiveCrashRisk;
  /** 0..100 — distance to the rule-layer thresholds. */
  confidence: number;
  /** Severity coming out of detectCrash (only meaningful when crashed=true). */
  severity: CrashDetection['severity'];
  /** True when the rule layer says this IS a crash right now. */
  crashed: boolean;
  /** Human-readable reasons (passed through from detectCrash). */
  reasons: string[];
  /** The mapped sample that fed detectCrash — useful for debugging on screen. */
  sample: SensorSample;
};

function vibration0to100(raw?: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  // ESP32 analog is 12-bit (0..4095). Saturate above 4095 just in case.
  return Math.max(0, Math.min(100, (raw / 4095) * 100));
}

function accelerationG(accel?: HelmetDevice['accel']): number {
  if (!accel) return 0;
  const x = accel.x ?? 0;
  const y = accel.y ?? 0;
  const z = accel.z ?? 0;
  // Adafruit MPU6050 reports m/s². At rest, |a| ≈ 9.81 (just gravity).
  // We report the *deviation* from gravity in g (so 0 g at rest, 1 g at 2×g).
  const mag = Math.sqrt(x * x + y * y + z * z);
  return Math.max(0, (mag - 9.81) / 9.81);
}

function orientationFromAccel(accel?: HelmetDevice['accel']): 'normal' | 'flipped' {
  // Gravity normally pulls strongly on one axis (~+9.8 in az for upright).
  // If the dominant axis flips sign or magnitude collapses, treat as flipped.
  if (!accel) return 'normal';
  const z = accel.z ?? 9.81;
  return z < 4 ? 'flipped' : 'normal';
}

export function helmetToSensorSample(helmet: HelmetDevice | null): SensorSample {
  if (!helmet) {
    return { lat: 0, lon: 0, speedKmh: 0, accelerationG: 0, orientation: 'normal', vibration: 0 };
  }
  return {
    lat: helmet.lat ?? 0,
    lon: helmet.lon ?? 0,
    speedKmh: 0,           // not surfaced by the helmet; rule still works without it
    accelerationG: accelerationG(helmet.accel),
    orientation: orientationFromAccel(helmet.accel),
    vibration: vibration0to100(helmet.vibration),
  };
}

/**
 * Compute a UI-friendly 0..100 confidence based on how close the current
 * sample is to the trained-rule thresholds (vibration ≥ 60, accel ≥ 1.6).
 */
function confidencePct(sample: SensorSample): number {
  const vibScore = Math.min(sample.vibration / 60, 1) * 60;       // up to 60 pts
  const accScore = Math.min(sample.accelerationG / 1.6, 1) * 40;  // up to 40 pts
  const flipBonus = sample.orientation === 'flipped' ? 15 : 0;
  return Math.max(0, Math.min(100, vibScore + accScore + flipBonus));
}

function riskFromConfidence(c: number): LiveCrashRisk {
  if (c >= 85) return 'critical';
  if (c >= 60) return 'high';
  if (c >= 30) return 'elevated';
  return 'low';
}

export function predictLive(helmet: HelmetDevice | null, prev?: SensorSample): LivePrediction {
  const sample = helmetToSensorSample(helmet);
  const result = detectCrash(prev ?? null, sample);
  const confidence = confidencePct(sample);
  // If the ESP32 has already flagged an accident in the helmet doc, treat that
  // as ground truth and push confidence to the top.
  const helmetSaysCrash = helmet?.crashEvent != null;
  return {
    risk: helmetSaysCrash ? 'critical' : riskFromConfidence(confidence),
    confidence: helmetSaysCrash ? 100 : Math.round(confidence),
    severity: helmetSaysCrash ? (helmet?.crashEvent?.severity ?? 'major') : result.severity,
    crashed: helmetSaysCrash || result.crashed,
    reasons: result.reasons,
    sample,
  };
}

/** Pure UI helpers. */
export function riskColor(r: LiveCrashRisk): string {
  switch (r) {
    case 'critical': return '#ef4444';
    case 'high':     return '#f97316';
    case 'elevated': return '#facc15';
    case 'low':      return '#10b981';
  }
}

export function riskLabel(r: LiveCrashRisk): string {
  switch (r) {
    case 'critical': return 'Critical risk';
    case 'high':     return 'High risk';
    case 'elevated': return 'Elevated';
    case 'low':      return 'Low risk';
  }
}

export function googleMapsUrl(lat?: number, lon?: number): string | null {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

export function lastSeenLabel(lastPingAt?: Date): string {
  if (!lastPingAt) return 'No pings yet';
  const ms = Date.now() - lastPingAt.getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60)        return `${s}s ago`;
  if (s < 3600)      return `${Math.floor(s / 60)} min ago`;
  if (s < 86400)     return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
