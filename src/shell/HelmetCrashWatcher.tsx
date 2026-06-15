import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { listenHelmet } from '../data/helmet';
import { createSosRequest, getActiveSosForUser } from '../data/sos';

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
 * Safety:
 *   - Only fires once per unique `crashEvent.at` timestamp (de-dup via ref).
 *   - Only fires if the crashEvent is fresh (< 60 s old). Prevents old test
 *     data from auto-triggering when a user logs back in.
 *   - Does nothing if the user already has an active SOS — createSosRequest
 *     itself has duplicate-prevention, but we short-circuit early too.
 *   - Doesn't touch any existing logic. Adds a new code path only.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const HelmetCrashWatcher = () => {
  const { user } = useAuth();
  const seenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    return listenHelmet(user.uid, (helmet) => {
      const ce = helmet?.crashEvent;
      if (!ce) return;

      const eventMs = ce.at instanceof Date ? ce.at.getTime() : new Date(ce.at as any).getTime();
      if (!Number.isFinite(eventMs)) return;

      // De-dup: same crashEvent timestamp we've already acted on -> ignore.
      if (seenAtRef.current === eventMs) return;

      // Freshness gate: only auto-trigger if the crash happened within the last minute.
      const ageMs = Date.now() - eventMs;
      if (ageMs > 60_000) {
        seenAtRef.current = eventMs; // remember, but don't fire stale events
        return;
      }

      seenAtRef.current = eventMs;

      // If something is already active for this user, let it be.
      void (async () => {
        try {
          const existing = await getActiveSosForUser(user.uid);
          if (existing) {
            console.log('[HelmetCrashWatcher] crash detected but active SOS already exists, skipping');
            return;
          }

          const lat = typeof ce.lat === 'number' ? ce.lat : helmet?.lat;
          const lon = typeof ce.lon === 'number' ? ce.lon : helmet?.lon;
          const hasLoc = typeof lat === 'number' && typeof lon === 'number';

          console.log('[HelmetCrashWatcher] 🚨 helmet crash detected, creating SOS', {
            severity: ce.severity, lat, lon,
          });

          await createSosRequest({
            victimId: user.uid,
            status: 'countdown',
            severity: ce.severity ?? 'major',
            source: 'hardware',
            countdown: 10,
            incidentType: 'crash',
            location: hasLoc ? { lat: lat!, lon: lon! } : null as any,
            hasValidLocation: hasLoc,
            isApproximate: false,
            radiusKm: 3,
          });

          // GlobalSosWatcher (in the same RootLayout) will now navigate to /app/sos.
        } catch (e) {
          console.error('[HelmetCrashWatcher] failed to create SOS:', e);
        }
      })();
    });
  }, [user?.uid]);

  return null;
};
