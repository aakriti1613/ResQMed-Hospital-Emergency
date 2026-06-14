import { setDoc, doc, updateDoc, serverTimestamp, onSnapshot, collection, query, where, increment } from 'firebase/firestore';
import { db } from '../firebase/client';

export type HardwareSensorDoc = {
  uid: string;
  speedKmh: number;
  impactG: number;
  tiltRatio: number;
  location: { lat: number; lon: number };
  isOnline: boolean;
};

// Start a local loop that decrements any SOS request in 'countdown' status.
// This perfectly simulates a cloud function/backend process.
export function startBackendSimulator() {
  const q = query(collection(db, 'sosRequests'), where('status', '==', 'countdown'));
  const unsub = onSnapshot(q, (snap) => {
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.countdown > 1) {
        // We decrement centrally. In a real system, a single cloud function manages this.
        updateDoc(d.ref, { countdown: increment(-1), updatedAt: serverTimestamp() }).catch(() => {});
      } else if (data.countdown === 1) {
        // Time's up, activate it!
        updateDoc(d.ref, { countdown: 0, status: 'active', updatedAt: serverTimestamp() }).catch(() => {});
      }
    });
  });

  return unsub;
}

export async function setHardwareSensor(uid: string, data: HardwareSensorDoc) {
  await setDoc(doc(db, 'hardwareSensors', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function updateHardwareSensorParam(uid: string, param: Partial<HardwareSensorDoc>) {
  await updateDoc(doc(db, 'hardwareSensors', uid), {
    ...param,
    updatedAt: serverTimestamp(),
  });
}

export function listenHardwareSensor(uid: string, cb: (item: HardwareSensorDoc | null) => void) {
  return onSnapshot(doc(db, 'hardwareSensors', uid), (snap) => {
    if (snap.exists()) {
      cb({ ...snap.data(), uid: snap.id } as HardwareSensorDoc);
    } else {
      cb(null);
    }
  });
}
