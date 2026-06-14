import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandHeart, Trophy, CheckCircle2, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthProvider';
import { listenActiveSosRequests, acceptSosRequest, type SosRequestDoc, type ParticipantBrief } from '../../data/sos';
import { getUserProfile, computeAgeFromDob, shortAddressFromProfile } from '../../data/user';

type Tab = 'need-help' | 'leaderboard';

// ── Haversine formula — returns distance in km ────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const URGENCY_COLORS = {
  critical: { bg: 'bg-red-500/15', border: 'border-red-500/25', text: 'text-red-300', label: 'High' },
  major:    { bg: 'bg-amber-500/15', border: 'border-amber-500/25', text: 'text-amber-300', label: 'Medium' },
  high:     { bg: 'bg-amber-500/15', border: 'border-amber-500/25', text: 'text-amber-300', label: 'Medium' },
  minor:    { bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', text: 'text-emerald-300', label: 'Low' },
  low:      { bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', text: 'text-emerald-300', label: 'Low' },
};

const LEADERBOARD_DEMO = [
  { rank: 1, name: 'Priya S.',   helped: 24, points: 4800 },
  { rank: 2, name: 'Arjun M.',  helped: 19, points: 3800 },
  { rank: 3, name: 'Sneha R.',  helped: 15, points: 3000 },
  { rank: 4, name: 'Vikram K.', helped: 11, points: 2200 },
  { rank: 5, name: 'Meera T.',  helped: 8,  points: 1600 },
];

export const HelperDashboardPage = () => {
  const nav = useNavigate();
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<Tab>('need-help');
  const [feed, setFeed] = useState<SosRequestDoc[]>([]);
  const [acceptedId, setAcceptedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tooFarWarning, setTooFarWarning] = useState(false);

  // ── Helper's own GPS coordinates ─────────────────────────────────────────
  const [helperLat, setHelperLat] = useState<number | null>(null);
  const [helperLon, setHelperLon] = useState<number | null>(null);
  const [locStatus, setLocStatus] = useState<'pending' | 'ok' | 'denied'>('pending');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!ready) return;
    if (!user) nav('/login?redirect=/app/helper', { replace: true });
  }, [ready, user, nav]);

  // ── Acquire helper's GPS location for distance-based filtering ────────────
  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHelperLat(p.coords.latitude);
        setHelperLon(p.coords.longitude);
        setLocStatus('ok');
      },
      () => setLocStatus('denied'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  // ── Listen to ALL active SOS requests from Firestore ─────────────────────
  // Client-side filtering handles: hasValidLocation check + 5 km radius
  useEffect(() => {
    return listenActiveSosRequests(setFeed);
  }, []);

  // ── Too-far detection: watch accepted SOS location for updates ────────────
  // CASE 2: accepted helper is now >5 km after victim's location changed
  const acceptedSos = feed.find(req => req.id === acceptedId) ?? null;
  useEffect(() => {
    if (!acceptedSos?.location || helperLat === null || helperLon === null) return;
    const dist = haversineKm(helperLat, helperLon, acceptedSos.location.lat, acceptedSos.location.lon);
    if (dist > 5) {
      setTooFarWarning(true);
      setAcceptedId(null);
      showToast('❌ Location changed — you are too far to assist');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedSos?.location?.lat, acceptedSos?.location?.lon]);

  // ── Filter logic ──────────────────────────────────────────────────────────
  // CASE A: helpers only see SOS with hasValidLocation=true
  // CASE B: filter by 5 km radius when helper location is known
  // CASE 3: new helpers within 5 km see SOS automatically when feed updates
  const visibleFeed = feed.filter(req => {
    if (!req.hasValidLocation || !req.location) return false; // no valid location → never show
    if (helperLat === null || helperLon === null) return true; // no helper GPS → show all valid
    return haversineKm(helperLat, helperLon, req.location.lat, req.location.lon) <= 5;
  });

  const handleHelpNow = async (req: SosRequestDoc) => {
    if (!user) { nav('/login'); return; }
    if (helperLat === null || helperLon === null) {
      showToast('Enable location to accept and share your ETA.');
      return;
    }
    try {
      let hp = null as Awaited<ReturnType<typeof getUserProfile>>;
      try {
        hp = await getUserProfile(user.uid);
      } catch {
        /* optional */
      }
      const helperBrief: ParticipantBrief = {
        name: user.displayName || hp?.name || 'Helper',
        age: hp ? computeAgeFromDob(hp.dob) : undefined,
        shortAddress: shortAddressFromProfile(hp),
        phone: hp?.phone,
        trustScore: hp?.trustScore ?? 98,
        badges: hp?.badges ?? ['Verified Helper', 'CPR Certified'],
      };
      await acceptSosRequest({
        requestId: req.id,
        victimId: req.victimId,
        helperId: user.uid,
        helperName: user.displayName || 'Helper',
        helperBrief,
        helperLocation: { lat: helperLat, lon: helperLon },
      });
      setAcceptedId(req.id);
      setTooFarWarning(false);
      showToast('Accepted — open I Can Help for the full trip screen.');
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message ?? e ?? '');
      if (msg.includes('HELPER_SLOT_FULL')) {
        showToast('Another responder already accepted this SOS.');
      } else {
        showToast('Failed to accept. Please try again.');
      }
    }
  };

  const timeAgo = (ms: number) => {
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60000);
    return min < 1 ? 'just now' : `${min} min ago`;
  };

  if (!user) return null;

  return (
    <div className="min-h-dvh bg-[#0a0b0f] flex flex-col">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full border border-white/10 bg-[#1a1b22] px-5 py-2.5 text-xs font-semibold text-white shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="pt-8 pb-4 px-5">
        <button onClick={() => nav('/')}
          className="mb-4 flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition">
          ← Back to Home
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', boxShadow: '0 0 20px rgba(29,78,216,0.3)' }}>
            <HandHeart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">I Can Help</h1>
            <p className="text-xs text-white/35">Respond to nearby emergencies</p>
          </div>
        </div>

        {/* Helper location status indicator */}
        <div className="mt-3 flex items-center gap-2">
          <MapPin className={`h-3 w-3 shrink-0 ${
            locStatus === 'ok' ? 'text-emerald-400' :
            locStatus === 'denied' ? 'text-amber-400' : 'text-white/25'
          }`} />
          <span className={`text-[10px] ${
            locStatus === 'ok' ? 'text-emerald-400/70' :
            locStatus === 'denied' ? 'text-amber-400/70' : 'text-white/25'
          }`}>
            {locStatus === 'ok'
              ? `Your location: ${helperLat?.toFixed(4)}, ${helperLon?.toFixed(4)} — showing SOS within 5 km`
              : locStatus === 'denied'
              ? 'Location unavailable — showing all valid SOS requests'
              : 'Getting your location…'}
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex rounded-2xl border border-white/[0.05] bg-[#13141a] p-1 gap-1">
          <button
            id="tab-need-help"
            onClick={() => setTab('need-help')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition ${
              tab === 'need-help'
                ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                : 'text-white/35 hover:text-white/60'
            }`}
          >
            🆘 Need Help
          </button>
          <button
            id="tab-leaderboard"
            onClick={() => setTab('leaderboard')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition ${
              tab === 'leaderboard'
                ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                : 'text-white/35 hover:text-white/60'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === 'need-help' && (
            <motion.div key="feed" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="space-y-3">

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
                  {visibleFeed.length} active request{visibleFeed.length !== 1 ? 's' : ''} nearby
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </div>
              </div>

              {/* Too-far warning — shown when victim updated location and helper is now >5 km */}
              <AnimatePresence>
                {tooFarWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.08] p-4 flex items-start gap-3"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black text-amber-300">📍 Location changed — you're too far</div>
                      <div className="text-[10px] text-amber-300/60 mt-0.5 leading-relaxed">
                        The victim's location was updated and you are now more than 5 km away.
                        Your assignment was removed. New helpers near the updated location are being notified.
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {visibleFeed.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mt-10 text-center space-y-3"
                >
                  <div className="text-4xl">✅</div>
                  <div className="text-sm font-black text-white/50">No emergencies nearby</div>
                  <div className="text-[10px] text-white/25 max-w-[220px] mx-auto leading-relaxed">
                    {locStatus === 'ok'
                      ? 'No active SOS requests within 5 km of your location. You\'ll be notified automatically.'
                      : 'No active SOS requests with valid location at this time.'}
                  </div>
                </motion.div>
              )}

              {/* SOS cards — only hasValidLocation=true, within 5 km */}
              {visibleFeed.map((req) => {
                const urgency = URGENCY_COLORS[req.severity as keyof typeof URGENCY_COLORS] ?? URGENCY_COLORS.low;
                const isAccepted = acceptedId === req.id;
                const distKm = (helperLat !== null && helperLon !== null && req.location)
                  ? haversineKm(helperLat, helperLon, req.location.lat, req.location.lon).toFixed(1)
                  : null;

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-3xl border ${urgency.border} ${urgency.bg} p-4 space-y-3`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-black text-white">Emergency nearby</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-white/40">
                            📍 {distKm !== null ? `${distKm} km away` : 'Distance unknown'}
                          </span>
                          <span className="text-white/20">•</span>
                          <span className="flex items-center gap-1 text-[10px] text-white/40">
                            <Clock className="h-3 w-3" />
                            {timeAgo((req as any).createdAt ?? Date.now())}
                          </span>
                          {req.isApproximate && (
                            <>
                              <span className="text-white/20">•</span>
                              <span className="text-[10px] text-amber-400/80">⚠ Approx. location</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${urgency.text} border ${urgency.border}`}>
                        {urgency.label} Urgency
                      </div>
                    </div>

                    {/* Location coordinates (real, from Firestore) */}
                    {req.location && (
                      <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                        <MapPin className="h-3 w-3 text-white/20 shrink-0" />
                        {req.location.lat.toFixed(4)}, {req.location.lon.toFixed(4)}
                        <a
                          href={`https://maps.google.com/?q=${req.location.lat},${req.location.lon}`}
                          target="_blank" rel="noreferrer"
                          className="ml-auto shrink-0 text-blue-400/60 hover:text-blue-400 transition underline underline-offset-2"
                        >
                          Open map
                        </a>
                      </div>
                    )}

                    {isAccepted ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div className="text-xs text-emerald-300 font-semibold">You accepted — head to the location</div>
                      </div>
                    ) : (
                      <button
                        id={`btn-help-now-${req.id}`}
                        onClick={() => handleHelpNow(req)}
                        className="w-full h-11 rounded-2xl text-xs font-black text-white transition active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', boxShadow: '0 0 15px rgba(29,78,216,0.3)' }}
                      >
                        🤝 Help Now
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {tab === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="space-y-3">
              <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1">Community Heroes</div>

              {LEADERBOARD_DEMO.map((entry, i) => (
                <div key={entry.rank}
                  className={`rounded-3xl border p-4 flex items-center gap-4 ${
                    i === 0 ? 'border-amber-500/25 bg-amber-500/8'
                    : i === 1 ? 'border-slate-400/20 bg-slate-400/5'
                    : i === 2 ? 'border-amber-700/20 bg-amber-700/5'
                    : 'border-white/[0.05] bg-white/[0.02]'
                  }`}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-black ${
                    i === 0 ? 'bg-amber-500 text-white'
                    : i === 1 ? 'bg-slate-400 text-[#0a0b0f]'
                    : i === 2 ? 'bg-amber-700 text-white'
                    : 'bg-white/5 text-white/40'
                  }`}>
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white truncate">{entry.name}</div>
                    <div className="text-[10px] text-white/35">{entry.helped} people helped</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-blue-300">{entry.points.toLocaleString()}</div>
                    <div className="text-[10px] text-white/30">points</div>
                  </div>
                </div>
              ))}

              <div className="mt-4 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
                <div className="text-xs text-white/30">Rewards are shown after you help someone</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
