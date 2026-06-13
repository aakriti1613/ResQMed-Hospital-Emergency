import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type SosMessageRole = 'victim' | 'responder' | 'hospital';

export type SosMessage = {
  id: string;
  sosId: string;
  senderId: string;
  senderName: string;
  role: SosMessageRole;
  text: string;
  createdAt: Date;
};

// Demo mode memory store
let demoMessages: SosMessage[] = [];

export async function sendSosMessage(
  sosId: string,
  senderId: string,
  senderName: string,
  role: SosMessageRole,
  text: string
): Promise<void> {
  if (isDemoMode) {
    const msg: SosMessage = {
      id: `msg-${Date.now()}`,
      sosId,
      senderId,
      senderName,
      role,
      text,
      createdAt: new Date(),
    };
    demoMessages.push(msg);
    // Simulate other tabs syncing by triggering an event if we were to build a full cross-tab event bus,
    // but React state will pick it up on next polling cycle.
    return;
  }

  await addDoc(collection(db, 'sosMessages'), {
    sosId,
    senderId,
    senderName,
    role,
    text,
    createdAt: serverTimestamp(),
  });
}

export function listenSosMessages(sosId: string, cb: (msgs: SosMessage[]) => void): () => void {
  if (isDemoMode) {
    const tick = () => {
      const msgs = demoMessages
        .filter(m => m.sosId === sosId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      cb([...msgs]);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }

  // NOTE: Avoid orderBy + where compound query — requires a composite index
  // and causes INTERNAL ASSERTION FAILED on Firebase 12.x without it.
  // We sort client-side instead.
  const q = query(
    collection(db, 'sosMessages'),
    where('sosId', '==', sosId)
  );

  return onSnapshot(q, (snap) => {
    const msgs: SosMessage[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        sosId: data.sosId,
        senderId: data.senderId,
        senderName: data.senderName,
        role: data.role,
        text: data.text,
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    });
    // Sort chronologically client-side
    msgs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    cb(msgs);
  });
}
