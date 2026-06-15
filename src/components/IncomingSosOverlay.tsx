// ─────────────────────────────────────────────────────────────────────────────
// IncomingSosOverlay. Uber/Rapido-driver-style global SOS popup.
//
// Lives at the root of the app (mounted inside RootLayout) so that any
// authenticated user, on ANY screen, receives a full-screen modal the moment
// a nearby SOS is triggered. Mirrors how ride-hailing apps push a ride
// request to every driver in the vicinity.
//
// Design rules:
//  • Only renders for authenticated users.
//  • Only renders if the user has a known location AND the request is within
//    5 km (same radius the HelpPage uses).
//  • Never renders for the victim themselves (they have SosPage for that).
//  • Never renders on SOS / admin / auth / landing screens (distraction-free).
//  • Session-scoped ignore set so dismissing a request doesn't re-pop it every
//    time Firestore emits a snapshot.
//  • 30-second auto-dismiss timer (like a ride request).
//  • Accepting immediately calls acceptSosRequest() and routes to /app/help
//    which already has the full tracker / mark-as-done flow.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Siren, MapPin, Clock, X, HandHeart, AlertTriangle, Navigation,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { listenActiveSosRequests, acceptSosRequest, type SosRequestDoc, type ParticipantBrief } from '../data/sos';
import { getUserProfile, computeAgeFromDob, shortAddressFromProfile } from '../data/user';
import { useSharedLocation } from '../hooks/useSharedLocation';
import { getDistance } from '../lib/distance';

const IGNORE_KEY = 'arogya_sos_ignored_v1';
const HELPER_MODE_KEY = 'arogya_helper_mode_enabled';
const SNOOZE_UNTIL_KEY = 'arogya_sos_snooze_until';
const POPUP_RADIUS_KM = 5.0;
const AUTO_DISMISS_SECONDS = 30;

// Block where a full-screen popup would be disruptive or redundant.
const BLOCKED_PREFIXES = ['/app/sos', '/app/help', '/admin', '/login', '/signup'];
/** Paths where the popup is allowed but nothing else is (i.e. landing). */
const QUIET_EXACT_PATHS = ['/'];

function loadSessionIgnores(): Set<string> {
  try {
    const raw = sessionStorage.getItem(IGNORE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

function saveSessionIgnores(ids: Set<string>) {
  sessionStorage.setItem(IGNORE_KEY, JSON.stringify([...ids]));
}

export const isHelperModeEnabled = (): boolean => {
  const raw = localStorage.getItem(HELPER_MODE_KEY);
  return raw === null ? true : raw === 'true';
};

export const setHelperModeEnabled = (v: boolean) => {
  localStorage.setItem(HELPER_MODE_KEY, v ? 'true' : 'false');
};

export const IncomingSosOverlay = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const routeLoc = useLocation();
  const { currentLocation } = useSharedLocation('arogya_raksha_help_location');
  const [feed, setFeed] = useState<SosRequestDoc[]>([]);
  const [activeReq, setActiveReq] = useState<SosRequestDoc | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECONDS);
  const [accepting, setAccepting] = useState(false);
  const ignoresRef = useRef<Set<string>>(loadSessionIgnores());

  // Hide on blocked routes
  const isBlocked = useMemo(() => {
    const p = routeLoc.pathname;
    if (QUIET_EXACT_PATHS.includes(p)) return true;
    return BLOCKED_PREFIXES.some((prefix) => p.startsWith(prefix));
  }, [routeLoc.pathname]);

  // Subscribe to active SOS feed (only when signed in)
  useEffect(() => {
    if (!user?.uid) return;
    return listenActiveSosRequests((data) => {
      const now = Date.now();
      const fresh = data.filter((r) =>
        r.victimId !== user.uid &&
        ((r as any)._createdMs ? now - (r as any)._createdMs < 30 * 60 * 1000 : true)
      );
      setFeed(fresh);
    });
  }, [user?.uid]);

  // Decide whether to open the popup for the most-relevant new request
  useEffect(() => {
    if (!user?.uid) return;
    if (isBlocked) return;
    if (!isHelperModeEnabled()) return;
    if (activeReq) return;

    const snoozedUntil = Number(localStorage.getItem(SNOOZE_UNTIL_KEY) || 0);
    if (snoozedUntil && Date.now() < snoozedUntil) return;

    if (!currentLocation) return;

    // Filter to ≤5 km, not already accepted, not in ignore list
    const candidates = feed
      .filter((r) => r.location && r.hasValidLocation !== false)
      .filter((r) => !(r.helpersAccepted ?? []).includes(user.uid))
      .filter((r) => !ignoresRef.current.has(r.id))
      .map((r) => ({
        req: r,
        dist: r.location ? getDistance(
          currentLocation.lat, currentLocation.lon,
          r.location.lat,   r.location.lon,
        ) : Infinity,
      }))
      .filter((x) => x.dist <= POPUP_RADIUS_KM)
      .sort((a, b) => {
        // Prioritise critical, then nearest
        const sa = a.req.severity === 'critical' ? 0 : 1;
        const sb = b.req.severity === 'critical' ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return a.dist - b.dist;
      });

    const pick = candidates[0]?.req ?? null;
    if (pick) {
      setActiveReq(pick);
      setSecondsLeft(AUTO_DISMISS_SECONDS);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }, [feed, user?.uid, isBlocked, currentLocation, activeReq]);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!activeReq) return;
    if (secondsLeft <= 0) {
      dismiss('auto');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [activeReq, secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = (_reason: 'user' | 'auto') => {
    if (!activeReq) return;
    ignoresRef.current.add(activeReq.id);
    saveSessionIgnores(ignoresRef.current);
    setActiveReq(null);
  };

  const snoozeFiveMinutes = () => {
    localStorage.setItem(SNOOZE_UNTIL_KEY, String(Date.now() + 5 * 60 * 1000));
    dismiss('user');
  };

  const accept = async () => {
    if (!activeReq || !user || !currentLocation || accepting) return;
    setAccepting(true);
    let acceptedOk = false;
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
        shortAddress: shortAddressFromProfile(hp) ?? currentLocation.displayName,
        phone: hp?.phone,
        trustScore: hp?.trustScore ?? 98,
        badges: hp?.badges ?? ['Verified Helper', 'CPR Certified'],
      };
      await acceptSosRequest({
        requestId: activeReq.id,
        victimId: activeReq.victimId,
        helperId: user.uid,
        helperName: user.displayName || 'Helper',
        helperBrief,
        helperLocation: { lat: currentLocation.lat, lon: currentLocation.lon },
      });
      acceptedOk = true;
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e ?? '');
      if (msg.includes('HELPER_SLOT_FULL')) {
        // Someone else already accepted. Suppress this request for this session
        // so the popup doesn't loop infinitely while Firestore catches up.
        dismiss('user');
        // Short snooze to avoid rapid re-picks if multiple requests exist.
        localStorage.setItem(SNOOZE_UNTIL_KEY, String(Date.now() + 30_000));
        return;
      } else {
        console.warn('[IncomingSosOverlay] accept failed', e);
        // Avoid infinite reopen loops on transient errors.
        dismiss('user');
        localStorage.setItem(SNOOZE_UNTIL_KEY, String(Date.now() + 30_000));
        return;
      }
    } finally {
      setAccepting(false);
      if (acceptedOk) {
        // Mark as handled so it won't pop again on the next snapshot tick.
        dismiss('user');
        nav('/app/help');
      }
    }
  };

  if (!activeReq || isBlocked) return null;

  const dist = activeReq.location ? getDistance(
    currentLocation!.lat, currentLocation!.lon,
    activeReq.location.lat, activeReq.location.lon,
  ) : null;
  const distLabel = dist === null ? '-'
    : dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;

  const createdMs = (activeReq as any)._createdMs as number | undefined;
  const minsAgo = createdMs ? Math.max(0, Math.floor((Date.now() - createdMs) / 60000)) : 0;

  const severity = activeReq.severity;
  const severityColor =
    severity === 'critical' ? '#ef4444' :
    severity === 'major'    ? '#f59e0b' : '#10b981';
  const severityLabel =
    severity === 'critical' ? 'High priority' :
    severity === 'major'    ? 'Medium priority' : 'Low priority';

  return (
    <AnimatePresence>
      <motion.div
        key="scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      >
        <motion.div
          key="sheet"
          initial={{ y: 40, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative w-full max-w-md rounded-3xl border border-red-500/30 bg-[#13141a] shadow-2xl overflow-hidden"
        >
          {/* Pulse glow */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ boxShadow: '0 0 60px rgba(239,68,68,0.35) inset' }}
          />

          {/* Top badge strip */}
          <div className="relative px-5 pt-5 flex items-start gap-3">
            <div className="relative h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${severityColor}, #b91c1c)`,
                       boxShadow: `0 0 30px ${severityColor}50` }}>
              <Siren className="h-6 w-6 text-white" />
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-2xl border-2"
                style={{ borderColor: severityColor }}
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 1.5 }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                style={{ color: severityColor }}>
                <AlertTriangle className="h-3 w-3" /> {severityLabel}
              </div>
              <div className="text-lg font-black text-white leading-tight">
                Emergency nearby
              </div>
              <div className="text-[11px] text-white/50 mt-0.5">
                Someone needs help. You're the closest volunteer.
              </div>
            </div>
            <button
              onClick={() => dismiss('user')}
              className="h-8 w-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/60 transition shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stats row */}
          <div className="relative mt-4 px-5 grid grid-cols-3 gap-2">
            <StatChip icon={<MapPin className="h-3.5 w-3.5 text-sky-300" />}    label="Distance" value={distLabel} />
            <StatChip icon={<Clock className="h-3.5 w-3.5 text-amber-300" />}  label="Raised" value={minsAgo < 1 ? 'Just now' : `${minsAgo} min ago`} />
            <StatChip icon={<Navigation className="h-3.5 w-3.5 text-emerald-300" />} label="Source" value={activeReq.source === 'hardware' ? 'Crash sensor' : 'Manual'} />
          </div>

          {/* Location preview (textual, map would be overkill for a popup) */}
          {activeReq.location && (
            <div className="relative mt-4 mx-5 rounded-2xl border border-white/[0.06] bg-black/30 px-3 py-2.5 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="text-[11px] text-white/70 font-semibold truncate">
                Lat {activeReq.location.lat.toFixed(4)}, Lon {activeReq.location.lon.toFixed(4)}
              </span>
            </div>
          )}

          {/* Countdown bar */}
          <div className="relative mt-4 mx-5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">
              <span>Auto-dismiss in {secondsLeft}s</span>
              <button
                onClick={snoozeFiveMinutes}
                className="text-white/40 hover:text-white/70 transition font-bold normal-case tracking-normal text-[10px]"
              >
                Snooze 5 min
              </button>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                key={activeReq.id}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: AUTO_DISMISS_SECONDS, ease: 'linear' }}
                className="h-full rounded-full"
                style={{ background: severityColor }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="relative px-5 pt-4 pb-5 flex gap-2">
            <button
              onClick={() => dismiss('user')}
              className="h-12 px-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-black text-white/70 transition active:scale-95"
            >
              Can't help
            </button>
            <button
              onClick={accept}
              disabled={accepting}
              className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', boxShadow: '0 0 25px rgba(29,78,216,0.4)' }}
            >
              <HandHeart className="h-4 w-4" />
              {accepting ? 'Accepting…' : 'I can help now'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const StatChip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-center">
    <div className="flex items-center justify-center mb-1">{icon}</div>
    <div className="text-xs font-black text-white truncate">{value}</div>
    <div className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">{label}</div>
  </div>
);
