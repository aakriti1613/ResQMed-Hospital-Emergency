/**
 * useAutoTripDetection.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Auto-detect a trip from the helmet doc, with NO user interaction:
 *
 *   relayOn  → false → true   = trip START
 *   relayOn  → true  → false  = trip END   (idle 60s also ends a trip)
 *
 * While the trip is active we:
 *   - Append every GPS sample to a route polyline
 *   - Track max HR, max vibration (= roughest moment), distance crossed
 *   - Compute a "smoothness score" 0-100 from vibration variance
 *
 * On trip END we persist a single Firestore doc at:
 *   trips/{auto-id}
 *
 * No screens are touched. The Trips page already reads from this collection —
 * if it doesn't, we expose the latest in-memory trip via the hook for any UI
 * to display.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/client';
import { isDemoMode } from '../../app/env';
import { listenHelmet, type HelmetDevice } from '../../data/helmet';

export type TripPoint = { t: number; lat: number; lon: number };

export type AutoTrip = {
  id?: string;            // firestore id (set after save)
  ownerUid: string;
  startedAtMs: number;
  endedAtMs?: number;
  route: TripPoint[];
  distanceKm: number;
  maxHeartRate: number;
  maxVibration: number;
  smoothness: number;     // 0..100, higher = smoother ride
  active: boolean;
};

const IDLE_END_MS = 60_000;
const MIN_TRIP_POINTS = 3;
const STORAGE_KEY = 'arogya_auto_trips_v1';

function haversineKm(a: TripPoint, b: TripPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function smoothnessFromVibration(samples: number[]): number {
  if (samples.length < 3) return 100;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  // Empirical scale: variance >= 200_000 = bumpy ride; <= 5_000 = silky.
  return Math.round(Math.max(0, Math.min(100, 100 - (variance / 2000))));
}

function loadCache(uid: string): AutoTrip[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${uid}`);
    if (!raw) return [];
    return JSON.parse(raw) as AutoTrip[];
  } catch {
    return [];
  }
}

function saveCache(uid: string, trips: AutoTrip[]) {
  try { localStorage.setItem(`${STORAGE_KEY}:${uid}`, JSON.stringify(trips.slice(-25))); } catch {}
}

export function useAutoTripDetection(uid: string | null | undefined) {
  const [activeTrip, setActiveTrip] = useState<AutoTrip | null>(null);
  const [recent, setRecent] = useState<AutoTrip[]>([]);
  const lastRelayRef = useRef<boolean | null>(null);
  const lastTickRef = useRef<number>(0);
  const vibBufRef = useRef<number[]>([]);

  // Load cached recent trips on mount
  useEffect(() => {
    if (!uid) { setRecent([]); return; }
    setRecent(loadCache(uid));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const persist = async (trip: AutoTrip): Promise<AutoTrip> => {
      // Always cache to localStorage so the demo works even when offline.
      const cached = loadCache(uid);
      const next = [...cached, trip];
      saveCache(uid, next);

      // Best-effort Firestore persist; ignore failures silently.
      if (!isDemoMode) {
        try {
          const ref = await addDoc(collection(db, 'trips'), {
            ownerUid: trip.ownerUid,
            startedAt: new Date(trip.startedAtMs),
            endedAt:   trip.endedAtMs ? new Date(trip.endedAtMs) : null,
            route:     trip.route,
            distanceKm: trip.distanceKm,
            maxHeartRate: trip.maxHeartRate,
            maxVibration: trip.maxVibration,
            smoothness: trip.smoothness,
            source: 'helmet-auto',
            createdAt: serverTimestamp(),
          });
          return { ...trip, id: ref.id };
        } catch (e) {
          console.warn('[autoTrip] failed to persist trip; cached locally:', e);
          return trip;
        }
      }
      return trip;
    };

    const unsub = listenHelmet(uid, (h: HelmetDevice | null) => {
      const now = Date.now();
      const relay = h?.relayOn ?? false;

      const prevRelay = lastRelayRef.current;
      lastTickRef.current = now;

      // ── Start a trip when relay flips OFF → ON ──
      if (relay && prevRelay !== true) {
        const newTrip: AutoTrip = {
          ownerUid: uid,
          startedAtMs: now,
          route: [],
          distanceKm: 0,
          maxHeartRate: 0,
          maxVibration: 0,
          smoothness: 100,
          active: true,
        };
        vibBufRef.current = [];
        setActiveTrip(newTrip);
      }

      // ── Update an active trip ──
      if (relay && lastRelayRef.current !== false) {
        setActiveTrip((cur) => {
          if (!cur) return cur;
          const next: AutoTrip = { ...cur };
          if (typeof h?.lat === 'number' && typeof h?.lon === 'number') {
            const pt: TripPoint = { t: now, lat: h.lat, lon: h.lon };
            if (next.route.length === 0 || haversineKm(next.route[next.route.length - 1], pt) > 0.005) {
              next.route = [...next.route, pt];
              next.distanceKm = next.route.length < 2 ? 0
                : next.route.slice(1).reduce((acc, p, i) => acc + haversineKm(next.route[i], p), 0);
            }
          }
          if (typeof h?.heartRate === 'number') {
            next.maxHeartRate = Math.max(next.maxHeartRate, h.heartRate);
          }
          if (typeof h?.vibration === 'number') {
            next.maxVibration = Math.max(next.maxVibration, h.vibration);
            vibBufRef.current.push(h.vibration);
            if (vibBufRef.current.length > 200) vibBufRef.current.shift();
            next.smoothness = smoothnessFromVibration(vibBufRef.current);
          }
          return next;
        });
      }

      // ── End a trip when relay flips ON → OFF ──
      if (!relay && prevRelay === true) {
        setActiveTrip((cur) => {
          if (!cur || cur.route.length < MIN_TRIP_POINTS) return null;
          const ended: AutoTrip = { ...cur, endedAtMs: now, active: false };
          void (async () => {
            const saved = await persist(ended);
            setRecent((r) => [...r, saved].slice(-25));
          })();
          return null;
        });
      }

      lastRelayRef.current = relay;
    });

    // Idle-end safety net: if relay stays "ON" but no fresh data for 60s, close trip.
    const idleTimer = window.setInterval(() => {
      if (Date.now() - lastTickRef.current < IDLE_END_MS) return;
      setActiveTrip((cur) => {
        if (!cur) return cur;
        if (cur.route.length < MIN_TRIP_POINTS) return null;
        const ended: AutoTrip = { ...cur, endedAtMs: Date.now(), active: false };
        void (async () => {
          const saved = await persist(ended);
          setRecent((r) => [...r, saved].slice(-25));
        })();
        return null;
      });
    }, 15_000);

    return () => { unsub(); window.clearInterval(idleTimer); };
  }, [uid]);

  return { activeTrip, recent };
}
