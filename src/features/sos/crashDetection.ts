export type SensorSample = {
  lat: number;
  lon: number;
  speedKmh: number;
  accelerationG: number; // magnitude of sudden change (simulated)
  orientation: 'normal' | 'flipped';
  vibration: number; // 0..100
};

export type CrashSeverity = 'minor' | 'major' | 'critical';

export type CrashDetection = {
  crashed: boolean;
  severity: CrashSeverity;
  reasons: string[];
};

export function detectCrash(prev: SensorSample | null, cur: SensorSample): CrashDetection {
  const reasons: string[] = [];

  const speedDrop = prev ? Math.max(0, prev.speedKmh - cur.speedKmh) : 0;
  const suddenStop = speedDrop >= 25 && cur.speedKmh <= 10;
  const highImpact = cur.vibration >= 70 || cur.accelerationG >= 2.2;
  const flipped = cur.orientation === 'flipped';

  if (suddenStop) reasons.push(`Sudden speed drop (${speedDrop.toFixed(0)} km/h)`);
  if (cur.accelerationG >= 1.6) reasons.push(`High acceleration change (${cur.accelerationG.toFixed(1)}g)`);
  if (cur.vibration >= 60) reasons.push(`High vibration (${cur.vibration.toFixed(0)}/100)`);
  if (flipped) reasons.push('Abnormal orientation (flipped)');

  const crashed = (suddenStop && (highImpact || flipped)) || (highImpact && flipped);

  let severity: CrashSeverity = 'minor';
  if (crashed) {
    if ((highImpact && flipped) || cur.vibration >= 85 || cur.accelerationG >= 3.0) severity = 'critical';
    else if (highImpact || suddenStop) severity = 'major';
    else severity = 'minor';
  }

  return { crashed, severity, reasons };
}

// ============================================================================
// ML BACKEND INTEGRATION
// ============================================================================

export type MLSeverityResponse = {
  final_severity: string;
  final_severity_code: number;
  triage_color: string;
  triage_action: string;
  clinical_notes: string[];
  head_trauma_risk?: { level: string; confidence: number };
  spine_injury_risk?: { level: string; confidence: number };
  lower_body_injury_risk?: { level: string; confidence: number };
  hospital_alert?: { priority: string; prepare: string[] };
};

/**
 * The ML model expects a real 50-reading sensor window (1 second at 50Hz).
 * Since the frontend simulator only provides a single simulated G-force scalar,
 * we mathematically generate a synthetic window that matches the simulated impact.
 */
function simulateSensorWindow(peakG: number): number[][] {
  const window: number[][] = [];
  for (let i = 0; i < 50; i++) {
    if (i >= 20 && i <= 25) {
      // The impact spike (distribute the G force across X and Y)
      window.push([peakG * 0.7, peakG * 0.7, 1.0, 150.0, -100.0, 50.0]);
    } else if (i > 25) {
      // Post impact (lying flat)
      window.push([0.1, 0.1, -1.0, 0.0, 0.0, 0.0]);
    } else {
      // Normal riding before impact
      window.push([0.05, 0.1, 1.0, 5.0, 2.0, -1.0]);
    }
  }
  return window;
}

/**
 * Calls the FastAPI backend running the trained Random Forest model + Medical Layer.
 */
export async function analyzeSeverityWithML(
  sample: SensorSample,
  speedBeforeKmh: number,
  healthContext?: { heartRate?: number; spo2?: number; noMovementDuration?: number }
): Promise<MLSeverityResponse | null> {
  try {
    const window = simulateSensorWindow(sample.accelerationG);
    
    const payload = {
      readings: window,
      speed_before_kmh: speedBeforeKmh,
      speed_after_kmh: sample.speedKmh,
      heart_rate: healthContext?.heartRate || null,
      spo2: healthContext?.spo2 || null,
      no_movement_duration: healthContext?.noMovementDuration || null
    };

    const res = await fetch('http://localhost:8001/predict/severity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('ML API Error:', res.statusText);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Failed to reach ML backend:', err);
    return null;
  }
}
