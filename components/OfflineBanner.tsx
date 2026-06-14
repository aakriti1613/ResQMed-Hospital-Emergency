import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const OfflineBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-black text-amber-950 shadow-lg"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          You're offline — SOS alerts will be queued and sent when reconnected
        </motion.div>
      )}
    </AnimatePresence>
  );
};
