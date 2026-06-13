/**
 * Hospital alerts — written by a helper / responder when they're heading to a
 * specific hospital with the victim of an active SOS.
 *
 * Use cases this enables today:
 *   ▸ Helper picks the nearest equipped hospital from the incident location.
 *   ▸ Victim's SOS screen shows "Helper has alerted Apollo Hospital" so the
 *     family knows where their loved one is being taken.
 *
 * Use cases this enables once the Hospital Portal ships:
 *   ▸ Hospital subscribes to `where('hospitalId', '==', myHospitalId)
 *     && status == 'notified'` and pops a "PATIENT INCOMING" alert.
 *   ▸ ER staff & on-call doctor can read severity, injury notes, and live ETA
 *     from the helper's assignment, prepare the bay, and acknowledge.
 */

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';
import type { SosSeverity } from './sos';

export type HospitalAlertStatus =
  | 'notified'      // helper has notified the hospital
  | 'acknowledged'  // hospital has seen / accepted the inbound patient
  | 'arrived'       // helper + victim have reached the hospital
  | 'cancelled';    // helper changed hospitals or cancelled

export type HospitalAlert = {
  id: string;
  /** SOS request this alert belongs to. */
  requestId: string;
  victimId: string;
  helperId: string;
  helperName?: string;

  /** Target hospital. `hospitalId` may be a Google Places place_id (real)
   *  or our showcase id ("arogya-medicare"). */
  hospitalId: string;
  hospitalName: string;
  hospitalAddress?: string;
  hospitalLocation?: { lat: number; lon: number };
  /** Distance from the incident location to the hospital. */
  distanceFromSosKm?: number;

  /** Snapshot of incident severity + location at notify time. */
  severity?: SosSeverity;
  victimLocation?: { lat: number; lon: number };

  /** Free-text injury / situation summary the helper provides. */
  injuryNotes?: string;
  /** Suggested specialty (cardio, ortho, neuro, …) so the right team is on call. */
  suggestedDept?: string;

  status: HospitalAlertStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

const LS_KEY = 'arogya_hospital_alerts_v1';

function loadDemo(): HospitalAlert[] {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any[];
    return parsed.map((x) => ({
      ...x,
      createdAt: x.createdAt ? new Date(x.createdAt) : undefined,
      updatedAt: x.updatedAt ? new Date(x.updatedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveDemo(list: HospitalAlert[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function mapAlert(id: string, data: any): HospitalAlert {
  return {
    id,
    requestId: data.requestId,
    victimId: data.victimId,
    helperId: data.helperId,
    helperName: data.helperName,
    hospitalId: data.hospitalId,
    hospitalName: data.hospitalName,
    hospitalAddress: data.hospitalAddress,
    hospitalLocation: data.hospitalLocation,
    distanceFromSosKm: data.distanceFromSosKm,
    severity: data.severity,
    victimLocation: data.victimLocation,
    injuryNotes: data.injuryNotes,
    suggestedDept: data.suggestedDept,
    status: data.status ?? 'notified',
    createdAt: data.createdAt?.toDate?.() ?? (data.createdAt ? new Date(data.createdAt) : undefined),
    updatedAt: data.updatedAt?.toDate?.() ?? (data.updatedAt ? new Date(data.updatedAt) : undefined),
  };
}

export type NotifyHospitalInput = Omit<HospitalAlert, 'id' | 'status' | 'createdAt' | 'updatedAt'>;

/**
 * Persist a "patient incoming" notification for the chosen hospital.
 * Returns the alert id.
 */
export async function notifyHospital(input: NotifyHospitalInput): Promise<string> {
  if (isDemoMode) {
    const id = `demo-${Date.now()}`;
    const list = loadDemo();
    list.unshift({ ...input, id, status: 'notified', createdAt: new Date(), updatedAt: new Date() });
    saveDemo(list);
    return id;
  }

  const payload: Record<string, unknown> = {
    requestId: input.requestId,
    victimId: input.victimId,
    helperId: input.helperId,
    hospitalId: input.hospitalId,
    hospitalName: input.hospitalName,
    status: 'notified',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.helperName)         payload.helperName = input.helperName;
  if (input.hospitalAddress)    payload.hospitalAddress = input.hospitalAddress;
  if (input.hospitalLocation)   payload.hospitalLocation = input.hospitalLocation;
  if (typeof input.distanceFromSosKm === 'number') payload.distanceFromSosKm = input.distanceFromSosKm;
  if (input.severity)           payload.severity = input.severity;
  if (input.victimLocation)     payload.victimLocation = input.victimLocation;
  if (input.injuryNotes)        payload.injuryNotes = input.injuryNotes;
  if (input.suggestedDept)      payload.suggestedDept = input.suggestedDept;

  const ref = await addDoc(collection(db, 'hospitalAlerts'), payload);
  return ref.id;
}

/** Mark an existing alert as cancelled (helper re-routed to a different hospital). */
export async function cancelHospitalAlert(alertId: string): Promise<void> {
  if (isDemoMode) {
    const list = loadDemo().map((a) =>
      a.id === alertId ? { ...a, status: 'cancelled' as const, updatedAt: new Date() } : a,
    );
    saveDemo(list);
    return;
  }
  await updateDoc(doc(db, 'hospitalAlerts', alertId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

/** Update an alert (used by the future hospital portal to ack / mark arrived). */
export async function updateHospitalAlert(
  alertId: string,
  patch: Partial<Pick<HospitalAlert, 'status' | 'injuryNotes' | 'suggestedDept'>>,
): Promise<void> {
  if (isDemoMode) {
    const list = loadDemo().map((a) =>
      a.id === alertId ? { ...a, ...patch, updatedAt: new Date() } : a,
    );
    saveDemo(list);
    return;
  }
  await updateDoc(doc(db, 'hospitalAlerts', alertId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** Live listener for all alerts on a given SOS request. */
export function listenAlertsForRequest(
  requestId: string,
  cb: (items: HospitalAlert[]) => void,
): () => void {
  if (isDemoMode) {
    const tick = () =>
      cb(
        loadDemo()
          .filter((a) => a.requestId === requestId)
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
      );
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }
  const q = query(
    collection(db, 'hospitalAlerts'),
    where('requestId', '==', requestId)
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => mapAlert(d.id, d.data()));
    docs.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    cb(docs);
  });
}

/**
 * Live listener for an individual helper's alerts on a single request.
 * Useful in the helper UI so we don't need a separate query for "my alert".
 */
export function listenMyAlertForRequest(
  requestId: string,
  helperId: string,
  cb: (item: HospitalAlert | null) => void,
): () => void {
  return listenAlertsForRequest(requestId, (all) => {
    const mine = all
      .filter((a) => a.helperId === helperId && a.status !== 'cancelled')
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
    cb(mine ?? null);
  });
}

/** Live listener for all alerts sent to a specific hospital. */
export function listenAlertsForHospital(
  hospitalId: string,
  cb: (items: HospitalAlert[]) => void,
): () => void {
  if (isDemoMode) {
    const tick = () =>
      cb(
        loadDemo()
          .filter((a) => a.hospitalId === hospitalId && a.status !== 'cancelled')
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
      );
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }
  const q = query(
    collection(db, 'hospitalAlerts'),
    where('hospitalId', '==', hospitalId)
  );
  return onSnapshot(q, (snap) => {
    let docs = snap.docs.map((d) => mapAlert(d.id, d.data()));
    // Filter status locally to avoid Firebase "in" query assertion bugs + composite index needs
    docs = docs.filter(d => ['notified', 'acknowledged', 'arrived'].includes(d.status));
    docs.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    cb(docs);
  });
}
