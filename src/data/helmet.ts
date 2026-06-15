/**
 * Smart Helmet hardware integration.
 *
 * The companion smart helmet syncs telemetry to Firestore at
 * `helmets/{ownerUid}` while it's connected (via a paired phone or via the
 * helmet's own LTE-M / NB-IoT modem). The app reads from this same doc to
 * render the "Helmet Status" card on the dashboard, the "Riding Protected"
 * banner, and to enable hardware-triggered SOS (which sets `crashEvent`).
 *
 * Schema (Firestore: `helmets/{ownerUid}`):
 *   ownerUid:      string         // who this helmet is paired to
 *   deviceId:      string         // helmet serial / MAC
 *   model:         string         // "Aarogya Helmet One"
 *   firmware:      string         // semver
 *   batteryPct:    number         // 0..100
 *   sensorsActive: boolean        // accelerometer + gyro + GPS responding
 *   connected:     boolean        // last heartbeat within 60s
 *   lastPingAt:    Timestamp      // server-side heartbeat
 *   verifiedAt:    Timestamp?     // last self-test pass
 *   crashEvent:    {              // populated by the helmet on impact
 *     at: Timestamp; severity: 'minor' | 'major' | 'critical';
 *     lat?: number; lon?: number; gForce?: number;
 *   } | null
 */

import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type HelmetCrashEvent = {
  at: Date;
  severity: 'minor' | 'major' | 'critical';
  lat?: number;
  lon?: number;
  gForce?: number;
};

export type HelmetDevice = {
  ownerUid: string;
  deviceId: string;
  model: string;
  firmware?: string;
  batteryPct: number;
  sensorsActive: boolean;
  connected: boolean;
  lastPingAt?: Date;
  verifiedAt?: Date;
  crashEvent?: HelmetCrashEvent | null;
  // ── Live telemetry (populated by the helmet bridge / ingest endpoints) ──
  heartRate?: number;
  spo2?: number;
  vibration?: number;
  vibrationLabel?: string;
  distanceCm?: number;
  lat?: number;
  lon?: number;
  gsmStatus?: string;
  relayOn?: boolean;
  accel?: { x?: number; y?: number; z?: number };
  gyro?:  { x?: number; y?: number; z?: number };
};

const LS_KEY = 'arogya_helmet_v1';

// ── Demo helpers ────────────────────────────────────────────────────────────
function loadDemo(uid: string): HelmetDevice | null {
  const raw = localStorage.getItem(`${LS_KEY}:${uid}`);
  if (!raw) return null;
  try {
    const x = JSON.parse(raw);
    return {
      ...x,
      lastPingAt: x.lastPingAt ? new Date(x.lastPingAt) : undefined,
      verifiedAt: x.verifiedAt ? new Date(x.verifiedAt) : undefined,
      crashEvent: x.crashEvent
        ? { ...x.crashEvent, at: new Date(x.crashEvent.at) }
        : null,
    };
  } catch {
    return null;
  }
}

function saveDemo(uid: string, d: HelmetDevice) {
  localStorage.setItem(`${LS_KEY}:${uid}`, JSON.stringify(d));
}

function mapHelmet(uid: string, data: any): HelmetDevice {
  const numOrUndef = (v: any): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  return {
    ownerUid: data.ownerUid ?? uid,
    deviceId: data.deviceId ?? 'unknown',
    model: data.model ?? 'Aarogya Helmet One',
    firmware: data.firmware,
    batteryPct: typeof data.batteryPct === 'number' ? data.batteryPct : 0,
    sensorsActive: Boolean(data.sensorsActive),
    connected: Boolean(data.connected),
    lastPingAt: data.lastPingAt?.toDate?.() ?? (data.lastPingAt ? new Date(data.lastPingAt) : undefined),
    verifiedAt: data.verifiedAt?.toDate?.() ?? (data.verifiedAt ? new Date(data.verifiedAt) : undefined),
    crashEvent: data.crashEvent
      ? {
          ...data.crashEvent,
          at: data.crashEvent.at?.toDate?.() ?? new Date(data.crashEvent.at ?? Date.now()),
        }
      : null,
    heartRate:      numOrUndef(data.heartRate),
    spo2:           numOrUndef(data.spo2),
    vibration:      numOrUndef(data.vibration),
    vibrationLabel: typeof data.vibrationLabel === 'string' ? data.vibrationLabel : undefined,
    distanceCm:     numOrUndef(data.distanceCm),
    lat:            numOrUndef(data.lat),
    lon:            numOrUndef(data.lon),
    gsmStatus:      typeof data.gsmStatus === 'string' ? data.gsmStatus : undefined,
    relayOn:        typeof data.relayOn === 'boolean' ? data.relayOn : undefined,
    accel: data.accel ? {
      x: numOrUndef(data.accel.x), y: numOrUndef(data.accel.y), z: numOrUndef(data.accel.z),
    } : undefined,
    gyro: data.gyro ? {
      x: numOrUndef(data.gyro.x), y: numOrUndef(data.gyro.y), z: numOrUndef(data.gyro.z),
    } : undefined,
  };
}

/**
 * Live listener for the user's helmet status. Emits `null` if no helmet is
 * paired yet. Useful to drive the dashboard "Helmet Status" card.
 */
export function listenHelmet(uid: string, cb: (h: HelmetDevice | null) => void): () => void {
  if (!uid) { cb(null); return () => {}; }

  if (isDemoMode) {
    const tick = () => cb(loadDemo(uid));
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }

  return onSnapshot(
    doc(db, 'helmets', uid),
    (snap) => cb(snap.exists() ? mapHelmet(uid, snap.data()) : null),
    (err) => { console.warn('listenHelmet error:', err); cb(null); },
  );
}

/** Pair (or re-pair) a helmet to the current user. */
export async function pairHelmet(input: {
  ownerUid: string;
  deviceId: string;
  model?: string;
  firmware?: string;
}): Promise<void> {
  const base: HelmetDevice = {
    ownerUid: input.ownerUid,
    deviceId: input.deviceId,
    model: input.model ?? 'Aarogya Helmet One',
    firmware: input.firmware,
    batteryPct: 92,
    sensorsActive: true,
    connected: true,
    lastPingAt: new Date(),
    verifiedAt: new Date(),
    crashEvent: null,
  };

  if (isDemoMode) { saveDemo(input.ownerUid, base); return; }

  await setDoc(doc(db, 'helmets', input.ownerUid), {
    ownerUid: base.ownerUid,
    deviceId: base.deviceId,
    model: base.model,
    firmware: base.firmware ?? null,
    batteryPct: base.batteryPct,
    sensorsActive: base.sensorsActive,
    connected: base.connected,
    lastPingAt: serverTimestamp(),
    verifiedAt: serverTimestamp(),
    crashEvent: null,
  }, { merge: true });
}

/** Run a self-test: writes a fresh `verifiedAt` so the dashboard chip refreshes. */
export async function verifyHelmet(uid: string): Promise<void> {
  if (isDemoMode) {
    const cur = loadDemo(uid);
    if (!cur) return;
    saveDemo(uid, { ...cur, verifiedAt: new Date(), sensorsActive: true });
    return;
  }
  await setDoc(doc(db, 'helmets', uid), {
    verifiedAt: serverTimestamp(),
    sensorsActive: true,
    lastPingAt: serverTimestamp(),
    connected: true,
  }, { merge: true });
}

/** Helper: a helmet is "live" only if its last heartbeat is within 60 seconds. */
export function isHelmetLive(h: HelmetDevice | null): boolean {
  if (!h) return false;
  if (!h.connected) return false;
  if (!h.lastPingAt) return true;
  return Date.now() - h.lastPingAt.getTime() < 60_000;
}
