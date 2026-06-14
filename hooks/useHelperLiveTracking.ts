import { useEffect, useRef } from 'react';
import { updateAssignment } from '../data/sos';
import { computeRoute, haversineMeters, type LatLon } from '../data/routing';

const LOC_WRITE_INTERVAL_MS = 4_000;      // write Firestore at most every 4s
const MIN_MOVE_METERS = 12;               // skip if moved less than this
const ROUTE_RECOMPUTE_INTERVAL_MS = 30_000; // recompute ETA every 30s
const ROUTE_REDRAW_DEVIATION_M = 80;      // or when off-route by > 80m
const ARRIVAL_RADIUS_M = 35;              // distance at which we consider arrival
const ARRIVAL_CONFIRMATIONS = 2;          // need N consecutive pings

/**
 * Stream the helper's live GPS to an SOS assignment + recompute ETA/route
 * periodically via Google Directions. Stops on unmount or when `active` flips
 * to false.
 *
 * Designed for the helper side (HelpPage) — the VICTIM just listens to the
 * assignment doc and renders the result.
 */
export function useHelperLiveTracking(params: {
  assignmentId: string | null;
  victimLocation: LatLon | null;
  active: boolean;
}) {
  const { assignmentId, victimLocation, active } = params;

  const lastWriteAtRef = useRef(0);
  const lastWrittenLocRef = useRef<LatLon | null>(null);
  const lastRouteAtRef = useRef(0);
  const arrivalCountRef = useRef(0);
  const arrivedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !assignmentId || !victimLocation) return;
    if (!navigator.geolocation) {
      console.warn('[HelperTracking] Geolocation not supported');
      return;
    }

    arrivedRef.current = false;
    arrivalCountRef.current = 0;

    const onPosition = async (pos: GeolocationPosition) => {
      const here: LatLon = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
      const now = Date.now();

      // ── Arrival detection (cheap, Haversine) ────────────────────────────
      const straightMeters = haversineMeters(here, victimLocation);
      if (straightMeters <= ARRIVAL_RADIUS_M) {
        arrivalCountRef.current += 1;
        if (arrivalCountRef.current >= ARRIVAL_CONFIRMATIONS && !arrivedRef.current) {
          arrivedRef.current = true;
          try {
            await updateAssignment(assignmentId, {
              status: 'reached',
              arrivedAt: now,
              helperLocation: { ...here, updatedAt: now },
              distanceMeters: Math.round(straightMeters),
              etaSeconds: 0,
            } as any);
            console.log('[HelperTracking] ✅ Arrived at victim location');
          } catch (e) {
            console.warn('[HelperTracking] arrival write failed', e);
          }
          return;
        }
      } else {
        arrivalCountRef.current = 0;
      }

      // ── Throttled location write ─────────────────────────────────────────
      const sinceLastWrite = now - lastWriteAtRef.current;
      const moved = lastWrittenLocRef.current
        ? haversineMeters(here, lastWrittenLocRef.current)
        : Infinity;

      const shouldWrite =
        sinceLastWrite >= LOC_WRITE_INTERVAL_MS && moved >= MIN_MOVE_METERS;

      if (shouldWrite) {
        lastWriteAtRef.current = now;
        lastWrittenLocRef.current = here;

        // Opportunistically update the straight-line distance every tick —
        // cheap and gives the victim a smoother "closing distance" readout.
        updateAssignment(assignmentId, {
          helperLocation: { ...here, updatedAt: now },
          distanceMeters: Math.round(straightMeters),
          status: 'enroute',
        } as any).catch((e) => console.warn('[HelperTracking] loc write failed', e));
      }

      // ── Route / ETA recompute (Google Directions — billed) ──────────────
      const sinceLastRoute = now - lastRouteAtRef.current;
      const deviation = lastWrittenLocRef.current
        ? haversineMeters(here, lastWrittenLocRef.current)
        : 0;
      const needRoute =
        sinceLastRoute >= ROUTE_RECOMPUTE_INTERVAL_MS ||
        (lastRouteAtRef.current === 0) ||
        deviation >= ROUTE_REDRAW_DEVIATION_M;

      if (needRoute) {
        lastRouteAtRef.current = now;
        try {
          const route = await computeRoute(here, victimLocation, 'DRIVING');
          if (route && !arrivedRef.current) {
            await updateAssignment(assignmentId, {
              etaSeconds: route.etaSeconds,
              distanceMeters: route.distanceMeters,
              routeEncoded: route.routeEncoded,
              lastRouteAt: now,
              helperLocation: { ...here, updatedAt: now },
            } as any);
          }
        } catch (e) {
          console.warn('[HelperTracking] Directions call failed', e);
        }
      }
    };

    const onError = (err: GeolocationPositionError) => {
      console.warn('[HelperTracking] watchPosition error:', err.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 2_000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [assignmentId, active, victimLocation?.lat, victimLocation?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
}
