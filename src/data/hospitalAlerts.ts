/**
 * Hospital alerts. Written by a helper / responder when they're heading to a
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

/** State of a hospital-dispatched ambulance for an incoming patient. */
export type AmbulanceStatus =
  | 'dispatched'    // hospital has sent a unit toward the patient
  | 'enroute'       // unit is on the way
  | 'arrived';      // unit reached the patient / returned with them

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

  // ── Optional patient snapshot (so the portal can render before/without a
  //    full profile lookup — e.g. guest victims or demo data). ────────────────
  patientName?: string;
  patientAge?: number;
  bloodGroup?: string;
  allergies?: string;
  medicalConditions?: string;
  incidentType?: string;

  status: HospitalAlertStatus;
  createdAt?: Date;
  updatedAt?: Date;

  // ── Ambulance dispatch (written by the hospital portal) ────────────────────
  ambulanceStatus?: AmbulanceStatus;
  /** Vehicle registration / unit id, e.g. "ARG-108". */
  ambulanceVehicleNo?: string;
  /** Crew / paramedic note, e.g. "Dr. Mehta + 2 paramedics". */
  ambulanceCrew?: string;
  /** Estimated minutes for the dispatched unit to reach the patient. */
  ambulanceEtaMin?: number;
  ambulanceDispatchedAt?: Date;
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
      ambulanceDispatchedAt: x.ambulanceDispatchedAt ? new Date(x.ambulanceDispatchedAt) : undefined,
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
    patientName: data.patientName,
    patientAge: typeof data.patientAge === 'number' ? data.patientAge : undefined,
    bloodGroup: data.bloodGroup,
    allergies: data.allergies,
    medicalConditions: data.medicalConditions,
    incidentType: data.incidentType,
    status: data.status ?? 'notified',
    createdAt: data.createdAt?.toDate?.() ?? (data.createdAt ? new Date(data.createdAt) : undefined),
    updatedAt: data.updatedAt?.toDate?.() ?? (data.updatedAt ? new Date(data.updatedAt) : undefined),
    ambulanceStatus: data.ambulanceStatus,
    ambulanceVehicleNo: data.ambulanceVehicleNo,
    ambulanceCrew: data.ambulanceCrew,
    ambulanceEtaMin: typeof data.ambulanceEtaMin === 'number' ? data.ambulanceEtaMin : undefined,
    ambulanceDispatchedAt: data.ambulanceDispatchedAt?.toDate?.() ?? (data.ambulanceDispatchedAt ? new Date(data.ambulanceDispatchedAt) : undefined),
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
  if (input.patientName)        payload.patientName = input.patientName;
  if (typeof input.patientAge === 'number') payload.patientAge = input.patientAge;
  if (input.bloodGroup)         payload.bloodGroup = input.bloodGroup;
  if (input.allergies)          payload.allergies = input.allergies;
  if (input.medicalConditions)  payload.medicalConditions = input.medicalConditions;
  if (input.incidentType)       payload.incidentType = input.incidentType;

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

/** Update an alert (used by the hospital portal to ack / mark arrived / dispatch). */
export async function updateHospitalAlert(
  alertId: string,
  patch: Partial<Pick<HospitalAlert,
    | 'status' | 'injuryNotes' | 'suggestedDept'
    | 'ambulanceStatus' | 'ambulanceVehicleNo' | 'ambulanceCrew' | 'ambulanceEtaMin'
  >>,
): Promise<void> {
  if (isDemoMode) {
    const list = loadDemo().map((a) =>
      a.id === alertId ? { ...a, ...patch, updatedAt: new Date() } : a,
    );
    saveDemo(list);
    return;
  }
  // Drop undefined so we never persist `undefined` to Firestore.
  const clean: Record<string, unknown> = {};
  Object.entries(patch).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v;
  });
  clean.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'hospitalAlerts', alertId), clean);
}

export type DispatchAmbulanceInput = {
  vehicleNo: string;
  crew?: string;
  etaMin?: number;
};

/**
 * Dispatch a hospital ambulance toward the patient of an incoming alert.
 * Writes the dispatch onto the alert doc so the victim's SOS screen (which
 * already listens to alerts for the request) shows "Hospital dispatched an
 * ambulance · ETA …" — closing the loop end-to-end.
 */
export async function dispatchAmbulance(
  alertId: string,
  input: DispatchAmbulanceInput,
): Promise<void> {
  if (isDemoMode) {
    const list = loadDemo().map((a) =>
      a.id === alertId
        ? {
            ...a,
            ambulanceStatus: 'dispatched' as const,
            ambulanceVehicleNo: input.vehicleNo,
            ambulanceCrew: input.crew,
            ambulanceEtaMin: input.etaMin,
            ambulanceDispatchedAt: new Date(),
            // A dispatch implies the ER has seen the patient.
            status: a.status === 'notified' ? ('acknowledged' as const) : a.status,
            updatedAt: new Date(),
          }
        : a,
    );
    saveDemo(list);
    return;
  }
  const payload: Record<string, unknown> = {
    ambulanceStatus: 'dispatched',
    ambulanceVehicleNo: input.vehicleNo,
    ambulanceDispatchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.crew) payload.ambulanceCrew = input.crew;
  if (typeof input.etaMin === 'number') payload.ambulanceEtaMin = input.etaMin;
  await updateDoc(doc(db, 'hospitalAlerts', alertId), payload);
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

// ─────────────────────────────────────────────────────────────────────────────
// Demo seeding — lets the Hospital Portal be demonstrated locally (demo mode)
// without a second device generating live SOS traffic. No-op outside demo mode.
// ─────────────────────────────────────────────────────────────────────────────
export function seedDemoAlerts(hospitalId: string, hospitalName: string): number {
  if (!isDemoMode) return 0;
  const now = Date.now();
  const samples: HospitalAlert[] = [
    {
      id: `demo-alert-${now}-1`,
      requestId: `demo-req-${now}-1`,
      victimId: `demo-victim-1`,
      helperId: 'demo-helper-1',
      helperName: 'Rohan (Good Samaritan)',
      hospitalId, hospitalName,
      hospitalAddress: 'Sector 18, City Centre',
      severity: 'critical',
      injuryNotes: 'Two-wheeler vs car. Conscious but bleeding from right leg, suspected fracture.',
      suggestedDept: 'Orthopedics / Trauma',
      patientName: 'Aarav Sharma', patientAge: 28, bloodGroup: 'B+',
      allergies: 'Penicillin', medicalConditions: 'Asthma',
      incidentType: 'crash',
      status: 'notified',
      createdAt: new Date(now - 2 * 60 * 1000),
      updatedAt: new Date(now - 2 * 60 * 1000),
    },
    {
      id: `demo-alert-${now}-2`,
      requestId: `demo-req-${now}-2`,
      victimId: `demo-victim-2`,
      helperId: 'demo-helper-2',
      helperName: 'Ambulance 108',
      hospitalId, hospitalName,
      hospitalAddress: 'Sector 18, City Centre',
      severity: 'major',
      injuryNotes: 'Collapse at gym, chest discomfort. Helper performing first aid.',
      suggestedDept: 'Cardiology',
      patientName: 'Meera Nair', patientAge: 54, bloodGroup: 'O+',
      allergies: '', medicalConditions: 'Hypertension, Type-2 Diabetes',
      incidentType: 'medical',
      status: 'acknowledged',
      createdAt: new Date(now - 8 * 60 * 1000),
      updatedAt: new Date(now - 6 * 60 * 1000),
    },
    {
      id: `demo-alert-${now}-3`,
      requestId: `demo-req-${now}-3`,
      victimId: `demo-victim-3`,
      helperId: 'demo-helper-3',
      helperName: 'Priya (Helper)',
      hospitalId, hospitalName,
      hospitalAddress: 'Sector 18, City Centre',
      severity: 'minor',
      injuryNotes: 'Fall from stairs, possible wrist sprain. Stable.',
      suggestedDept: 'Emergency Room',
      patientName: 'Kabir Singh', patientAge: 19, bloodGroup: 'A+',
      incidentType: 'fall',
      status: 'notified',
      createdAt: new Date(now - 1 * 60 * 1000),
      updatedAt: new Date(now - 1 * 60 * 1000),
    },
  ];
  const existing = loadDemo();
  // Avoid piling up duplicates: keep non-demo + previously real alerts.
  saveDemo([...samples, ...existing]);
  return samples.length;
}

/** Remove demo-seeded alerts (ids starting with "demo-alert-"). */
export function clearDemoAlerts(): void {
  if (!isDemoMode) return;
  saveDemo(loadDemo().filter((a) => !a.id.startsWith('demo-alert-')));
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
