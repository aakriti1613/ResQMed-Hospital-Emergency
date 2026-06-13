import { useState, useEffect } from 'react';

export type TravelSession = {
  destination: string;
  intervalMinutes: number;
  lastCheckIn: number; // timestamp
  isActive: boolean;
};

const STORAGE_KEY = 'resqmed_travel_session';

export function getSession(): TravelSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TravelSession;
  } catch {
    return null;
  }
}

function saveSession(session: TravelSession | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event('travel-session-changed'));
}

export function startTravelSession(destination: string, intervalMinutes: number) {
  const session: TravelSession = {
    destination,
    intervalMinutes,
    lastCheckIn: Date.now(),
    isActive: true,
  };
  saveSession(session);
}

export function checkInTravelSession() {
  const s = getSession();
  console.log('[TravelSafety] checkInTravelSession called. Current session from storage:', s);
  if (s && s.isActive) {
    s.lastCheckIn = Date.now();
    console.log('[TravelSafety] Updating lastCheckIn to:', s.lastCheckIn);
    saveSession(s);
  } else {
    console.warn('[TravelSafety] Cannot check in: No active session found in storage!');
  }
}

export function endTravelSession() {
  saveSession(null);
}

export function useTravelSession() {
  const [session, setSession] = useState<TravelSession | null>(getSession());

  const refresh = () => setSession(getSession());

  useEffect(() => {
    window.addEventListener('travel-session-changed', refresh);
    // Also listen to cross-tab sync
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) refresh();
    });
    return () => {
      window.removeEventListener('travel-session-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return { session, refresh };
}
