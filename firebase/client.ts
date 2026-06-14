import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
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

let app: any = null;
let authInstance: any = null;
let dbInstance: any = null;
let storageInstance: any = null;
let functionsInstance: any = null;
let messagingInstance: any = null;

try {
  if (firebaseConfig.apiKey) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    try {
      // v10 stable — no experimental options needed
      dbInstance = initializeFirestore(app, {});
    } catch {
      // initializeFirestore throws if called more than once (e.g. HMR); fall back to getFirestore
      dbInstance = getFirestore(app);
    }
    storageInstance = getStorage(app);
    functionsInstance = getFunctions(app);
  }
} catch (e) {
  console.warn('Firebase initialization skipped or failed. Running in Demo mode.', e);
}

export const firebaseApp = app;
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;
export const functions = functionsInstance;

// Firebase Messaging requires Service Workers — NOT supported in native iOS/Android WebViews.
// We load it lazily and only if serviceWorker is available (i.e. on the web, not in the app).
export const messaging = messagingInstance;

if (app && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  import('firebase/messaging')
    .then(({ getMessaging }) => {
      try {
        messagingInstance = getMessaging(app);
      } catch {
        // silently ignore — not supported in this environment
      }
    })
    .catch(() => {
      // silently ignore — messaging not available
    });
}
