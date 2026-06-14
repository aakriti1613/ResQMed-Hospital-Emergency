import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';
import { awardPoints } from './points';
import { updateUserProfile, getUserProfile } from './user';
import { isLoggedInUser } from '../lib/challengeUserId';

const STORAGE_KEY = 'arogya_challenge_progress_v1';
const DEMO_POINTS_KEY = 'arogya_demo_points_balance';

export type ChallengeCompletion = {
  eventId: string;
  quizDone?: boolean;
  quizScore?: number;
  scenariosDone?: string[];
  pointsAwarded?: number;
  completedAt?: number;
};

type ProgressStore = Record<string, ChallengeCompletion[]>;

function loadStore(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressStore) : {};
  } catch {
    return {};
  }
}

function saveStore(store: ProgressStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getUserCompletions(userId: string): ChallengeCompletion[] {
  return loadStore()[userId] ?? [];
}

export function getEventCompletion(userId: string, eventId: string): ChallengeCompletion | undefined {
  return getUserCompletions(userId).find((c) => c.eventId === eventId);
}

export function getCompletedChallengeCount(userId: string): number {
  return getUserCompletions(userId).filter(
    (c) => c.quizDone || (c.scenariosDone?.length ?? 0) > 0
  ).length;
}

export function isQuizCompleted(userId: string, eventId: string): boolean {
  return Boolean(getEventCompletion(userId, eventId)?.quizDone);
}

export function isScenarioCompleted(userId: string, eventId: string, scenarioId: string): boolean {
  const done = getEventCompletion(userId, eventId)?.scenariosDone ?? [];
  return done.includes(scenarioId);
}

async function syncPointsToProfile(userId: string, addPoints: number, isAuthenticated: boolean) {
  if (addPoints <= 0) return;

  if (isDemoMode) {
    const current = Number(localStorage.getItem(DEMO_POINTS_KEY) || '120');
    localStorage.setItem(DEMO_POINTS_KEY, String(current + addPoints));
  }

  if (!isAuthenticated) return;

  if (isDemoMode) {
    const profile = await getUserProfile(userId);
    const current = profile?.points ?? 0;
    await updateUserProfile(userId, { points: current + addPoints });
    return;
  }
  const { increment } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', userId), { points: increment(addPoints) }, { merge: true });
}

export async function completeQuiz(
  userId: string,
  eventId: string,
  score: number,
  maxScore: number,
  eventName: string,
  basePoints: number,
  authUid?: string | null
): Promise<{ points: number; alreadyDone: boolean }> {
  const existing = getEventCompletion(userId, eventId);
  if (existing?.quizDone) {
    if (score > (existing.quizScore ?? 0)) {
      const store = loadStore();
      const list = store[userId] ?? [];
      const idx = list.findIndex((c) => c.eventId === eventId);
      if (idx >= 0) {
        list[idx] = { ...list[idx]!, quizScore: score };
        store[userId] = list;
        saveStore(store);
        window.dispatchEvent(new CustomEvent('arogya-challenge-progress'));
      }
    }
    return { points: 0, alreadyDone: true };
  }

  const pct = maxScore > 0 ? score / maxScore : 0;
  const points = Math.round(basePoints * Math.max(0.4, pct));

  const store = loadStore();
  const list = store[userId] ?? [];
  const idx = list.findIndex((c) => c.eventId === eventId);
  const prev = idx >= 0 ? list[idx] : undefined;
  const entry: ChallengeCompletion = {
    eventId,
    scenariosDone: prev?.scenariosDone,
    quizDone: true,
    quizScore: score,
    pointsAwarded: (prev?.pointsAwarded ?? 0) + points,
    completedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  store[userId] = list;
  saveStore(store);
  window.dispatchEvent(new CustomEvent('arogya-challenge-progress'));

  if (!isDemoMode) {
    await awardPoints(userId, points, `${eventName} quiz (${score}/${maxScore})`);
  } else if (points > 0) {
    await awardPoints(userId, points, `${eventName} quiz (${score}/${maxScore})`);
  }
  await syncPointsToProfile(userId, points, isLoggedInUser(authUid));

  return { points, alreadyDone: false };
}

export async function completeScenario(
  userId: string,
  eventId: string,
  scenarioId: string,
  eventName: string,
  scenarioPoints: number,
  wasCorrect: boolean,
  authUid?: string | null
): Promise<{ points: number; alreadyDone: boolean }> {
  const existing = getEventCompletion(userId, eventId);
  if (existing?.scenariosDone?.includes(scenarioId)) {
    return { points: 0, alreadyDone: true };
  }

  const points = wasCorrect ? scenarioPoints : Math.round(scenarioPoints * 0.25);

  const store = loadStore();
  const list = store[userId] ?? [];
  const idx = list.findIndex((c) => c.eventId === eventId);
  const prev = idx >= 0 ? list[idx]! : { eventId, scenariosDone: [] as string[] };
  const scenariosDone = [...(prev.scenariosDone ?? []), scenarioId];
  const entry: ChallengeCompletion = {
    ...prev,
    scenariosDone,
    pointsAwarded: (prev.pointsAwarded ?? 0) + points,
    completedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  store[userId] = list;
  saveStore(store);
  window.dispatchEvent(new CustomEvent('arogya-challenge-progress'));

  if (points > 0) {
    if (!isDemoMode) {
      await awardPoints(userId, points, `${eventName} scenario`);
    } else {
      await awardPoints(userId, points, `${eventName} scenario`);
    }
    await syncPointsToProfile(userId, points, isLoggedInUser(authUid));
  }

  return { points, alreadyDone: false };
}
