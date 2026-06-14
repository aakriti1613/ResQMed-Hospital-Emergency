import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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
};

const LS_KEY = 'resqmed_demo_appointments_v1';

function loadDemo(): Appointment[] {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any[];
    return parsed.map((x) => ({
      ...x,
      startAt: new Date(x.startAt),
      endAt: new Date(x.endAt),
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
    feeRupees: typeof data.feeRupees === 'number' ? data.feeRupees : undefined,
    paymentStatus: data.paymentStatus,
    paymentMethod: data.paymentMethod,
    paymentRef: data.paymentRef,
    paymentCardLabel: data.paymentCardLabel,
    paidAt: data.paidAt?.toDate?.() ?? (data.paidAt ? new Date(data.paidAt) : undefined),
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

