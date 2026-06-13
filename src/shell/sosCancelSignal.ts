/**
 * A plain module-level signal (no React state) used to tell GlobalSosWatcher
 * that the user just cancelled an SOS. Setting it is synchronous so it beats
 * any Firestore snapshot callback that fires in the same microtask tick.
 */

let lastCancelledAt = 0;

/** Call this BEFORE navigating away from the SOS page on cancel. */
export const signalSosCancel = () => {
  lastCancelledAt = Date.now();
};

/**
 * Returns true if an SOS cancel was signalled within the last `ms` milliseconds.
 * @param ms Grace window in milliseconds (default 6000ms = 6 seconds)
 */
export const wasSosCancelledRecently = (ms = 6000): boolean => {
  return lastCancelledAt > 0 && Date.now() - lastCancelledAt < ms;
};
