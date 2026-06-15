import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ShieldAlert, Navigation, Clock, MapPin, Share2, ShieldCheck, XCircle } from 'lucide-react';
import { useTravelSession, startTravelSession, endTravelSession, checkInTravelSession } from '../../data/travelSafety';
import { LocationSearchModal, type GeoResult } from '../../components/LocationSearchModal';


const INTERVALS = [
  { label: '5 min (Demo)', value: 5 },
  { label: '15 mins', value: 15 },
  { label: '30 mins', value: 30 },
  { label: '1 hour', value: 60 },
];

export const TravelSafetyPage = () => {
  const nav = useNavigate();
  const { session, refresh } = useTravelSession();
  const [destination, setDestination] = useState('');
  const [interval, setIntervalVal] = useState(15);
  const [isCustomInterval, setIsCustomInterval] = useState(false);
  const [checkedInStatus, setCheckedInStatus] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  // Real-time countdown
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!session?.isActive) return;
    
    const tick = () => {
      const now = Date.now();
      const elapsed = now - session.lastCheckIn;
      const totalMs = session.intervalMinutes * 60 * 1000;
      const remaining = Math.max(0, totalMs - elapsed);
      
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeftStr(`${mins}:${secs.toString().padStart(2, '0')}`);
      
      const pct = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
      setProgress(pct);
    };
    
    console.log('[TravelSafetyPage] Effect running. Session is now:', session);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session]);

  const handleStart = () => {
    if (!destination.trim()) return alert('Please enter a destination');
    if (interval <= 0 || isNaN(interval)) return alert('Please enter a valid check-in interval in minutes');
    startTravelSession(destination.trim(), interval);
  };

  const handleShare = () => {
    // Mock sharing safely with rich URL format
    const shareData = {
      title: 'Helmet One Live Tracking',
      text: `I'm travelling to ${session?.destination}. Track my live location securely here:`,
      url: 'https://helmetone.app/track/demo-123'
    };
    
    try {
      if (navigator.share) {
        navigator.share(shareData).catch(console.error);
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        const fallbackText = `${shareData.text} ${shareData.url}`;
        navigator.clipboard.writeText(fallbackText);
        alert('Tracking link copied to clipboard!');
      } else {
        alert(`Link: ${shareData.url}\n\n(Sharing not supported on this browser)`);
      }
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const handleCheckIn = () => {
    console.log('[TravelSafetyPage] "I\'m OK - Check In" clicked!');
    checkInTravelSession();
    refresh(); // Force immediate UI update
    console.log('[TravelSafetyPage] After refresh, session in state is:', session);
    
    // Visual feedback
    setCheckedInStatus(true);
    setTimeout(() => setCheckedInStatus(false), 2000);
  };

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-28 max-w-lg mx-auto w-full space-y-4">
      <button
        type="button"
        onClick={() => nav(-1)}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="rounded-3xl border border-white/[0.08] bg-[#13141a] p-4 relative overflow-hidden mb-6">
        <div
          className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg,#10b981,#3b82f6)' }}
        />
        <div className="relative flex items-start gap-3">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#10b981,#3b82f6)' }}
          >
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Family Safety Mode</div>
            <div className="text-lg font-black text-white">Solo Traveler Protection</div>
            <div className="text-[11px] text-white/45">Share live location and auto-escalate SOS if you miss a check-in.</div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!session?.isActive ? (
          <motion.div key="setup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-white/40 ml-1">Destination</label>
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="w-full relative flex items-center bg-[#13141a] border border-white/[0.06] rounded-2xl py-4 pl-12 pr-4 text-left hover:border-emerald-500/50 transition-all focus:outline-none"
              >
                <Navigation className="absolute left-4 h-5 w-5 text-white/30" />
                <span className={`truncate ${destination ? 'text-white' : 'text-white/20'}`}>
                  {destination || 'Tap to search on Google Maps...'}
                </span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-white/40 ml-1">Check-in Interval</label>
              <div className="grid grid-cols-3 gap-2">
                {INTERVALS.map((int) => (
                  <button
                    key={int.value}
                    onClick={() => {
                      setIntervalVal(int.value);
                      setIsCustomInterval(false);
                    }}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      !isCustomInterval && interval === int.value
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-[#13141a] border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Clock className={`h-4 w-4 ${!isCustomInterval && interval === int.value ? 'text-emerald-400' : 'text-white/20'}`} />
                      <span className="text-[10px] font-bold">{int.label}</span>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => setIsCustomInterval(true)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    isCustomInterval
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-[#13141a] border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Clock className={`h-4 w-4 ${isCustomInterval ? 'text-emerald-400' : 'text-white/20'}`} />
                    <span className="text-[10px] font-bold">Custom</span>
                  </div>
                </button>
              </div>

              {isCustomInterval && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      value={interval || ''}
                      onChange={e => setIntervalVal(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#13141a] border border-white/[0.06] rounded-xl py-3 px-4 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                      placeholder="Enter minutes"
                    />
                    <span className="text-sm font-bold text-white/50 whitespace-nowrap pr-2">minutes</span>
                  </div>
                </motion.div>
              )}
              
              <p className="text-[10px] text-white/30 ml-1 mt-2">If you don't check in, an SOS alert will be automatically triggered.</p>
            </div>

            <button
              onClick={handleStart}
              className="w-full py-4 rounded-2xl font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
            >
              Start Secured Journey
            </button>
          </motion.div>
        ) : (
          <motion.div key="active" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1 bg-emerald-500 transition-all duration-1000 ease-linear" style={{ width: `${progress}%` }} />
              
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-4 animate-pulse">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-black text-white mb-1">Journey Secured</h2>
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-200/80 mb-6">
                <MapPin className="h-4 w-4" /> Heading to {session.destination}
              </div>

              <div className="text-[10px] uppercase tracking-widest text-emerald-300/50 font-black mb-2">Next check-in required in</div>
              <div className="text-5xl font-black text-white tabular-nums tracking-tighter mb-8">
                {timeLeftStr}
              </div>

              <button
                type="button"
                onClick={handleCheckIn}
                disabled={checkedInStatus}
                className={`w-full py-4 rounded-2xl font-black transition-all active:scale-[0.98] mb-3 ${
                  checkedInStatus
                    ? 'bg-emerald-600 text-white shadow-[0_0_30px_rgba(5,150,105,0.6)]'
                    : 'text-emerald-950 bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                }`}
              >
                {checkedInStatus ? '✓ Checked In!' : "I'm OK. Check In"}
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleShare}
                  className="py-3 rounded-2xl font-bold text-sm text-emerald-200 border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Share2 className="h-4 w-4" /> Share Link
                </button>
                <button
                  type="button"
                  onClick={endTravelSession}
                  className="py-3 rounded-2xl font-bold text-sm text-red-300 border border-red-500/30 bg-red-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <XCircle className="h-4 w-4" /> End Trip
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSearch && (
          <LocationSearchModal
            onSelect={(result: GeoResult) => {
              setDestination(result.displayName);
              setShowSearch(false);
            }}
            onClose={() => setShowSearch(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
