import {
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type TimelineEventDoc = {
  id: string;
  sosId: string;
  timestamp: number;
  eventType: string;
  description: string;
};

/**
 * Log a new event to the live incident timeline.
 */
export async function logTimelineEvent(sosId: string, eventType: string, description: string) {
  if (isDemoMode) {
    console.log('[TIMELINE DEMO]', eventType, description);
    return;
  }

  try {
    await addDoc(collection(db, 'timelineEvents'), {
      sosId,
      eventType,
      description,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[Timeline] Failed to log event:', err);
  }
}

/**
 * Listen for timeline events for a given SOS request.
 */
export function listenTimelineEvents(sosId: string, cb: (events: TimelineEventDoc[]) => void) {
  if (isDemoMode) {
    cb([]);
    return () => {};
  }

  const q = query(
    collection(db, 'timelineEvents'),
    where('sosId', '==', sosId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const results = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sosId: data.sosId,
          eventType: data.eventType,
          description: data.description,
          timestamp: data.createdAt?.toMillis?.() || Date.now(),
        } as TimelineEventDoc;
      });
      // Sort in memory to avoid needing a Firestore composite index
      results.sort((a, b) => a.timestamp - b.timestamp);
      cb(results);
    },
    (err) => {
      console.error('[Timeline] onSnapshot error:', err);
      cb([]);
    }
  );
}
