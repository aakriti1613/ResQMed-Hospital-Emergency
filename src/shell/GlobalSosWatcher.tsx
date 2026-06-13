import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { listenCurrentSosRequest } from '../data/sos';
import { wasSosCancelledRecently } from './sosCancelSignal';

export const GlobalSosWatcher = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!user?.uid) return;

    return listenCurrentSosRequest(user.uid, (req) => {
      if (req && (req.status === 'countdown' || req.status === 'active')) {
        // 1. Check if the user just hit the cancel button (synchronous signal)
        if (wasSosCancelledRecently()) return;

        // 2. Check sessionStorage ignore flag (set when individual SOS is cancelled)
        if (sessionStorage.getItem(`ignore_sos_${req.id}`)) return;

        // 3. Don't redirect if already on SOS or admin page
        if (loc.pathname.includes('/sos') || loc.pathname.includes('/admin')) return;

        // Active SOS — bring user to the SOS screen
        nav('/app/sos');
      }
    });
  }, [user?.uid, loc.pathname, nav]);

  return null;
};
