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

/**
 * Gemini API key for the in-app health assistant (Kaya).
 *
 * ⚠️ SECURITY: a VITE_* key is bundled into the client and is therefore public.
 * Use this ONLY for local development / demos. In production, leave this unset
 * and route the assistant through the `assistant` Cloud Function, which keeps
 * the key server-side (GEMINI_API_KEY). See src/data/assistant.ts.
 */
export const geminiApiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || undefined;

/** Gemini model id (override if your key has access to a different model). */
export const geminiModel = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-2.0-flash';

