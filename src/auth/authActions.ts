import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { isFirebaseConfigured } from '../app/env';
import { registerPhoneIndex } from '../data/user';

const DEMO_KEY = 'resqmed_demo_user_v1';

// ─── Phone-based auth helpers (Primary) ────────────────────────────────────

/**
 * Mock OTP login with phone number.
 * In demo mode: stores a mock user in localStorage.
 * OTP is not validated (any 4-digit code is accepted in demo).
 */
/**
 * Login only. Does NOT register a new user — caller must pre-check
 * `isPhoneRegistered()` and route to /signup if false.
 * Returns the uid of the signed-in user.
 */
export async function loginWithPhone(phone: string, _otp: string): Promise<string> {
  const cleanPhone = phone.replace(/\D/g, '');
  const email = `phone_${cleanPhone}@arogya.demo`;
  const password = `phone_${cleanPhone}_secret`;

  if (!isFirebaseConfigured) {
    const stored = localStorage.getItem(DEMO_KEY);
    if (!stored) throw new Error('This number is not registered yet.');
    const existing = JSON.parse(stored);
    const storedPhone = String(existing.phone || '').replace(/\D/g, '');
    if (storedPhone !== cleanPhone) {
      throw new Error('This number is not registered yet.');
    }
    sessionStorage.setItem('demo_logged_in', 'true');
    window.dispatchEvent(new Event('demo-auth-changed'));
    return existing.uid as string;
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
}

/**
 * Mock OTP signup with phone number and profile info.
 */
export async function signupWithPhone(input: {
  phone: string;
  name: string;
  bloodGroup?: string;
  emergencyContacts: { name: string; phone: string }[];
}) {
  const cleanPhone = input.phone.replace(/\D/g, '');
  const email = `phone_${cleanPhone}@arogya.demo`;
  const password = `phone_${cleanPhone}_secret`;

  if (!isFirebaseConfigured) {
    const uid = `user-${cleanPhone}`;
    localStorage.setItem(DEMO_KEY, JSON.stringify({
      uid, phone: input.phone, email, displayName: input.name,
      bloodGroup: input.bloodGroup ?? '',
      emergencyContacts: input.emergencyContacts,
    }));
    sessionStorage.setItem('demo_logged_in', 'true');
    window.dispatchEvent(new Event('demo-auth-changed'));
    // Simulate notifying emergency contacts
    console.info(
      `[DEMO] Notified contacts for ${input.name}:`,
      input.emergencyContacts.map(c => `${c.name} (${c.phone})`)
    );
    return;
  }

  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: input.name });
  } catch {
    // Already registered — just update profile
    const cred = await signInWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: input.name });
  }

  await setDoc(doc(db, 'users', uid), {
    role: 'patient', phone: input.phone, name: input.name,
    bloodGroup: input.bloodGroup ?? '', email, createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'patients', uid), {
    name: input.name, bloodGroup: input.bloodGroup ?? '',
    emergencyContacts: input.emergencyContacts,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await registerPhoneIndex(input.phone, uid);
}

// ─── Legacy email/password helpers (kept for doctor/hospital portals) ──────

export async function signup(input: { name: string; email: string; password: string }) {
  if (!isFirebaseConfigured) {
    const uid = `demo-${Date.now()}`;
    localStorage.setItem(DEMO_KEY, JSON.stringify({ uid, email: input.email, displayName: input.name }));
    sessionStorage.setItem('demo_logged_in', 'true');
    window.dispatchEvent(new Event('demo-auth-changed'));
    return;
  }
  const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(cred.user, { displayName: input.name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'patient', name: input.name, email: input.email, createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'patients', cred.user.uid), {
    name: input.name, emergencyContacts: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function login(input: { email: string; password: string }) {
  if (!isFirebaseConfigured) {
    sessionStorage.setItem('demo_logged_in', 'true');
    window.dispatchEvent(new Event('demo-auth-changed'));
    return;
  }
  await signInWithEmailAndPassword(auth, input.email, input.password);
}

export async function wipeMyData(uid: string, phone?: string) {
  if (!isFirebaseConfigured) {
    localStorage.removeItem(DEMO_KEY);
    sessionStorage.removeItem('demo_logged_in');
    window.dispatchEvent(new Event('demo-auth-changed'));
    return;
  }
  try {
    const { deleteDoc } = await import('firebase/firestore');
    const { deleteUser } = await import('firebase/auth');
    
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone) await deleteDoc(doc(db, 'phoneIndex', cleanPhone));
    }
    
    await deleteDoc(doc(db, 'users', uid));
    await deleteDoc(doc(db, 'patients', uid));
    
    if (auth.currentUser) {
      await deleteUser(auth.currentUser);
    } else {
      await signOut(auth);
    }
  } catch (e) {
    console.warn('Wipe data partial failure:', e);
    await signOut(auth);
  }
}

export async function logout() {
  if (!isFirebaseConfigured) { 
    sessionStorage.removeItem('demo_logged_in'); 
    window.dispatchEvent(new Event('demo-auth-changed'));
    return; 
  }
  await signOut(auth);
}
