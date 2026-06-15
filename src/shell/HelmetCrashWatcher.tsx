import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { listenHelmet } from '../data/helmet';
import { createSosRequest, getActiveSosForUser } from '../data/sos';
import { predictLive } from '../features/sos/liveCrashPrediction';

/**
 * HelmetCrashWatcher
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges the smart helmet's crashEvent into the existing SOS flow.
 *
 * Flow:
 *   ESP32 helmet detects crash (vibration > 2000 AND |Δa| > 8g)
 *      └→ writes accidentStatus = "ACCIDENT ALERT" in its /data JSON
 *
 *   helmet-bridge.mjs (laptop) sees that, writes to Firestore:
 *      helmets/{uid}.crashEvent = { at, severity, lat, lon, channel: 'wifi-bridge' }
 *
 *   This component (mounted globally in RootLayout) sees the new crashEvent
 *   and calls createSosRequest({ source: 'hardware', incidentType: 'crash', ... }).
 *
 *   GlobalSosWatcher (already in RootLayout) then sees the new sosRequest doc
 *   and navigates the user to /app/sos — the same countdown + helper-dispatch
 *   flow as a manually-pressed SOS.
 *
 * Live Sensor Crash Detection:
 *   In addition to crashEvent, this component also monitors live helmet
 *   telemetry. When the predictLive() function returns risk === 'critical'
 *   (e.g. vibration at 4095, high acceleration, etc.), it auto-creates
 *   an SOS with a 5-second auto-trigger — matching the hardware's own
 *   crash detection thresholds.
 *
 * Safety:
 *   - Only fires once per unique `crashEvent.at` timestamp (de-dup via ref).
 *   - Only fires if the crashEvent is fresh (< 60 s old). Prevents old test
 *     data from auto-triggering when a user logs back in.
 *   - Live sensor crash: requires 2 consecutive critical readings (debounce)
 *     to avoid false positives from transient spikes.
 *   - Does nothing if the user already has an active SOS — createSosRequest
 *     itself has duplicate-prevention, but we short-circuit early too.
 *   - Doesn't touch any existing logic. Adds a new code path only.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const HelmetCrashWatcher = () => {
  const { user } = useAuth();
  const seenAtRef = useRef<number | null>(null);
  /** Tracks consecutive critical readings for live sensor crash detection. */
  const criticalCountRef = useRef(0);
  /** Prevents duplicate live-sensor SOS triggers (one per "critical episode"). */
  const liveCrashFiredRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;

    return listenHelmet(user.uid, (helmet) => {
      if (!helmet) return;

      // ── Path 1: Explicit crashEvent from hardware bridge ─────────────────
      const ce = helmet.crashEvent;
      if (ce) {
        const eventMs = ce.at instanceof Date ? ce.at.getTime() : new Date(ce.at as any).getTime();
        if (Number.isFinite(eventMs) && seenAtRef.current !== eventMs) {
          const ageMs = Date.now() - eventMs;
          seenAtRef.current = eventMs;

          if (ageMs <= 60_000) {
            void (async () => {
              try {
                const existing = await getActiveSosForUser(user.uid);
                if (existing) {
                  console.log('[HelmetCrashWatcher] crash detected but active SOS already exists, skipping');
                  return;
                }

                const lat = typeof ce.lat === 'number' ? ce.lat : helmet.lat;
                const lon = typeof ce.lon === 'number' ? ce.lon : helmet.lon;
                const hasLoc = typeof lat === 'number' && typeof lon === 'number';

                console.log('[HelmetCrashWatcher] 🚨 helmet crash detected, creating SOS', {
                  severity: ce.severity, lat, lon,
                });

                await createSosRequest({
                  victimId: user.uid,
                  status: 'countdown',
                  severity: ce.severity ?? 'major',
                  source: 'hardware',
                  countdown: 5,
                  incidentType: 'crash',
                  location: hasLoc ? { lat: lat!, lon: lon! } : null as any,
                  hasValidLocation: hasLoc,
                  isApproximate: false,
                  radiusKm: 3,
                });
              } catch (e) {
                console.error('[HelmetCrashWatcher] failed to create SOS:', e);
              }
            })();
          }
        }
      }

      // ── Path 2: Live sensor telemetry → critical risk = crash ────────────
      const pred = predictLive(helmet);

      if (pred.risk === 'critical') {
        criticalCountRef.current += 1;

        // Require 2+ consecutive critical ticks to debounce transient spikes
        if (criticalCountRef.current >= 2 && !liveCrashFiredRef.current) {
          liveCrashFiredRef.current = true;

          console.log('[HelmetCrashWatcher] 🚨 LIVE SENSOR CRASH: risk=critical, auto-creating SOS in 5s', {
            confidence: pred.confidence,
            severity: pred.severity,
            reasons: pred.reasons,
          });

          void (async () => {
            try {
              const existing = await getActiveSosForUser(user.uid);
              if (existing) {
                console.log('[HelmetCrashWatcher] live crash but active SOS already exists, skipping');
                return;
              }

              const lat = helmet.lat;
              const lon = helmet.lon;
              const hasLoc = typeof lat === 'number' && typeof lon === 'number';

              await createSosRequest({
                victimId: user.uid,
                status: 'countdown',
                severity: pred.severity ?? 'critical',
                source: 'hardware',
                countdown: 5,
                incidentType: 'crash',
                location: hasLoc ? { lat: lat!, lon: lon! } : null as any,
                hasValidLocation: hasLoc,
                isApproximate: false,
                radiusKm: 3,
              });
            } catch (e) {
              console.error('[HelmetCrashWatcher] live crash SOS creation failed:', e);
            }
          })();
        }
      } else {
        // Risk dropped below critical → reset debounce so it can fire again
        // if another critical episode occurs later
        criticalCountRef.current = 0;
        liveCrashFiredRef.current = false;
      }
    });
  }, [user?.uid]);

  return null;
};
