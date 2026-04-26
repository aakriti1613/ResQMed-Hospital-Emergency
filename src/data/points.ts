import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type PointLedgerEntry = {
  id: string;
  userId: string;
  points: number;
  reason: string;
  timestamp: any;
};

export type UserPointsBalance = {
  userId: string;
  totalPoints: number;
};

export async function awardPoints(userId: string, points: number, reason: string) {
  if (isDemoMode) {
    // In demo mode, we just return a fake ID
    return `demo-${Date.now()}`;
  }

  // 1. Add ledger entry
  const ref = await addDoc(collection(db, 'pointLedger'), {
    userId,
    points,
    reason,
    timestamp: serverTimestamp(),
  });

  // 2. Atomically update the user's total points summary doc
  await runTransaction(db, async (tx) => {
    const balanceRef = doc(db, 'pointBalances', userId);
    const balanceSnap = await tx.get(balanceRef);
    if (!balanceSnap.exists()) {
      tx.set(balanceRef, { userId, totalPoints: points, updatedAt: serverTimestamp() });
    } else {
      const data: any = balanceSnap.data();
      tx.update(balanceRef, {
        totalPoints: (data.totalPoints || 0) + points,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return ref.id;
}

export function listenUserPointsBalance(userId: string, cb: (balance: number) => void) {
  if (isDemoMode) {
    // Mock baseline
    cb(120);
    return () => {};
  }
  return onSnapshot(doc(db, 'pointBalances', userId), (snap) => {
    if (snap.exists()) {
      const data: any = snap.data();
      cb(data.totalPoints || 0);
    } else {
      cb(0);
    }
  });
}

export function listenUserPointHistory(userId: string, cb: (history: PointLedgerEntry[]) => void) {
  if (isDemoMode) {
    cb([
      { id: '1', userId, points: 50, reason: 'Assisted in severe accident at Mumbai Central', timestamp: new Date(Date.now() - 3600000) },
      { id: '2', userId, points: 20, reason: 'First responder enroute bonus', timestamp: new Date(Date.now() - 86400000) },
      { id: '3', userId, points: 50, reason: 'Aarogya MVP Onboarding Bonus', timestamp: new Date(Date.now() - 172800000) }
    ]);
    return () => {};
  }
  const q = query(collection(db, 'pointLedger'), where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(20));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as PointLedgerEntry[]
    );
  });
}

export function listenLeaderboard(cb: (leaders: UserPointsBalance[]) => void) {
  if (isDemoMode) {
    cb([
      { userId: 'Rahul Mehta', totalPoints: 1240 },
      { userId: 'Priya Nair', totalPoints: 980 },
      { userId: 'Arjun Sharma', totalPoints: 720 },
      { userId: 'Sneha Kapoor', totalPoints: 560 },
      { userId: 'Vikram Singh', totalPoints: 430 },
    ]);
    return () => {};
  }
  const q = query(collection(db, 'pointBalances'), orderBy('totalPoints', 'desc'), limit(10));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as unknown as UserPointsBalance[]
    );
  });
}
