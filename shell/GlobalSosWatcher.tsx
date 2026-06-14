import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { listenCurrentSosRequest, expireStaleSosForUser } from '../data/sos';
import { wasSosCancelledRecently } from './sosCancelSignal';

export const GlobalSosWatcher = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Expire stale SOS docs once per login session so old test data won't hijack navigation.
  useEffect(() => {
    if (!user?.uid) return;
    void expireStaleSosForUser(user.uid).catch(console.warn);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    return listenCurrentSosRequest(user.uid, (req) => {
      if (req && (req.status === 'countdown' || req.status === 'active')) {
        if (wasSosCancelledRecently()) return;
        if (sessionStorage.getItem(`ignore_sos_${req.id}`)) return;
        if (loc.pathname.includes('/sos') || loc.pathname.includes('/admin')) return;

        const from = encodeURIComponent(loc.pathname + loc.search);
        nav(`/app/sos?from=${from}`);
      }
    });
  }, [user?.uid, loc.pathname, loc.search, nav]);

  return null;
};
