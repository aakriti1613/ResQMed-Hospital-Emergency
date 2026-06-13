import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { useTravelSession, checkInTravelSession, endTravelSession } from '../data/travelSafety';

const GRACE_PERIOD_MS = 60 * 1000; // 60 seconds

export const GlobalTravelWatcher = () => {
  const { session, refresh } = useTravelSession();
  const nav = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [graceTimeLeft, setGraceTimeLeft] = useState(0);

  useEffect(() => {
    if (!session?.isActive) {
      setShowWarning(false);
      return;
    }

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - session.lastCheckIn;
      const totalMs = session.intervalMinutes * 60 * 1000;
      
      if (elapsed >= totalMs) {
        setShowWarning(true);
        const overdueMs = elapsed - totalMs;
        const remainingGrace = Math.max(0, GRACE_PERIOD_MS - overdueMs);
        
        if (remainingGrace === 0) {
          // ESCALATE!
          console.error('🚨 Travel Safety Check-in Missed! Escalating to SOS...');
          clearInterval(checkInterval);
          setShowWarning(false);
          endTravelSession();
          nav('/app/sos?crash=1&severity=major'); // Trigger SOS with high priority
        } else {
          setGraceTimeLeft(Math.ceil(remainingGrace / 1000));
        }
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [session, nav]);

  if (!showWarning) return null;

  return (
    <AnimatePresence>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-x-4 bottom-24 z-[100] rounded-3xl border border-red-500/30 bg-red-950/90 p-5 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 text-red-500">
              <AlertTriangle className="h-6 w-6 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-white">Check-in Required</h3>
              <p className="mt-1 text-sm text-red-200/80">
                You missed your safety check-in. Please confirm you are safe.
              </p>
              <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-400">
                Auto-SOS in {graceTimeLeft}s
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                checkInTravelSession();
                refresh();
                setShowWarning(false);
              }}
              className="w-full rounded-2xl bg-red-600 py-3.5 text-sm font-black text-white hover:bg-red-500 active:scale-95 transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]"
            >
              I'm Safe
            </button>
            <button
              type="button"
              onClick={() => {
                endTravelSession();
                setShowWarning(false);
              }}
              className="w-full rounded-2xl border border-red-500/30 bg-red-950/50 py-3.5 text-sm font-black text-red-200 hover:bg-red-900/50 active:scale-95 transition-all"
            >
              End Trip
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
