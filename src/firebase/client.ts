import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

/**
 * Firestore init: prefer `initializeFirestore` with long-polling auto-detect.
 * This avoids a class of "INTERNAL ASSERTION FAILED: Unexpected state" errors
 * seen with WebChannel + some browsers / VPNs / HMR teardown races.
 * On HMR, Firestore may already exist — fall back to `getFirestore`.
 */
function createDb(): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const db = createDb();
export const storage = getStorage(firebaseApp);

export const functions = getFunctions(firebaseApp);

let messagingInstance: any = null;
try {
  const { getMessaging } = await import('firebase/messaging');
  messagingInstance = getMessaging(firebaseApp);
} catch (e) {
  console.warn('Firebase Messaging not supported or failed to initialize', e);
}
export const messaging = messagingInstance;
