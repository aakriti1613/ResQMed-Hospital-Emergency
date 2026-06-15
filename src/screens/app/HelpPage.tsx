import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  HandHeart, CheckCircle2, Clock, MapPin, Search, AlertTriangle, Car, Phone, Navigation,
  Headphones, ShieldCheck, Building2, Heart, MessageSquare, ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthProvider';
import {
  listenActiveSosRequests,
  acceptSosRequest,
  removeHelperFromSos,
  updateAssignment,
  listenMyAssignment,
  type SosRequestDoc,
  type SosAssignmentDoc,
  type ParticipantBrief,
} from '../../data/sos';
import { rewardHelperPoints, getUserProfile, computeAgeFromDob, shortAddressFromProfile } from '../../data/user';
import { LocationSearchModal } from '../../components/LocationSearchModal';
import { LiveTrackingMap } from '../../components/LiveTrackingMap';
import { useSharedLocation, hasGrantedGPS } from '../../hooks/useSharedLocation';
import { useHelperLiveTracking } from '../../hooks/useHelperLiveTracking';
import { getDistance } from '../../lib/distance';
import { formatEta, formatDistance } from '../../data/routing';
import { HospitalAlertPanel } from '../../components/HospitalAlertPanel';
import type { SosSeverity } from '../../data/sos';
import { SosChatBridge } from '../../components/ui/SosChatBridge';
import { useTranslation } from 'react-i18next';
import { appBackPath, appFromQuery } from '../../lib/challengeNav';

type Tab = 'need-help' | 'leaderboard';
type Sort = 'nearest' | 'urgent';

const URGENCY: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  critical: { bg: 'bg-red-500/12', border: 'border-red-500/20', text: 'text-red-300', dot: 'bg-red-500', label: 'High' },
  high:     { bg: 'bg-amber-500/12', border: 'border-amber-500/20', text: 'text-amber-300', dot: 'bg-amber-400', label: 'Medium' },
  major:    { bg: 'bg-amber-500/12', border: 'border-amber-500/20', text: 'text-amber-300', dot: 'bg-amber-400', label: 'Medium' },
  low:      { bg: 'bg-emerald-500/12', border: 'border-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Low' },
  minor:    { bg: 'bg-emerald-500/12', border: 'border-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Low' },
};

const DEFAULT_URGENCY = { bg: 'bg-emerald-500/12', border: 'border-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Low' };

const LEADERBOARD = [
  { rank: 1, name: 'Priya S.', helped: 24, points: 4800 },
  { rank: 2, name: 'Arjun M.', helped: 19, points: 3800 },
  { rank: 3, name: 'Sneha R.', helped: 15, points: 3000 },
  { rank: 4, name: 'Vikram K.', helped: 11, points: 2200 },
  { rank: 5, name: 'Meera T.', helped: 8, points: 1600 },
];

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : `${m} min ago`;
}

export const HelpPage = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const from = appFromQuery(searchParams.get('from'));
  const backPath = appBackPath(from);
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<Tab>('need-help');
  const [sort, setSort] = useState<Sort>('nearest');
  const [feed, setFeed] = useState<SosRequestDoc[]>([]);
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  // ── Part 4: track SOS IDs where helper became >5km (show inline warning) ─
  const [tooFarSosIds, setTooFarSosIds] = useState<Set<string>>(new Set());
  const removingRef = useRef<Set<string>>(new Set()); // prevents duplicate removeHelperFromSos calls
  
  const [showChat, setShowChat] = useState(false);
  const [chatSosId, setChatSosId] = useState<string | null>(null);

  // ── Redirect to login if user is not authenticated ──
  useEffect(() => {
    if (!ready) return;
    if (!user) nav(`/login?redirect=${encodeURIComponent(`/app/help${from ? `?from=${from}` : ''}`)}`, { replace: true });
  }, [ready, user, nav, from]);

  // Use the authenticated user's ID
  const helperUid = user?.uid ?? '';

  // Debug log. Check console to confirm different IDs per browser profile
  useEffect(() => {
    console.log('[I Can Help] helperUid:', helperUid);
  }, [helperUid]);

  // IMPORTANT: Use a SEPARATE storage key so HelpPage location is fully
  // independent from SosPage. Changes to SOS location won't affect this.
  const { currentLocation, locStatus, saveLocation, requestGPS } = useSharedLocation('arogya_raksha_help_location');
  const [isLocating, setIsLocating] = useState(true);
  const [showManual, setShowManual] = useState(false);

  // ── On mount: silently try GPS. Don't wipe existing location (persists per session) ──
  useEffect(() => {
    requestGPS({ silent: false, showAlert: false }).finally(() => setIsLocating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to SOS feed. Available to ALL users including guests
  useEffect(() => {
    return listenActiveSosRequests((data) => {
      const now = Date.now();
      const fresh = data.filter(r =>
        ((r as any)._createdMs ? now - (r as any)._createdMs < 30 * 60 * 1000 : true)
      );

      // Deduplicate by victimId (keep the most recent one)
      const uniqueFeed = Array.from(
        fresh.reduce((map, req) => {
          const existing = map.get(req.victimId);
          const reqTime = (req as any)._createdMs || 0;
          const existTime = existing ? ((existing as any)._createdMs || 0) : 0;
          if (!existing || reqTime > existTime) {
            map.set(req.victimId, req);
          }
          return map;
        }, new Map<string, SosRequestDoc>()).values()
      );

      console.log('[HELPER] Visible SOS after filtering:', uniqueFeed.length);
      setFeed(uniqueFeed);
    });
  }, [helperUid]);

  // Sync helper location to all active assignments
  useEffect(() => {
    if (!currentLocation || locStatus !== 'ok') return;
    const vals = Object.values(accepted);
    vals.forEach(assignmentId => {
      if (!assignmentId.startsWith('demo-')) {
        updateAssignment(assignmentId, {
          lastLocation: { lat: currentLocation.lat, lon: currentLocation.lon },
        }).catch(() => {});
      }
    });
  }, [currentLocation, locStatus, accepted]);

  // ── Part 4: remove helper when location update puts them >5km away ────────
  useEffect(() => {
    if (!currentLocation || Object.keys(accepted).length === 0) return;

    Object.keys(accepted).forEach(sosRequestId => {
      // Find the SOS in feed to get its location
      const sos = feed.find(r => r.id === sosRequestId);
      if (!sos?.location) return;

      const dist = getDistance(
        currentLocation.lat,
        currentLocation.lon,
        sos.location.lat,
        sos.location.lon
      );

      if (dist > 50.0 && !tooFarSosIds.has(sosRequestId) && !removingRef.current.has(sosRequestId)) {
        removingRef.current.add(sosRequestId);
        console.log('[HELPER] ❌ Too far from SOS', sosRequestId, '- removing from helpersAccepted');
        removeHelperFromSos(sosRequestId, helperUid).catch(console.warn);
        setTooFarSosIds(prev => new Set(prev).add(sosRequestId));
        // Un-accept locally so the "Help Now" button reappears
        setAccepted(prev => {
          const next = { ...prev };
          delete next[sosRequestId];
          return next;
        });
        showToast('❌ You are no longer near this emergency');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation?.lat, currentLocation?.lon]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleHelp = async (req: SosRequestDoc) => {
    if (!currentLocation) {
      showToast('Enable or select location to help others');
      setShowManual(true);
      return;
    }
    let assignmentId: string;
    try {
      console.log('[I Can Help] Accepting SOS as helperId:', helperUid);
      let hp = null as Awaited<ReturnType<typeof getUserProfile>>;
      try {
        hp = await getUserProfile(helperUid);
      } catch {
        /* profile optional */
      }
      const helperBrief: ParticipantBrief = {
        name: user?.displayName || hp?.name || 'Helper',
      };
      const age = hp ? computeAgeFromDob(hp.dob) : undefined;
      if (age !== undefined) helperBrief.age = age;
      const shortAddress = shortAddressFromProfile(hp) ?? currentLocation.displayName;
      if (shortAddress !== undefined) helperBrief.shortAddress = shortAddress;
      if (hp?.phone) helperBrief.phone = hp.phone;
      helperBrief.trustScore = hp?.trustScore ?? 98;
      helperBrief.badges = hp?.badges ?? ['Verified Helper', 'CPR Certified'];
      
      assignmentId = await acceptSosRequest({
        requestId: req.id,
        victimId: req.victimId,
        helperId: helperUid,
        helperName: user?.displayName || 'Helper',
        helperBrief,
        helperLocation: { lat: currentLocation.lat, lon: currentLocation.lon },
      });
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message ?? e ?? '');
      if (msg.includes('HELPER_SLOT_FULL')) {
        showToast('Another responder already accepted this SOS.');
        return;
      }
      console.error('[I Can Help] Accept failed:', e);
      assignmentId = `demo-${Date.now()}`;
    }
    setAccepted((s) => ({ ...s, [req.id]: assignmentId }));
    showToast('Accepted. Shared details are on the way screen.');
  };

  // ── Part 5 / 7: 30-min freshness filter is already applied in sos.ts listener
  // Compute distances. Show ONLY requests <= 5km where victim has valid location
  const items = feed
    .filter(req => {
      if (!req.location || !req.hasValidLocation || !currentLocation) return false;
      const d = getDistance(
        currentLocation.lat, currentLocation.lon,
        req.location.lat,   req.location.lon
      );
      return d <= 50.0;
    })
    .map(req => {
      const dist = getDistance(
        currentLocation!.lat, currentLocation!.lon,
        req.location!.lat,   req.location!.lon
      );
      return { ...req, dist, loc: req.location };
    })
    .sort((a, b) =>
      sort === 'urgent'
        ? (a.severity === 'critical' ? -1 : 1)
        : a.dist - b.dist
    );

  return (
    <div className="min-h-full bg-[#0a0b0f] flex flex-col max-w-lg mx-auto w-full">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#1c1d25] border border-white/10 px-5 py-2.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 pt-10 pb-3">
        {from && (
          <button
            type="button"
            onClick={() => nav(backPath)}
            className="mb-3 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {t('common.back', { defaultValue: 'Back' })}
          </button>
        )}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', boxShadow: '0 0 20px rgba(29,78,216,0.3)' }}>
            <HandHeart className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white">{t('help.iCanHelp')}</h1>
            <p className="text-xs text-white/35">{t('help.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => nav('/app/trips?from=help')}
            className="h-10 px-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition active:scale-95 flex items-center gap-2 text-[11px] font-black text-white/70 shrink-0"
          >
            <Car className="h-4 w-4 text-amber-300" /> {t('help.trips')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl border border-white/[0.05] bg-[#13141a] p-1 gap-1">
          {(['need-help', 'leaderboard'] as const).map((id) => (
            <button key={id} id={`tab-${id}`} onClick={() => setTab(id)}
              className={[
                'flex-1 py-2.5 rounded-xl text-xs font-black transition',
                tab === id
                  ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                  : 'text-white/35 hover:text-white/60',
              ].join(' ')}>
              {id === 'need-help' ? `🆘 ${t('help.needHelp')}` : `🏆 ${t('help.leaderboard')}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* ─── LOCATION BANNER: mirrors SosPage 3-state logic ─── */}
        {(() => {
          const minsAgo = currentLocation
            ? Math.floor((Date.now() - currentLocation.timestamp) / 60000)
            : null;
          const isFresh = minsAgo !== null && minsAgo <= 8;

          // State A: Spinner while initially connecting
          if (!currentLocation && isLocating) {
            return (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
                <div className="w-full flex items-center gap-4 px-5 py-4" style={{ background: '#f5a623' }}>
                  <div className="h-5 w-5 rounded-full border-2 border-[#7c4a00] border-t-transparent animate-spin shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-black text-[#3d2200]">📍 Automatically connecting...</div>
                    <div className="text-xs text-[#7c4a00]">Retrieving your live location</div>
                  </div>
                </div>
              </motion.div>
            );
          }

          // State B: Live GPS active → green + Change manually
          if (currentLocation && isFresh && currentLocation.source === 'gps') {
            return (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
                <div className="w-full flex items-center gap-3 px-5 py-3 border-b border-emerald-500/20" style={{ background: 'rgba(16,185,129,0.06)' }}>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black text-emerald-300">📍 Live Location Active</div>
                    <div className="text-[10px] text-emerald-300/60 truncate">{currentLocation.displayName ?? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`}</div>
                  </div>
                  <span className="text-[10px] text-emerald-400/60 shrink-0">GPS ✓</span>
                </div>
                <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                  <button onClick={() => setShowManual(true)} className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/5 transition">
                    <Search className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="flex-1 text-sm font-bold text-white/50">Change location manually</span>
                  </button>
                </div>
              </motion.div>
            );
          }

          // State C: Stale / manual location → amber + Enable + Change manually
          if (currentLocation) {
            return (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
                <div className="w-full flex items-center gap-3 px-5 py-3 border-b border-amber-500/20" style={{ background: 'rgba(245,166,35,0.07)' }}>
                  <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-amber-300">
                      {currentLocation.source === 'manual' ? 'Manually selected' : 'Last locked location:'} {minsAgo === 0 ? 'just now' : `${minsAgo} min ago`}
                    </div>
                    <div className="text-[10px] text-amber-300/50 truncate">{currentLocation.displayName ?? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`}</div>
                  </div>
                </div>
                <button onClick={() => void requestGPS()} className="w-full flex items-center gap-4 px-5 py-3 text-left transition active:brightness-90" style={{ background: '#f5a623' }}>
                  <div className="flex-1">
                    <div className="text-sm font-black text-[#3d2200]">📍 Enable live GPS</div>
                    <div className="text-xs text-[#7c4a00]">For better accuracy</div>
                  </div>
                  <span className="font-black text-lg text-[#7c4a00]">›</span>
                </button>
                <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                  <button onClick={() => setShowManual(true)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-white/5 transition">
                    <Search className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="flex-1 text-sm font-bold text-white/50">Change location manually</span>
                  </button>
                </div>
              </motion.div>
            );
          }

          // State D: No location at all → yellow prompt (first-time) or retry (returning)
          const alreadyGranted = hasGrantedGPS();
          return (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
              <button onClick={() => void requestGPS()} className="w-full flex items-center gap-4 px-5 py-4 text-left transition active:brightness-90" style={{ background: '#f5a623' }}>
                <MapPin className="h-5 w-5 text-[#7c4a00] shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-black text-[#3d2200]">
                    {alreadyGranted ? '📍 GPS unavailable' : '📍 No location found'}
                  </div>
                  <div className="text-xs text-[#7c4a00]">
                    {alreadyGranted ? 'Tap to retry connecting' : 'Tap to enable live GPS'}
                  </div>
                </div>
                <span className="font-black text-lg text-[#7c4a00]">›</span>
              </button>
              <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                <button onClick={() => setShowManual(true)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-white/5 transition">
                  <Search className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="flex-1 text-sm font-bold text-white/50">Enter location manually</span>
                </button>
              </div>
            </motion.div>
          );
        })()}

        {/* Location Search Modal */}
        <AnimatePresence>
          {showManual && (
            <LocationSearchModal
              onClose={() => setShowManual(false)}
              onSelect={(r) => {
                saveLocation({ lat: r.lat, lon: r.lon, displayName: r.displayName, source: 'manual' });
                setShowManual(false);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ── NEED HELP TAB ── */}
          {tab === 'need-help' && (
            <motion.div key="feed" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="flex flex-col">
              {currentLocation ? (
                <div className="px-4 pt-3 pb-4 space-y-3">
                  {/* Sort bar */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/25 font-bold uppercase tracking-widest">
                      {items.length} active • <span className="text-emerald-400 animate-pulse">●</span> Live
                    </span>
                    <button onClick={() => setSort(s => s === 'nearest' ? 'urgent' : 'nearest')}
                      className="text-[10px] font-bold text-white/40 hover:text-white/70 transition">
                      Sort: {sort === 'nearest' ? 'Nearest' : 'Most Urgent'} ↕
                    </button>
                  </div>

                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <HandHeart className="h-6 w-6 text-white/20" />
                      </div>
                      <p className="text-sm font-bold text-white/40">No active emergencies nearby</p>
                      <p className="text-xs text-white/25 mt-1">You'll be notified when someone needs help within 50km</p>
                    </div>
                  )}

                  {items.map((req, i) => {
                    const u = URGENCY[req.severity] ?? DEFAULT_URGENCY;
                    const distKm = isNaN(req.dist) ? null : req.dist;
                    const distLabel = distKm === null ? 'Location pending' : distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`;
                    const isAccepted = req.id in accepted;
                    const isComplete = completed.has(req.id);
                    // ── Part 4: was previously accepted but removed because now >5km ─────
                    const isTooFar = tooFarSosIds.has(req.id) && !isAccepted;
                    const rloc = req.loc;
                    const createdMs = (req as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds
                      ? (req as unknown as { createdAt: { seconds: number } }).createdAt.seconds * 1000
                      : Date.now();

                    return (
                      <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`mb-3 rounded-3xl border p-4 space-y-3 ${u.bg} ${u.border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${u.dot}`} />
                              <span className="text-sm font-black text-white">Emergency nearby</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-white/40 flex-wrap">
                              <span>📍 {distLabel}</span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" /> {timeAgo(createdMs)}
                              </span>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black border ${u.text} ${u.border}`}>
                            {u.label}
                          </span>
                        </div>

                        {isComplete ? (
                          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                              <span className="text-xs text-emerald-300 font-bold">Task Completed</span>
                            </div>
                            <span className="text-xs font-black text-emerald-400 animate-pulse">+200 pts</span>
                          </div>
                        ) : isTooFar ? (
                          <div className="space-y-2">
                            <div className="flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5">
                              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                              <span className="text-xs font-bold text-red-300">
                                {t('help.tooFar')}
                              </span>
                            </div>
                            <button onClick={() => void handleHelp(req)}
                              className="w-full h-10 rounded-2xl text-xs font-black text-white transition active:scale-95"
                              style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)' }}>
                              {t('help.moveCloser')}
                            </button>
                          </div>
                        ) : isAccepted ? (
                          <div className="space-y-3 pt-2">
                            {rloc ? (
                              <AcceptedTracker
                                requestId={req.id}
                                victimId={req.victimId}
                                helperUid={helperUid}
                                helperName={user?.displayName || undefined}
                                victimLocation={rloc}
                                severity={req.severity}
                                victimBrief={req.victimBrief}
                                onOpenChat={(sosId) => {
                                  setChatSosId(sosId);
                                  setShowChat(true);
                                }}
                              />
                            ) : (
                              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-[10px] text-amber-300/70">
                                ⚠ {t('help.locPending')}
                              </div>
                            )}
                            <button onClick={async () => {
                              if (user) {
                                try { await rewardHelperPoints(user.uid, 200); } catch { /* demo */ }
                              }
                              setCompleted(s => new Set(s).add(req.id));
                              showToast(t('help.pointsAwarded'));
                            }}
                              className="w-full h-11 flex items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-black text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition">
                              <CheckCircle2 className="h-4 w-4 mr-2" /> {t('help.markDone')}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => void handleHelp(req)}
                            className="w-full h-11 rounded-2xl text-xs font-black text-white transition active:scale-95"
                            style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', boxShadow: '0 0 15px rgba(29,78,216,0.3)' }}>
                            🤝 {t('help.helpNow')}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 mt-10">
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2">
                      <MapPin className="h-6 w-6 text-white/20" />
                    </div>
                    <p className="text-sm font-bold text-white/50">{t('help.enableToHelp')}</p>
                    <p className="text-xs text-white/30">{t('help.needLocation')}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── LEADERBOARD TAB ── */}
          {tab === 'leaderboard' && (
            <motion.div key="lb" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="px-4 pt-3 pb-4 space-y-2.5">
              <p className="text-[10px] text-white/25 font-bold uppercase tracking-widest mb-1">{t('help.communityHeroes')}</p>
              {LEADERBOARD.map((e, i) => (
                <div key={e.rank}
                  className={`rounded-3xl border flex items-center gap-4 p-4 ${
                    i === 0 ? 'border-amber-500/20 bg-amber-500/8'
                    : i === 1 ? 'border-slate-400/15 bg-slate-400/5'
                    : i === 2 ? 'border-orange-700/15 bg-orange-700/5'
                    : 'border-white/[0.04] bg-white/[0.02]'
                  }`}>
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${
                    i === 0 ? 'bg-amber-500 text-white'
                    : i === 1 ? 'bg-slate-400 text-slate-900'
                    : i === 2 ? 'bg-orange-700 text-white'
                    : 'bg-white/5 text-white/30'
                  }`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : e.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white truncate">{e.name}</div>
                    <div className="text-[10px] text-white/35">{e.helped} {t('help.peopleHelped')}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-blue-300">{e.points.toLocaleString()}</div>
                    <div className="text-[10px] text-white/30">{t('help.points')}</div>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 text-center text-xs text-white/25">
                {t('help.rewardDisclaimer')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Bridge Drawer */}
      {showChat && chatSosId && (
        <SosChatBridge
          sosId={chatSosId}
          currentUserId={helperUid}
          currentUserName={user?.displayName || t('common.responder')}
          currentUserRole="responder"
          onClose={() => {
            setShowChat(false);
            setChatSosId(null);
          }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// <AcceptedTracker />. Rendered inside an accepted SOS card.
// ─────────────────────────────────────────────────────────────────────────────
const AcceptedTracker = ({
  requestId,
  victimId,
  helperUid,
  helperName,
  victimLocation,
  severity,
  victimBrief,
  onOpenChat,
}: {
  requestId: string;
  victimId: string;
  helperUid: string;
  helperName?: string;
  victimLocation: { lat: number; lon: number };
  severity?: SosSeverity;
  victimBrief?: ParticipantBrief | null;
  onOpenChat: (sosId: string) => void;
}) => {
  const { t } = useTranslation();
  const [assignment, setAssignment] = useState<SosAssignmentDoc | null>(null);
  const [phase, setPhase] = useState<'enroute' | 'hospital'>('enroute');

  useEffect(() => {
    if (!helperUid || !requestId) return;
    return listenMyAssignment(requestId, helperUid, setAssignment);
  }, [requestId, helperUid]);

  useHelperLiveTracking({
    assignmentId: assignment?.id ?? null,
    victimLocation,
    active: !!assignment && assignment.status !== 'reached' && assignment.status !== 'cancelled',
  });

  const helperLoc = assignment?.helperLocation
    ? { lat: assignment.helperLocation.lat, lon: assignment.helperLocation.lon }
    : null;
  const reached = assignment?.status === 'reached' || !!assignment?.arrivedAt;

  useEffect(() => {
    if (reached) setPhase('hospital');
  }, [reached]);

  const victimName = victimBrief?.name?.trim() || t('help.personInDistress');
  const victimAge = victimBrief?.age;
  const victimAddr = victimBrief?.shortAddress?.trim();
  const victimPhone = victimBrief?.phone?.replace(/\s/g, '');

  return (
    <div className="space-y-3">
      <div className="flex rounded-2xl border border-white/[0.08] bg-[#0f1016] p-1 gap-1">
        <button
          type="button"
          onClick={() => setPhase('enroute')}
          className={[
            'flex-1 py-2 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5',
            phase === 'enroute'
              ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.35)]'
              : 'text-white/40 hover:text-white/65',
          ].join(' ')}
        >
          <Navigation className="h-3.5 w-3.5" /> {t('help.onTheWay')}
        </button>
        <button
          type="button"
          onClick={() => setPhase('hospital')}
          className={[
            'flex-1 py-2 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5',
            phase === 'hospital'
              ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(5,150,105,0.35)]'
              : 'text-white/40 hover:text-white/65',
          ].join(' ')}
        >
          <Building2 className="h-3.5 w-3.5" /> {t('help.atHospital')}
        </button>
      </div>

      {phase === 'enroute' ? (
        <>
          <div className="rounded-2xl border border-white/[0.07] bg-[#13141a] p-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white">{t('help.helpIsOnWay')}</div>
              <div className="text-[11px] text-white/45 mt-0.5">{t('help.assignedResponder')}</div>
              <div className="mt-3">
                <div className="text-[10px] font-bold text-white/35 uppercase tracking-wider">ETA</div>
                <div className="text-2xl font-black text-white leading-tight">
                  {assignment?.etaSeconds != null && assignment.etaSeconds > 0
                    ? formatEta(assignment.etaSeconds)
                    : reached
                      ? t('help.arrived')
                      : '-'}
                </div>
                {assignment?.distanceMeters != null && (
                  <div className="text-[11px] text-white/50 font-semibold mt-1">
                    {formatDistance(assignment.distanceMeters)} {t('help.away')}
                  </div>
                )}
              </div>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-2xl shrink-0">
              🚑
            </div>
          </div>

          <button
            onClick={() => onOpenChat(requestId)}
            className="w-full mt-2 rounded-2xl py-4 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
          >
            <MessageSquare className="h-5 w-5" />
            {t('help.chatWith')} {victimName}
          </button>

          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] font-black text-white">{t('help.liveTracking')}</span>
              <span className="text-[10px] font-bold text-sky-400/90">{t('help.mapUpdatesLive')}</span>
            </div>
            <div className="text-[10px] text-white/40 mb-2 px-0.5">{t('help.routeInstruction')}</div>
            <LiveTrackingMap
              viewerRole="helper"
              victim={victimLocation}
              helper={helperLoc}
              routeEncoded={assignment?.routeEncoded}
              etaSeconds={assignment?.etaSeconds}
              distanceMeters={assignment?.distanceMeters}
              height={200}
            />
          </div>

          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">{t('help.victimDetails')}</div>
            <div className="rounded-xl border border-white/[0.06] bg-[#0f1016] px-3 py-2.5 flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-lg">👤</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white truncate">{victimName}</div>
                <div className="text-[11px] text-white/50 mt-0.5">
                  {[victimAge != null ? `${victimAge} ${t('common.years')}` : null, victimAddr || t('help.addressOnProfile')].filter(Boolean).join(' · ')}
                </div>
                <div className="text-[10px] text-white/35 mt-1">{t('help.stayInTouch')}</div>
              </div>
              {victimPhone && (
                <a
                  href={`tel:${victimPhone}`}
                  className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 active:scale-95 transition"
                  aria-label={t('help.callVictim')}
                >
                  <Phone className="h-4 w-4 text-white" />
                </a>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] text-amber-100/90 leading-relaxed">
            <span className="font-black text-amber-300">{t('help.safetyGuide')} </span>
            {t('help.stayCalm')}
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-[#0f1016] px-3 py-2.5 flex gap-2.5">
            <Headphones className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-black uppercase text-emerald-300">{t('common.important')}</div>
              <div className="text-[11px] text-white/75 mt-0.5">{t('help.keepPhoneUnlocked')}</div>
            </div>
          </div>

          {!reached && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                {t('help.streamingLocation')}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-black text-blue-200">
                {assignment?.etaSeconds ? (
                  <>
                    <Clock className="h-3 w-3" />
                    {formatEta(assignment.etaSeconds)}
                    <span className="text-white/30">•</span>
                    <span className="text-white/60">{formatDistance(assignment.distanceMeters)}</span>
                  </>
                ) : (
                  <span className="text-white/50">{t('help.calculating')}</span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/25 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-emerald-200" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white">{t('help.atScene')}</div>
              <div className="text-[11px] text-white/55 mt-1 leading-relaxed">
                {reached
                  ? t('help.reachedInstruction')
                  : t('help.switchHere')}
              </div>
            </div>
            <span className="text-2xl shrink-0">🏥</span>
          </div>

          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] px-3 py-2.5 flex gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] font-black text-emerald-200">{t('help.checkIn')}</div>
              <div className="text-[10px] text-white/55 mt-0.5">
                {t('help.checkInDescription')}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[#13141a] p-3.5 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">{t('help.medicalId')}</div>
            <div className="text-[11px] text-white/60">{t('help.medicalIdPrompt')}</div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 flex items-center gap-2 text-[11px] text-white/70">
              <Heart className="h-4 w-4 text-red-400 shrink-0" />
              {t('help.medicalIdDisclaimer')}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-3.5">
            <div className="text-[11px] font-black text-white">{t('help.howAreFeeling')}</div>
            <div className="text-[10px] text-white/45 mt-0.5 mb-2">{t('help.handoverNote')}</div>
            <div className="flex flex-wrap gap-2">
              {[t('help.feelNotGood'), t('help.feelInPain'), t('help.feelOkay'), t('help.feelBetter')].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/55"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      <HospitalAlertPanel
        requestId={requestId}
        victimId={victimId}
        helperId={helperUid}
        helperName={helperName}
        victimLocation={victimLocation}
        severity={severity}
      />

      {phase === 'hospital' && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 flex gap-2 text-[11px] text-amber-100/90">
          <span className="text-lg shrink-0">💛</span>
          <span><span className="font-black text-amber-200">Thank you. </span>We hope everyone stays safe.</span>
        </div>
      )}
    </div>
  );
};
