import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';
export type PaymentMethod = 'gpay' | 'cash' | 'card' | 'upi' | 'unknown';

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  startAt: Date;
  endAt: Date;
  reason: string;
  status: AppointmentStatus;
  // ── Snapshot fields (optional for back-compat) ─────────────────────────────
  /** Doctor display name at the time of booking. */
  doctorName?: string;
  /** Doctor avatar emoji or URL. */
  doctorAvatar?: string;
  /** Department id (e.g. 'cardio'). */
  department?: string;
  /** Human department name (e.g. 'Cardiology'). */
  departmentName?: string;
  /** Hospital display name at the time of booking. */
  hospitalName?: string;
  /** Patient snapshot at booking time — shown in the hospital portal. */
  patientName?: string;
  patientAge?: number;
  patientBloodGroup?: string;
  /** Consultation fee captured at booking. */
  feeRupees?: number;
  // ── Payment fields ─────────────────────────────────────────────────────────
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  /** Reference id from the payment gateway (e.g. Google Pay token id). */
  paymentRef?: string;
  /** Description of the card used (e.g. "Visa •••• 1234"). */
  paymentCardLabel?: string;
  paidAt?: Date;
  // ── Visit completion summary (written by the hospital/doctor portal) ─────────
  /** Diagnosis recorded by the hospital at the end of the visit. */
  diagnosis?: string;
  /** Prescription / medication advice. */
  prescription?: string;
  /** Free-text notes / after-care advice for the patient. */
  advice?: string;
  /** Recommended follow-up date, if any. */
  followUpAt?: Date;
  /** When the visit was marked completed. */
  completedAt?: Date;
};

const LS_KEY = 'resqmed_demo_appointments_v1';

function loadDemo(): Appointment[] {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any[];
    const revive = (v: any) => (v ? new Date(v) : undefined);
    return parsed.map((x) => ({
      ...x,
      startAt: new Date(x.startAt),
      endAt: new Date(x.endAt),
      paidAt: revive(x.paidAt),
      completedAt: revive(x.completedAt),
      followUpAt: revive(x.followUpAt),
    }));
  } catch {
    return [];
  }
}

function saveDemo(list: Appointment[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export async function listAppointments(patientId: string): Promise<Appointment[]> {
  if (isDemoMode) {
    return loadDemo().filter((a) => a.patientId === patientId);
  }

  const q = query(collection(db, 'appointments'), where('patientId', '==', patientId), orderBy('startAt', 'desc'));
    return await new Promise((resolve, reject) => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        unsub();
        resolve(snap.docs.map((d) => mapAppointment(d.id, d.data() as any)));
      },
      (err) => {
        unsub();
        reject(err);
      },
    );
  });
}

function mapAppointment(id: string, data: any): Appointment {
  return {
    id,
    patientId: data.patientId,
    doctorId: data.doctorId,
    hospitalId: data.hospitalId,
    startAt: data.startAt?.toDate?.() ?? new Date(data.startAt ?? Date.now()),
    endAt: data.endAt?.toDate?.() ?? new Date(data.endAt ?? Date.now()),
    reason: data.reason ?? '',
    status: data.status ?? 'scheduled',
    doctorName: data.doctorName,
    doctorAvatar: data.doctorAvatar,
    department: data.department,
    departmentName: data.departmentName,
    hospitalName: data.hospitalName,
    patientName: data.patientName,
    patientAge: typeof data.patientAge === 'number' ? data.patientAge : undefined,
    patientBloodGroup: data.patientBloodGroup,
    feeRupees: typeof data.feeRupees === 'number' ? data.feeRupees : undefined,
    paymentStatus: data.paymentStatus,
    paymentMethod: data.paymentMethod,
    paymentRef: data.paymentRef,
    paymentCardLabel: data.paymentCardLabel,
    paidAt: data.paidAt?.toDate?.() ?? (data.paidAt ? new Date(data.paidAt) : undefined),
    diagnosis: data.diagnosis,
    prescription: data.prescription,
    advice: data.advice,
    followUpAt: data.followUpAt?.toDate?.() ?? (data.followUpAt ? new Date(data.followUpAt) : undefined),
    completedAt: data.completedAt?.toDate?.() ?? (data.completedAt ? new Date(data.completedAt) : undefined),
  };
}

export function listenAppointments(patientId: string, cb: (items: Appointment[]) => void) {
  if (isDemoMode) {
    cb(loadDemo().filter((a) => a.patientId === patientId));
    const t = setInterval(() => cb(loadDemo().filter((a) => a.patientId === patientId)), 1500);
    return () => clearInterval(t);
  }
  const q = query(collection(db, 'appointments'), where('patientId', '==', patientId), orderBy('startAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => mapAppointment(d.id, d.data() as any)));
  });
}

export async function createAppointment(input: Omit<Appointment, 'id'>): Promise<Appointment> {
  if (isDemoMode) {
    const list = loadDemo();
    const created: Appointment = { ...input, id: `demo-${Date.now()}` };
    saveDemo([created, ...list]);
    return created;
  }

  const payload: Record<string, unknown> = {
    patientId: input.patientId,
    doctorId: input.doctorId,
    hospitalId: input.hospitalId,
    startAt: input.startAt,
    endAt: input.endAt,
    reason: input.reason,
    status: input.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // Only write snapshot fields when they're set (keeps docs clean).
  if (input.doctorName)     payload.doctorName = input.doctorName;
  if (input.doctorAvatar)   payload.doctorAvatar = input.doctorAvatar;
  if (input.department)     payload.department = input.department;
  if (input.departmentName) payload.departmentName = input.departmentName;
  if (input.hospitalName)   payload.hospitalName = input.hospitalName;
  if (input.patientName)    payload.patientName = input.patientName;
  if (typeof input.patientAge === 'number') payload.patientAge = input.patientAge;
  if (input.patientBloodGroup) payload.patientBloodGroup = input.patientBloodGroup;
  if (typeof input.feeRupees === 'number') payload.feeRupees = input.feeRupees;
  if (input.paymentStatus)    payload.paymentStatus = input.paymentStatus;
  if (input.paymentMethod)    payload.paymentMethod = input.paymentMethod;
  if (input.paymentRef)       payload.paymentRef = input.paymentRef;
  if (input.paymentCardLabel) payload.paymentCardLabel = input.paymentCardLabel;
  if (input.paidAt)           payload.paidAt = input.paidAt;

  const ref = await addDoc(collection(db, 'appointments'), payload);
  return { ...input, id: ref.id };
}

/**
 * Listener for the caller's **upcoming** appointments (next, limited).
 * Returns the closest future appointment first. Used by the Home page card.
 */
export function listenUpcomingAppointments(
  patientId: string,
  cb: (items: Appointment[]) => void,
  max: number = 3
) {
  return listenAppointments(patientId, (all) => {
    const now = Date.now();
    const upcoming = all
      .filter((a) => a.status === 'scheduled' && a.startAt.getTime() >= now - 15 * 60 * 1000)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .slice(0, max);
    cb(upcoming);
  });
}

export async function removeAppointment(appointmentId: string) {
  if (isDemoMode) {
    const list = loadDemo().filter((a) => a.id !== appointmentId);
    saveDemo(list);
    return;
  }
  await deleteDoc(doc(db, 'appointments', appointmentId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Hospital-portal facing helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live listener for every appointment booked at a given hospital.
 * Used by the Hospital Portal so staff can see and manage their schedule.
 *
 * In demo mode this reads the same localStorage the patient app writes to, so
 * the loop is genuinely end-to-end (book → hospital sees → completes → patient
 * sees the summary). In Firebase mode this is subject to Firestore rules; if the
 * portal isn't authorised to read other patients' appointments the listener
 * simply yields an empty list instead of crashing.
 */
export function listenAppointmentsForHospital(
  hospitalId: string,
  cb: (items: Appointment[]) => void,
) {
  if (isDemoMode) {
    const tick = () =>
      cb(
        loadDemo()
          .filter((a) => a.hospitalId === hospitalId)
          .sort((a, b) => b.startAt.getTime() - a.startAt.getTime()),
      );
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }
  // Single where() clause only — sort client-side so we never depend on a
  // composite Firestore index existing in the deployed project.
  const q = query(
    collection(db, 'appointments'),
    where('hospitalId', '==', hospitalId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => mapAppointment(d.id, d.data() as any));
      docs.sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
      cb(docs);
    },
    (err) => {
      console.warn('[appointments] hospital listener error:', err?.code ?? err);
      cb([]);
    },
  );
}

/** Generic patch for an appointment (status, payment, summary fields). */
export async function updateAppointment(
  appointmentId: string,
  patch: Partial<Omit<Appointment, 'id'>>,
): Promise<void> {
  if (isDemoMode) {
    const list = loadDemo().map((a) =>
      a.id === appointmentId ? { ...a, ...patch } : a,
    );
    saveDemo(list);
    return;
  }
  // Strip undefined so we never write `undefined` into Firestore.
  const clean: Record<string, unknown> = {};
  Object.entries(patch).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v;
  });
  clean.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'appointments', appointmentId), clean);
}

export type VisitSummaryInput = {
  diagnosis?: string;
  prescription?: string;
  advice?: string;
  followUpAt?: Date;
};

/** Mark a visit completed and attach the hospital's summary. */
export async function completeAppointment(
  appointmentId: string,
  summary: VisitSummaryInput,
): Promise<void> {
  await updateAppointment(appointmentId, {
    status: 'completed',
    completedAt: new Date(),
    ...summary,
  });
}

/** Hospital confirms / checks-in a scheduled appointment (no status change beyond note). */
export async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<void> {
  await updateAppointment(appointmentId, { status });
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo seeding — populates a few appointments for the showcase hospital so the
// Hospital Portal's "Appointments" tab is demonstrable in demo mode. No-op
// outside demo mode.
// ─────────────────────────────────────────────────────────────────────────────
export function seedDemoAppointments(
  hospitalId: string,
  hospitalName: string,
): number {
  if (!isDemoMode) return 0;
  const now = Date.now();
  const mk = (
    offsetMs: number,
    over: Partial<Appointment>,
  ): Appointment => ({
    id: `demo-appt-${now}-${Math.abs(offsetMs)}`,
    patientId: 'demo-patient-x',
    doctorId: 'doc-cardio-1',
    hospitalId,
    hospitalName,
    startAt: new Date(now + offsetMs),
    endAt: new Date(now + offsetMs + 30 * 60 * 1000),
    reason: 'Routine consultation',
    status: 'scheduled',
    feeRupees: 900,
    paymentStatus: 'paid',
    paymentMethod: 'gpay',
    ...over,
  });
  const samples: Appointment[] = [
    mk(45 * 60 * 1000, {
      patientName: 'Ishaan Verma', patientAge: 34, patientBloodGroup: 'O+',
      doctorName: 'Dr. Ananya Iyer', department: 'cardio', departmentName: 'Cardiology',
      reason: 'Chest tightness on exertion, family history of heart disease.',
    }),
    mk(2 * 60 * 60 * 1000, {
      patientName: 'Sara Khan', patientAge: 27, patientBloodGroup: 'A+',
      doctorName: 'Dr. Sunita Rao', doctorId: 'doc-derma-1', department: 'derma', departmentName: 'Dermatology',
      reason: 'Persistent acne and pigmentation.', feeRupees: 700,
      paymentStatus: 'unpaid', paymentMethod: 'cash',
    }),
    mk(-26 * 60 * 60 * 1000, {
      patientName: 'Rohit Mehta', patientAge: 41, patientBloodGroup: 'B+',
      doctorName: 'Dr. Rahul Gupta', doctorId: 'doc-ortho-1', department: 'ortho', departmentName: 'Orthopedics',
      reason: 'Knee pain after running.', feeRupees: 800,
      status: 'completed', completedAt: new Date(now - 25 * 60 * 60 * 1000),
      diagnosis: 'Mild patellar tendinitis.',
      prescription: 'Ibuprofen 400mg BD x5 days; knee brace.',
      advice: 'Rest 1 week, ice 15 min twice daily, avoid stairs. Physiotherapy referral.',
    }),
  ];
  const existing = loadDemo();
  saveDemo([...samples, ...existing]);
  return samples.length;
}

/** Remove demo-seeded appointments (ids starting with "demo-appt-"). */
export function clearDemoAppointments(): void {
  if (!isDemoMode) return;
  saveDemo(loadDemo().filter((a) => !a.id.startsWith('demo-appt-')));
}

