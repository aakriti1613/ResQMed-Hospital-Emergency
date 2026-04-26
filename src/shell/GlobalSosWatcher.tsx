import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { listenCurrentSosRequest } from '../data/sos';

export const GlobalSosWatcher = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!user?.uid) return;
    
    // Globally listen to the backend SOS state
    return listenCurrentSosRequest(user.uid, (req) => {
      if (req && (req.status === 'countdown' || req.status === 'active')) {
        // Prevent race-condition bounce-back if the user literally just cancelled it.
        if (sessionStorage.getItem(`ignore_sos_${req.id}`)) return;

        // If an SOS is active, force navigation to the SOS screen to handle it!
        // Ignored if already on the SOS page or if this tab is running the Admin Simulator
        if (!loc.pathname.includes('/sos') && !loc.pathname.includes('/admin')) {
          nav('/app/sos');
        }
      }
    });
  }, [user?.uid, loc.pathname, nav]);

  return null;
};
