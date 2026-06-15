/**
 * useHelmetHistory.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Subscribes to helmets/{uid} and keeps a rolling in-memory window of the
 * last N readings for every vital we display, plus the IMU snapshot. Powers:
 *
 *   - Dashboard sparkline trends (60s)
 *   - Crash Replay "flight recorder" (10s pre-crash freeze)
 *   - Hospital portal pre-arrival vitals trend
 *
 * One global hook = one Firestore subscription per UID, so adding more
 * features on top is essentially free.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';
import { listenHelmet, type HelmetDevice } from '../data/helmet';

export type HelmetSample = {
  t: number;              // wall-clock ms
  heartRate?: number;
  spo2?: number;
  vibration?: number;
  distanceCm?: number;
  lat?: number;
  lon?: number;
  accidentStatus?: string;
  ax?: number; ay?: number; az?: number;
  gx?: number; gy?: number; gz?: number;
};

export type HelmetHistory = {
  helmet: HelmetDevice | null;
  samples: HelmetSample[];          // ring buffer, oldest → newest
  /** Sparkline-ready arrays for the most common vitals (60s window). */
  hrSeries:   number[];
  spo2Series: number[];
  vibSeries:  number[];
  distSeries: number[];
};

const EMPTY: HelmetHistory = {
  helmet: null, samples: [],
  hrSeries: [], spo2Series: [], vibSeries: [], distSeries: [],
};

function toSample(h: HelmetDevice | null, prev?: HelmetSample): HelmetSample {
  if (!h) return { t: Date.now() };
  return {
    t: h.lastPingAt?.getTime() ?? Date.now(),
    heartRate:  h.heartRate ?? prev?.heartRate,
    spo2:       h.spo2 ?? prev?.spo2,
    vibration:  h.vibration ?? prev?.vibration,
    distanceCm: h.distanceCm ?? prev?.distanceCm,
    lat: h.lat,
    lon: h.lon,
    accidentStatus: (h as any).accidentStatus,
    ax: h.accel?.x, ay: h.accel?.y, az: h.accel?.z,
    gx: h.gyro?.x,  gy: h.gyro?.y,  gz: h.gyro?.z,
  };
}

/**
 * @param uid     Firebase Auth UID of the helmet owner.
 * @param maxSec  How many seconds of history to retain. Default 60.
 */
export function useHelmetHistory(uid: string | null | undefined, maxSec = 60): HelmetHistory {
  const [state, setState] = useState<HelmetHistory>(EMPTY);
  const samplesRef = useRef<HelmetSample[]>([]);
  const lastTRef = useRef<number>(0);

  useEffect(() => {
    if (!uid) { setState(EMPTY); samplesRef.current = []; return; }
    return listenHelmet(uid, (helmet) => {
      const prev = samplesRef.current[samplesRef.current.length - 1];
      const s = toSample(helmet, prev);

      // De-dup identical pings (same lastPingAt timestamp).
      if (s.t && s.t === lastTRef.current) return;
      lastTRef.current = s.t;

      const cutoff = Date.now() - maxSec * 1000;
      const next = [...samplesRef.current, s].filter(x => x.t >= cutoff);
      samplesRef.current = next;

      setState({
        helmet,
        samples: next,
        hrSeries:   next.map(x => x.heartRate  ?? NaN).filter(Number.isFinite),
        spo2Series: next.map(x => x.spo2       ?? NaN).filter(Number.isFinite),
        vibSeries:  next.map(x => x.vibration  ?? NaN).filter(Number.isFinite),
        distSeries: next.map(x => x.distanceCm ?? NaN).filter(Number.isFinite),
      });
    });
  }, [uid, maxSec]);

  return state;
}
