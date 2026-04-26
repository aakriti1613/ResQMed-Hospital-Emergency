import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/client';
import { isFirebaseConfigured } from '../app/env';
import { requestAndSaveFcmToken } from '../data/user';

export type AuthUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
  isDemo: boolean;
};

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, ready: false });

const DEMO_KEY = 'resqmed_demo_user_v1';
function getDemoUser(): AuthUser | null {
  const raw = localStorage.getItem(DEMO_KEY);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as { uid: string; email?: string; displayName?: string };
    return { uid: u.uid, email: u.email ?? null, displayName: u.displayName ?? null, isDemo: true };
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const demo = getDemoUser();
      setUser(demo);
      setReady(true);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(mapFirebaseUser(u));
      setReady(true);
      if (u?.uid) {
        // Request and save FCM token for Push Notifications per production requirements
        requestAndSaveFcmToken(u.uid);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({ user, ready }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

function mapFirebaseUser(u: FirebaseUser | null): AuthUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    phoneNumber: u.phoneNumber,
    isDemo: false,
  };
}

