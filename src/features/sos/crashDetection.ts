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

