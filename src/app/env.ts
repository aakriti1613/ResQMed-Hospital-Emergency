export const isFirebaseConfigured =
  Boolean(import.meta.env.VITE_FIREBASE_API_KEY) &&
  Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID) &&
  Boolean(import.meta.env.VITE_FIREBASE_APP_ID);

export const isDemoMode = !isFirebaseConfigured;

export const functionsOrigin = (import.meta.env.VITE_FUNCTIONS_ORIGIN as string | undefined) || undefined;

