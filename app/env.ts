export const isFirebaseConfigured =
  Boolean(import.meta.env.VITE_FIREBASE_API_KEY) &&
  Boolean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) &&
  Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID) &&
  Boolean(import.meta.env.VITE_FIREBASE_APP_ID);

export const isDemoMode = !isFirebaseConfigured;

/** Optional Cloud Functions base (emulator or custom origin). */
export const functionsOrigin = (import.meta.env.VITE_FUNCTIONS_ORIGIN as string | undefined) || undefined;

/** Optional ML crash-severity API (omit in production if unused). */
export const mlSeverityUrl = (import.meta.env.VITE_ML_SEVERITY_URL as string | undefined) || undefined;

