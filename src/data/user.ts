import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type Gender = 'male' | 'female' | 'other' | '';

export interface SavedAddress {
  id: string;
  /** 'home' / 'work' get built-in icons; 'other' can use `name` for a custom label. */
  label: 'home' | 'work' | 'other';
  /** Only used when label === 'other'. */
  name?: string;
  /** Full postal address text. */
  line: string;
  lat?: number;
  lon?: number;
}

/** Age in years from ISO date of birth (YYYY-MM-DD), or undefined if invalid. */
export function computeAgeFromDob(dob?: string): number | undefined {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return undefined;
  const b = new Date(dob + 'T12:00:00');
  if (Number.isNaN(b.getTime())) return undefined;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}

/** Short line for ride-share style cards (home first, else first saved address). */
export function shortAddressFromProfile(p: UserProfile | null | undefined): string | undefined {
  if (!p?.addresses?.length) return undefined;
  const a = p.addresses.find((x) => x.label === 'home') ?? p.addresses[0];
  const line = (a?.line ?? '').trim();
  if (!line) return undefined;
  return line.length > 44 ? `${line.slice(0, 42)}…` : line;
}

export interface UserProfile {
  uid: string;
  name?: string;
  phone?: string;
  email?: string;
  dob?: string;              // ISO (YYYY-MM-DD)
  gender?: Gender;
  bloodGroup?: string;
  allergies?: string;            // free-form, comma-separated
  medicalConditions?: string;    // chronic conditions e.g. "Asthma, Diabetes"
  medications?: string;          // free-form, comma-separated
  addresses?: SavedAddress[];
  fcmToken?: string;
  points?: number;
  helpedCount?: number;
  trustScore?: number;
  badges?: string[];
  location?: { lat: number; lon: number };
  contacts: { name: string; phone: string; relation?: string }[];
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isDemoMode) {
    const raw = localStorage.getItem('resqmed_demo_user_v1');
    if (!raw) return null;
    try {
      const u = JSON.parse(raw);
      if (u.uid !== uid) return null;
      return {
        uid: u.uid,
        name: u.displayName || u.name,
        phone: u.phone,
        email: u.email,
        dob: u.dob || '',
        gender: u.gender || '',
        bloodGroup: u.bloodGroup || '',
        allergies: u.allergies || '',
        medicalConditions: u.medicalConditions || '',
        medications: u.medications || '',
        addresses: u.addresses || [],
        contacts: u.emergencyContacts || u.contacts || [],
        trustScore: u.trustScore ?? 98,
        badges: u.badges || ['Verified Helper', 'CPR Certified'],
      } as UserProfile;
    } catch { return null; }
  }
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
}

/**
 * Check whether a phone number already has a finished account (profile written).
 * Uses a public `phoneIndex/{phone}` doc so anonymous callers can check
 * BEFORE sending an OTP. Requires Firestore rule:
 *   match /phoneIndex/{phone} { allow get: if true; allow create: if request.auth != null; }
 */
export async function isPhoneRegistered(phone: string): Promise<boolean> {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return false;

  if (isDemoMode) {
    const raw = localStorage.getItem('resqmed_demo_user_v1');
    if (!raw) return false;
    try {
      const u = JSON.parse(raw);
      const stored = String(u.phone || '').replace(/\D/g, '');
      return stored === clean;
    } catch { return false; }
  }

  try {
    const snap = await getDoc(doc(db, 'phoneIndex', clean));
    return snap.exists();
  } catch {
    return false;
  }
}

/** Writes the phone → uid index so future logins can pre-check registration. */
export async function registerPhoneIndex(phone: string, uid: string) {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return;
  if (isDemoMode) return;
  try {
    await setDoc(doc(db, 'phoneIndex', clean), { uid }, { merge: true });
  } catch (e) {
    console.warn('phoneIndex write failed:', e);
  }
}

export async function updateUserProfile(uid: string, patch: Partial<UserProfile>) {
  if (isDemoMode) {
    // Persist edits into the same blob so they survive refresh in demo mode.
    try {
      const raw = localStorage.getItem('resqmed_demo_user_v1');
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u.uid !== uid) return;
      const merged = {
        ...u,
        ...patch,
        // keep the historical field names used elsewhere in demo data
        displayName: patch.name ?? u.displayName,
        emergencyContacts: patch.contacts ?? u.emergencyContacts,
      };
      localStorage.setItem('resqmed_demo_user_v1', JSON.stringify(merged));
    } catch { /* ignore */ }
    return;
  }
  await setDoc(doc(db, 'users', uid), patch, { merge: true });
}

/**
 * Live listener for the current user's profile. Emits once immediately with
 * whatever is cached/server-side, then again on every subsequent change.
 *
 * Used by the Profile page to keep the points/tier UI in sync the moment a
 * helper reward lands in Firestore.
 */
export function listenUserProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void
): () => void {
  if (!uid) {
    cb(null);
    return () => {};
  }

  if (isDemoMode) {
    // Demo mode has no realtime feed; fire once from localStorage and bail.
    getUserProfile(uid).then(cb).catch(() => cb(null));
    return () => {};
  }

  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      cb(snap.data() as UserProfile);
    },
    (err) => {
      console.warn('listenUserProfile error:', err);
      cb(null);
    }
  );
}

export async function rewardHelperPoints(uid: string, pointsToAward: number) {
  if (isDemoMode) return;
  const { increment } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', uid), {
    points: increment(pointsToAward),
    helpedCount: increment(1)
  }, { merge: true });
}

export async function requestAndSaveFcmToken(uid: string) {
  if (isDemoMode) return;
  try {
    const { getToken } = await import('firebase/messaging');
    const { messaging } = await import('../firebase/client');
    if (!messaging) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });
      if (token) {
        await updateUserProfile(uid, { fcmToken: token });
      }
    }
  } catch (e) {
    console.log('FCM setup failed/ignored:', e);
  }
}
