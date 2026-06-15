import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Phone, X, CheckCircle2, ChevronDown, ChevronUp, MapPin, Search, Hospital,
  Car, HeartPulse, Bandage, HelpCircle, Mic, Users, ShieldAlert, Sparkles, Navigation,
  Siren, Ambulance, MessageSquare, Star, Award,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocationSearchModal } from '../../components/LocationSearchModal';
import { FirstAidDrawer } from '../../components/FirstAidDrawer';
import { LiveTrackingMap } from '../../components/LiveTrackingMap';
import { SosChatBridge } from '../../components/ui/SosChatBridge';
import { heartRateBadge, spo2Badge, noMovementBadge } from '../../components/ClinicalBadge';
import { CrashReplay } from '../../components/CrashReplay';
import { useHelmetHistory } from '../../hooks/useHelmetHistory';
import { useSharedLocation, hasGrantedGPS } from '../../hooks/useSharedLocation';
import { useAuth } from '../../auth/AuthProvider';
import {
  createSosRequest,
  listenAssignmentsForRequest,
  listenSosRequestDoc,
  updateSosRequest,
  getActiveSosForUser,
  cancelAllActiveSosForUser,
  type SosAssignmentDoc,
  type SosRequestDoc,
  type IncidentType,
  type ParticipantBrief,
} from '../../data/sos';
import { signalSosCancel } from '../../shell/sosCancelSignal';
import type { MLSeverityResponse } from '../../features/sos/crashDetection';
import { formatEta, formatDistance } from '../../data/routing';
import {
  analyzeSeverityWithML,
} from '../../features/sos/crashDetection';
import { listenAlertsForRequest, type HospitalAlert } from '../../data/hospitalAlerts';
import {
  listenUserProfile,
  getUserProfile,
  computeAgeFromDob,
  shortAddressFromProfile,
  type UserProfile,
} from '../../data/user';
import { IncidentTimeline, type TimelineStep } from '../../components/ui/IncidentTimeline';
import { listenTimelineEvents, type TimelineEventDoc } from '../../data/timeline';
import { useSosEscalationMonitor } from '../../features/sos/useSosEscalationMonitor';
import { useTranslation } from 'react-i18next';

/** Helmet One reference: 10s auto-send countdown (same for manual SOS + crash). */
const HELMET_COUNTDOWN_SEC = 10;

type HelmetActiveStep = 'alert_sent' | 'live_track' | 'guidance' | 'at_hospital';

const HELPLINES = [
  { label: 'Ambulance', number: '108', color: '#10b981' },
  { label: 'Police', number: '100', color: '#3b82f6' },
  { label: 'Women Helpline', number: '1091', color: '#a855f7' },
  { label: 'Fire', number: '101', color: '#f97316' },
];

export const SosPage = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isHardwareCrash =
    searchParams.get('crash') === '1' ||
    (!!searchParams.get('lat') && !!searchParams.get('lon'));

  // ── Stable guest UID stored in localStorage (survives refreshes + tabs) ───
  const [guestId] = useState(() => {
    let gid = localStorage.getItem('arogya_guest_uid');
    if (!gid) {
      gid = 'guest-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('arogya_guest_uid', gid);
    }
    return gid;
  });
  const uid = user?.uid ?? guestId;

  // ── Core SOS state ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'countdown' | 'active' | 'safe'>('countdown');
  const [helmetFlowStep, setHelmetFlowStep] = useState<HelmetActiveStep>('alert_sent');
  const [cdown, setCdown] = useState(HELMET_COUNTDOWN_SEC);
  const [sosId, setSosId] = useState<string | null>(null);
  const [sosLocation, setSosLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [noLocationMode, setNoLocationMode] = useState(false);
  const [assignments, setAssignments] = useState<SosAssignmentDoc[]>([]);
  const [liveSosDoc, setLiveSosDoc] = useState<SosRequestDoc | null>(null);
  const [hospitalAlerts, setHospitalAlerts] = useState<HospitalAlert[]>([]);
  const [firstAidOpen, setFirstAidOpen] = useState(false);
  const [crashReplayOpen, setCrashReplayOpen] = useState(false);
  const helmetHist = useHelmetHistory(user?.uid, 60);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [helperPublic, setHelperPublic] = useState<UserProfile | null>(null);
  const [ambulanceAssigned, setAmbulanceAssigned] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // ── Helmet-One style intake captured during the countdown ───────────────
  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  // ── "How are you feeling?" mood captured after marking safe ─────────────
  const [feelingMood, setFeelingMood] = useState<string | null>(null);
  
  // ── ML Integration & Manual Override State ────────────────────────────────
  const hwGforce = searchParams.get('gforce');
  const hwSeverity = (searchParams.get('severity') as 'minor'|'major'|'critical') || 'major';
  const [manualSeverity, setManualSeverity] = useState<'minor'|'major'|'critical'>('major');
  const [mlData, setMlData] = useState<MLSeverityResponse | null>(null);

  // ── Auto-Escalation State & Mock Vitals ──────────────────────────────────
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventDoc[]>([]);
  const [mockHr, setMockHr] = useState(75);
  const [mockSpo2, setMockSpo2] = useState(98);
  const [mockNoMovement, setMockNoMovement] = useState(0);

  useEffect(() => {
    if (isHardwareCrash && hwGforce) {
      // Simulate the window from gforce just to get model 3
      analyzeSeverityWithML(
        { accelerationG: parseFloat(hwGforce), speedKmh: 40, lat: 0, lon: 0, orientation: 'normal', vibration: 50 },
        40
      ).then(res => {
        if (res) setMlData(res);
      });
    }
  }, [isHardwareCrash, hwGforce]);

  const [showManual, setShowManual] = useState(false);
  const [showHelplines, setShowHelplines] = useState(false);
  const [callPopup, setCallPopup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [helperAcceptedToast, setHelperAcceptedToast] = useState<{
    helperName: string;
    helperSub?: string;
    etaLine?: string;
  } | null>(null);
  // ── Demo helper popup (temporary) ─────────────────────────────────────────

  const [isLocating, setIsLocating] = useState(true);

  const isDoneRef = useRef(false);    // blocks all state updates after cancel/resolve
  const createdRef = useRef(false);   // prevents duplicate Firestore writes
  // ── Part 2: throttle location-sync writes to max 1 per 5 seconds ─────────
  const lastLocUpdateRef = useRef(0);

  const { currentLocation, saveLocation, requestGPS } = useSharedLocation();

  const activeAssignments = useMemo(
    () => assignments.filter((a) => a.status !== 'cancelled'),
    [assignments],
  );

  const { contactedDisplay, primaryResponder, trackedAssignment } = useMemo(() => {
    const assignedLen = liveSosDoc?.helpersAssigned?.length ?? 0;
    const steppedUp = activeAssignments.length;
    const contactedDisplay = Math.max(assignedLen, steppedUp);
    const primaryId = liveSosDoc?.primaryHelperId;
    const primaryResponder = primaryId
      ? activeAssignments.find((a) => a.helperId === primaryId) ?? activeAssignments[0] ?? null
      : activeAssignments[0] ?? null;
    const tracked =
      primaryResponder?.helperLocation && primaryResponder.status !== 'cancelled'
        ? primaryResponder
        : activeAssignments.find((a) => a.helperLocation && a.status !== 'cancelled') ?? null;
    return { contactedDisplay, primaryResponder, trackedAssignment: tracked };
  }, [liveSosDoc, activeAssignments]);

  const primaryHelperId = primaryResponder?.helperId;
  useEffect(() => {
    if (!primaryHelperId || phase !== 'active') {
      setHelperPublic(null);
      return;
    }
    let cancelled = false;
    void getUserProfile(primaryHelperId).then((p) => {
      if (!cancelled) setHelperPublic(p);
    });
    return () => { cancelled = true; };
  }, [primaryHelperId, phase]);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── When a helper accepts, proactively surface it (Rapido/Uber-style) ─────
  const lastPrimaryHelperRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== 'active') return;
    const a = primaryResponder;
    const hid = a?.helperId ?? null;
    if (!hid || hid === lastPrimaryHelperRef.current) return;
    lastPrimaryHelperRef.current = hid;

    const hb = a?.helperBrief;
    const hName = (hb?.name || a?.helperName || 'Responder').trim();
    const hAge = hb?.age ?? (helperPublic ? computeAgeFromDob(helperPublic.dob) : undefined);
    const hAddr = hb?.shortAddress ?? shortAddressFromProfile(helperPublic);
    const etaLine = a?.etaSeconds
      ? `${formatEta(a.etaSeconds)}${a.distanceMeters != null ? ` · ${formatDistance(a.distanceMeters)}` : ''}`
      : (a?.distanceMeters != null ? `${formatDistance(a.distanceMeters)} away` : undefined);

    setHelperAcceptedToast({
      helperName: hName,
      helperSub: [hAge != null ? `${hAge} yrs` : null, hAddr ?? null].filter(Boolean).join(' · ') || undefined,
      etaLine,
    });
    const t = setTimeout(() => setHelperAcceptedToast(null), 6000);
    return () => clearTimeout(t);
  }, [phase, primaryResponder, helperPublic]);

  const uiPrimaryResponder = primaryResponder;

  useEffect(() => {
    if (phase === 'active') {
      const timer = setTimeout(() => {
        setAmbulanceAssigned(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // ── Mount: auto-connect GPS (do NOT clear existing location. It may be the
  //    only fix we have if GPS is blocked and user chose manual location)
  useEffect(() => {
    requestGPS({ silent: true, showAlert: false }).finally(() => setIsLocating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Helmet crash + SOS share the same flow; hardware defaults to crash intake.
  useEffect(() => {
    if (isHardwareCrash) setIncidentType((t) => t ?? 'crash');
  }, [isHardwareCrash]);

  // ── Resume check: if user already has an active SOS, skip countdown ───────
  useEffect(() => {
    let isCancelled = false;
    getActiveSosForUser(uid).then((existing) => {
      if (isCancelled) return;
      if (!existing || isDoneRef.current || createdRef.current) return;
      if (existing.status !== 'active') return;
      console.log('[SOS] Resuming existing active SOS:', existing.id);
      createdRef.current = true;
      setSosId(existing.id);
      setSosLocation(existing.location ?? null);
      setNoLocationMode(!existing.hasValidLocation);
      setPhase('active');
      setHelmetFlowStep('live_track');
      setCdown(0);
    }).catch(console.error);
    
    return () => { isCancelled = true; };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── LOCAL COUNTDOWN. Zero Firestore writes during this phase ────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setInterval(() => {
      if (isDoneRef.current) { clearInterval(timer); return; }
      setCdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // ── SOS creation. Evaluates finalLocation at countdown=0 ─────────────────
  // Keep a ref so the effect below always calls the LATEST version
  // (capturing the latest currentLocation value at fire time).
  const createSosRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const createSos = useCallback(async () => {
    console.log('[SOS] createSos EXECUTING! isHardwareCrash:', isHardwareCrash);
    // ── FINAL LOCATION PRIORITY CHAIN ────────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const hwLat = params.get('lat');
    const hwLon = params.get('lon');
    const now = Date.now();

    let finalLocation: { lat: number; lon: number; isApproximate?: boolean } | null = null;

    if (hwLat && hwLon) {
      // 1. Hardware sensor coordinates (crash detection). Highest priority
      finalLocation = { lat: Number(hwLat), lon: Number(hwLon) };
    } else if (currentLocation?.source === 'gps' && now - currentLocation.timestamp < 2 * 60 * 1000) {
      // 2. Live GPS. Fresh within 2 minutes
      finalLocation = { lat: currentLocation.lat, lon: currentLocation.lon };
    } else if (currentLocation?.source === 'manual') {
      // 3. Manually selected location
      finalLocation = { lat: currentLocation.lat, lon: currentLocation.lon };
    } else if (currentLocation && now - currentLocation.timestamp < 8 * 60 * 1000) {
      // 4. Last known location. Within 8 minutes (marked as approximate)
      finalLocation = { lat: currentLocation.lat, lon: currentLocation.lon, isApproximate: true };
    }
    // else → no location at all (null)

    console.log('SOS location used:', finalLocation);

    const hasValidLoc = finalLocation !== null;
    setNoLocationMode(!hasValidLoc);
    setSosLocation(finalLocation ? { lat: finalLocation.lat, lon: finalLocation.lon } : null);

    const victimBrief: ParticipantBrief = {
      name:
        profile?.name?.trim() ||
        user?.displayName?.trim() ||
        (uid.startsWith('guest-') ? 'Guest rider' : 'User'),
    };
    const age = profile ? computeAgeFromDob(profile.dob) : undefined;
    if (age !== undefined) victimBrief.age = age;
    
    const shortAddress = shortAddressFromProfile(profile) ??
      (currentLocation?.displayName
        ? currentLocation.displayName.length > 48
          ? `${currentLocation.displayName.slice(0, 46)}…`
          : currentLocation.displayName
        : undefined);
    if (shortAddress !== undefined) victimBrief.shortAddress = shortAddress;
    
    const phone = profile?.phone?.trim();
    if (phone) victimBrief.phone = phone;

    console.log('[SOS] Calling createSosRequest...');
    // Fire-and-forget: Do NOT await so the UI transitions instantly!
    createSosRequest({
      victimId: uid,
      status: 'active',
      severity: isHardwareCrash ? hwSeverity : manualSeverity,
      source: hwLat ? 'hardware' : 'mobile',
      countdown: 0,
      location: finalLocation ? { lat: finalLocation.lat, lon: finalLocation.lon } : null,
      hasValidLocation: hasValidLoc,
      isApproximate: finalLocation?.isApproximate ?? false,
      radiusKm: 5,
      incidentType: incidentType ?? undefined,
      victimBrief,
    })
      .then((saved) => {
        console.log('[SOS] ✅ Saved to Firestore as active:', saved.id, '| location:', finalLocation);
        setSosId(saved.id);
      })
      .catch((err) => {
        console.error('[SOS] ❌ Firestore write FAILED inside createSos:', err);
        showToast('SOS sent (offline mode. Check console for error)');
      });

    console.log('[SOS] createSos finished Firestore call, setting phase active...');
    setHelmetFlowStep('alert_sent');
    setPhase('active');
    console.log('[SOS] Phase set to active.');
  }, [uid, currentLocation, showToast, incidentType, profile, user]);

  // Keep ref in sync so effect below always calls the latest createSos
  useEffect(() => { createSosRef.current = createSos; }, [createSos]);

  // ── Fire createSos exactly once when countdown hits zero ──────────────────
  useEffect(() => {
    if (cdown !== 0 || phase !== 'countdown' || createdRef.current || isDoneRef.current) return;
    console.log('[SOS] Countdown hit 0 naturally! Triggering createSosRef.current...');
    createdRef.current = true;
    void createSosRef.current?.();
  }, [cdown, phase]);

  // ── LOCATION SYNC: patch Firestore when location changes while SOS is active
  // Throttled: max 1 write per 5 seconds. Deduped: skips if coords unchanged.
  useEffect(() => {
    if (phase !== 'active' || !sosId || isDoneRef.current || !currentLocation) return;

    // ── Part 2: throttle ─────────────────────────────────────────────────────
    const now = Date.now();
    if (now - lastLocUpdateRef.current < 5000) return;

    const newLoc = { lat: currentLocation.lat, lon: currentLocation.lon };
    const isSame =
      sosLocation &&
      Math.abs(sosLocation.lat - newLoc.lat) < 0.0001 &&
      Math.abs(sosLocation.lon - newLoc.lon) < 0.0001;

    if (isSame) return;

    lastLocUpdateRef.current = now;
    console.log('[SOS] 📍 Location updated (throttled). Patching Firestore:', newLoc);
    setSosLocation(newLoc);
    setNoLocationMode(false);
    updateSosRequest(sosId, { location: newLoc, hasValidLocation: true, isApproximate: false, lastUpdated: now })
      .then(() => console.log('[SOS] ✅ Firestore location patched to:', newLoc))
      .catch((e) => console.error('[SOS] ❌ Patch failed:', e));
  }, [currentLocation, phase, sosId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live SOS document (primary helper, helpersAssigned for Rapido-style counts)
  useEffect(() => {
    if (!sosId) {
      setLiveSosDoc(null);
      return;
    }
    return listenSosRequestDoc(sosId, (doc) => {
      if (isDoneRef.current) return;
      setLiveSosDoc(doc);
    });
  }, [sosId]);

  // ── Listen to helper assignments for this SOS ─────────────────────────────
  useEffect(() => {
    if (!sosId) return;
    return listenAssignmentsForRequest(sosId, setAssignments);
  }, [sosId]);

  // ── Listen to hospital alerts that helpers raise for this SOS ─────────────
  useEffect(() => {
    if (!sosId) { setHospitalAlerts([]); return; }
    return listenAlertsForRequest(sosId, setHospitalAlerts);
  }, [sosId]);

  // ── Listen to current user's profile (for emergency contact count, etc.) ─
  useEffect(() => {
    if (!user?.uid) { setProfile(null); return; }
    return listenUserProfile(user.uid, setProfile);
  }, [user?.uid]);

  // ── Listen to live timeline events ─────────────────────────────────────────
  useEffect(() => {
    if (!sosId) { setTimelineEvents([]); return; }
    return listenTimelineEvents(sosId, setTimelineEvents);
  }, [sosId]);

  // ── Start Escalation Monitor ───────────────────────────────────────────────
  useSosEscalationMonitor({
    sosId,
    liveSosDoc,
    assignments,
    heartRate: mockHr,
    spo2: mockSpo2,
    noMovementDuration: mockNoMovement,
  });

  // ── NAVIGATION HELPERS ────────────────────────────────────────────────────
  const goHome = useCallback(() => {
    const fromParam = searchParams.get('from');
    if (fromParam === 'landing') {
      nav('/', { replace: true });
    } else if (fromParam && fromParam.startsWith('/')) {
      // Decode and return exactly where they came from
      nav(decodeURIComponent(fromParam), { replace: true });
    } else {
      nav(user && !user.isDemo ? '/app' : '/', { replace: true });
    }
  }, [nav, user, searchParams]);

  // ── Cancel: bulk-cancel ALL active/countdown SOS docs for this user ────────
  const cancelAndClearAll = useCallback(async () => {
    // ⚡ Signal FIRST (synchronous). GlobalSosWatcher checks this before any
    //    React state or Firestore snapshot can fire.
    signalSosCancel();
    isDoneRef.current = true;
    // Navigate home immediately so the user isn't left waiting
    goHome();
    // Fire-and-forget the Firestore cancellation in the background
    try {
      // Flag current sosId in sessionStorage too (belt-and-suspenders)
      if (sosId) sessionStorage.setItem(`ignore_sos_${sosId}`, 'true');
      // Bulk-cancel every active/countdown SOS doc for this user
      const cancelledIds = await cancelAllActiveSosForUser(uid);
      cancelledIds.forEach(id => sessionStorage.setItem(`ignore_sos_${id}`, 'true'));
    } catch (e) {
      console.warn('[SOS] Cancel sweep error (non-fatal):', e);
    }
  }, [sosId, uid, goHome]);

  const cancelAlert = useCallback(() => {
    showToast('Alert cancelled.');
    void cancelAndClearAll();
  }, [cancelAndClearAll, showToast]);

  const stopAlert = useCallback(() => {
    void cancelAndClearAll();
  }, [cancelAndClearAll]);

  const markSafe = useCallback(() => {
    isDoneRef.current = true;
    showToast('You are safe! Notifying helpers…');
    if (sosId) {
      sessionStorage.setItem(`ignore_sos_${sosId}`, 'true');
      updateSosRequest(sosId, { status: 'resolved' }).catch(console.warn);
    }
    setPhase('safe');
  }, [sosId, showToast]);

  const sendHelpNow = useCallback(() => {
    console.log('[SOS] sendHelpNow clicked! isDone:', isDoneRef.current, 'created:', createdRef.current);
    if (isDoneRef.current || createdRef.current) return;
    createdRef.current = true;
    setCdown(0);
    console.log('[SOS] calling createSosRef.current...');
    void createSosRef.current?.();
  }, []);

  const simulateVoiceFallback = () => {
    const speech = new SpeechSynthesisUtterance(
      'Emergency detected. Possible accident. Location has been shared. Please respond immediately.'
    );
    window.speechSynthesis.speak(speech);
    showToast('🎙️ Voice fallback audio playing');
  };

  const pct = ((HELMET_COUNTDOWN_SEC - cdown) / HELMET_COUNTDOWN_SEC) * 100;
  const circumference = 2 * Math.PI * 54;
  // Display priority: confirmed SOS location → live GPS → null
  const displayCoords = sosLocation ?? (currentLocation ? { lat: currentLocation.lat, lon: currentLocation.lon } : null);

  const timelineSteps: TimelineStep[] = useMemo(() => {
    const isHospitalAlerted = hospitalAlerts.some(a => a.status !== 'cancelled');
    const isResolved = liveSosDoc?.status === 'resolved';
    
    const baseSteps: TimelineStep[] = [
      {
        id: '1',
        label: t('timeline.emergencyTriggered'),
        status: 'completed',
        time: t('common.justNow'),
      },
      {
        id: '2',
        label: t('timeline.nearbyAlertsSent'),
        subLabel: t('timeline.respondersNotified', { count: contactedDisplay }),
        status: 'completed',
      },
      {
        id: '3',
        label: t('timeline.responderAccepted'),
        subLabel: activeAssignments.length > 0
          ? t('timeline.respondersAssigned', { count: activeAssignments.length })
          : t('timeline.waitingResponder'),
        status: activeAssignments.length > 0 ? 'completed' : 'active',
      }
    ];

    const dynamicSteps: TimelineStep[] = timelineEvents.map((e, idx) => ({
      id: `dyn_${idx}`,
      label: e.eventType.replace(/_/g, ' '),
      subLabel: e.description,
      status: 'completed' as const,
      time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    const finalSteps = [...baseSteps, ...dynamicSteps];

    finalSteps.push(
      {
        id: '4',
        label: t('timeline.ambulanceAssigned'),
        subLabel: ambulanceAssigned ? t('timeline.ambulanceDispatched') : t('timeline.assigningAmbulance'),
        status: ambulanceAssigned ? 'completed' : 'active',
      },
      {
        id: '5',
        label: t('timeline.hospitalNotified'),
        subLabel: isHospitalAlerted ? t('timeline.hospitalPreparing') : t('timeline.awaitingHospital'),
        status: isHospitalAlerted ? 'completed' : (ambulanceAssigned ? 'active' : 'pending'),
      },
      {
        id: '6',
        label: t('timeline.patientHandedOver'),
        subLabel: isResolved ? t('timeline.emergencyResolved') : undefined,
        status: isResolved ? 'completed' : 'pending',
      }
    );

    return finalSteps;
  }, [t, contactedDisplay, activeAssignments.length, ambulanceAssigned, hospitalAlerts, liveSosDoc?.status, timelineEvents]);

  return (
    <div className="min-h-dvh bg-[#0a0b0f] flex flex-col overflow-hidden">
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

      {/* Helper accepted (victim). Auto popup */}
      <AnimatePresence>
        {helperAcceptedToast && (
          <motion.div
            initial={{ y: -18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -18, opacity: 0, scale: 0.98 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.08] backdrop-blur px-4 py-3 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>
                🚑
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">{t('sos.responderAccepted')}</div>
                <div className="text-sm font-black text-white truncate">{helperAcceptedToast.helperName}</div>
                {helperAcceptedToast.helperSub && (
                  <div className="text-[11px] text-white/55 truncate">{helperAcceptedToast.helperSub}</div>
                )}
                {helperAcceptedToast.etaLine && (
                  <div className="mt-1 text-[11px] font-black text-emerald-200">{helperAcceptedToast.etaLine} {t('sos.away')}</div>
                )}
              </div>
              <button
                onClick={() => setHelperAcceptedToast(null)}
                className="h-8 w-8 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-center shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-white/60" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOCATION BANNER: 3 states ─────────────────────────────────────── */}
      {(() => {
        const minsAgo = currentLocation
          ? Math.floor((Date.now() - currentLocation.timestamp) / 60000)
          : null;
        const isFresh = minsAgo !== null && minsAgo <= 8;

        // State 1: No location at all → yellow warning banner
        if (!currentLocation) {
          if (isLocating) {
            return (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="z-10 w-full shrink-0">
                <div className="w-full flex items-center gap-4 px-5 py-4 text-left" style={{ background: '#f5a623' }}>
                  <div className="h-5 w-5 rounded-full border-2 border-[#7c4a00] border-t-transparent animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-[#3d2200]">📍 Automatically connecting...</div>
                    <div className="text-xs text-[#7c4a00]">Retrieving highly accurate GPS coordinates</div>
                  </div>
                </div>
              </motion.div>
            );
          }

          const alreadyGranted = hasGrantedGPS();

          return (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="z-10 w-full shrink-0">
              <button
                onClick={() => void requestGPS()}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition active:brightness-90"
                style={{ background: '#f5a623' }}
              >
                <MapPin className="h-5 w-5 shrink-0 text-[#7c4a00]" />
                <div className="flex-1">
                  <div className="text-sm font-black text-[#3d2200]">
                    {alreadyGranted ? '📍 GPS unavailable' : '📍 No location found'}
                  </div>
                  <div className="text-xs text-[#7c4a00]">
                    {alreadyGranted ? 'Tap to retry connecting' : 'Tap to enable live GPS for better accuracy'}
                  </div>
                </div>
                <span className="font-black text-lg text-[#7c4a00]">›</span>
              </button>
              <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                <button
                  onClick={() => setShowManual(true)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-white/5 transition"
                >
                  <Search className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="flex-1 text-sm font-bold text-white/50">Or enter location manually</span>
                </button>
              </div>
            </motion.div>
          );
        }

        // State 2: Fresh live GPS → green banner
        if (isFresh && currentLocation.source === 'gps') {
          return (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
              <div
                className="w-full flex items-center gap-3 px-5 py-3 border-b border-emerald-500/20"
                style={{ background: 'rgba(16,185,129,0.06)' }}
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-emerald-300">📍 Live Location Active</div>
                  <div className="text-[10px] text-emerald-300/60 truncate">
                    {currentLocation.displayName ?? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`}
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400/60 shrink-0">GPS ✓</span>
              </div>
              <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                <button
                  onClick={() => setShowManual(true)}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/5 transition"
                >
                  <Search className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="flex-1 text-sm font-bold text-white/50">Change location manually</span>
                </button>
              </div>
            </motion.div>
          );
        }

        // State 3: Stale or manual location
        return (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full shrink-0"
          >
            <div className="flex items-center gap-3 px-5 py-3 border-b border-amber-500/20"
              style={{ background: 'rgba(245,166,35,0.07)' }}
            >
              <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-amber-300">
                  {currentLocation.source === 'manual' ? 'Manually selected' : 'Last locked location:'} {minsAgo === 0 ? 'just now' : `${minsAgo} min ago`}
                </div>
                <div className="text-[10px] text-amber-300/50 truncate">
                  {currentLocation.displayName ?? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`}
                </div>
              </div>
            </div>

            <button
              onClick={() => void requestGPS()}
              className="w-full flex items-center gap-4 px-5 py-3 text-left transition active:brightness-90"
              style={{ background: '#f5a623' }}
            >
              <div className="flex-1">
                <div className="text-sm font-black text-[#3d2200]">📍 Enable live GPS</div>
                <div className="text-xs text-[#7c4a00]">For better accuracy</div>
              </div>
              <span className="font-black text-lg text-[#7c4a00]">›</span>
            </button>
            <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
              <button
                onClick={() => setShowManual(true)}
                className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/5 transition"
              >
                <Search className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="flex-1 text-sm font-bold text-white/50">Or change location manually</span>
              </button>
            </div>
          </motion.div>
        );
      })()}

      {/* Location search modal */}
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
        {/* ── COUNTDOWN. Helmet One “Emergency detected” (SOS + crash identical) ── */}
        {phase === 'countdown' && (
          <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-y-auto">
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.22) 0%, transparent 55%)' }} />

            <div className="flex-1 flex flex-col px-5 pt-8 pb-6 max-w-md mx-auto w-full">
              <div className="rounded-3xl border border-red-500/35 bg-red-500/[0.08] p-5 text-center">
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                  className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-600/90 text-white shadow-[0_0_40px_rgba(220,38,38,0.55)] mb-3"
                >
                  <Siren className="h-8 w-8" />
                </motion.div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {isHardwareCrash ? t('sos.crashDetected') : t('sos.emergencyDetected')}
                </h1>
                <p className="mt-2 text-sm text-red-100/70">
                  {t('sos.autoSending', { seconds: cdown })}
                </p>
              </div>

              <div className="relative mt-8 flex justify-center">
                <div className="relative h-36 w-36">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" fill="none">
                    <circle cx="60" cy="60" r="54" stroke="rgba(220,38,38,0.12)" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="54"
                      stroke="rgba(220,38,38,0.95)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (circumference * pct) / 100}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white leading-none">{cdown}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-1">{t('sos.secondsLabel')}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  id="btn-im-ok-cancel"
                  onClick={stopAlert}
                  className="rounded-2xl border border-white/15 bg-white/[0.04] py-3.5 text-sm font-black text-white/80 hover:bg-white/[0.08] transition active:scale-[0.98]"
                >
                  {t('sos.imOkCancel')}
                </button>
                <button
                  type="button"
                  id="btn-send-help-now"
                  onClick={sendHelpNow}
                  className="rounded-2xl py-3.5 text-sm font-black text-white shadow-[0_0_24px_rgba(220,38,38,0.45)] transition active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}
                >
                  {t('sos.sendHelpNow')}
                </button>
              </div>

              <div className="mt-8 w-full space-y-2">
                {[
                  { done: currentLocation !== null, label: t('sos.detectingLocation') },
                  { done: cdown <= 45, label: t('sos.preparingAlert') },
                  { done: cdown <= 15, label: t('sos.findingNearbyHelpers') },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-all ${item.done ? 'bg-emerald-500' : 'bg-white/10'}`}>
                      {item.done && <CheckCircle2 className="h-3 w-3 text-white" />}
                      {!item.done && <div className="h-2 w-2 rounded-full bg-white/40 animate-pulse" />}
                    </div>
                    <span className={item.done ? 'text-emerald-300' : 'text-white/40'}>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                {isHardwareCrash ? (
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <div className="text-[10px] uppercase text-white/50 tracking-wider">Estimated Severity</div>
                        <div className={`text-xl font-black capitalize ${
                          hwSeverity === 'critical' ? 'text-red-500' : hwSeverity === 'major' ? 'text-orange-400' : 'text-emerald-400'
                        }`}>{hwSeverity}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-white/50 tracking-wider">Peak Impact</div>
                        <div className="text-lg font-bold text-red-400">{hwGforce || 'Unknown'} G</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-[10px] uppercase text-white/50 tracking-wider mb-2">AI Bodily Injury Risks (Model 3)</div>
                      <div className="grid grid-cols-1 gap-2">
                        {['head_trauma_risk', 'spine_injury_risk', 'lower_body_injury_risk'].map((riskKey) => {
                          const risk = (mlData as any)?.[riskKey];
                          if (!risk) return null;
                          const title = riskKey.replace(/_/g, ' ').replace(' risk', '');
                          const color = risk.level === 'High' ? 'text-red-400' : risk.level === 'Medium' ? 'text-orange-400' : 'text-emerald-400';
                          return (
                            <div key={riskKey} className="text-xs flex justify-between items-center bg-white/[0.03] px-3 py-2 rounded-lg">
                              <span className="text-white/70 capitalize">{title}</span>
                              <span className={`font-bold ${color}`}>{risk.level} <span className="opacity-50 text-[10px]">({(risk.confidence * 100).toFixed(0)}%)</span></span>
                            </div>
                          );
                        })}
                        {!mlData && (
                          <div className="text-xs text-white/40 italic flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-white/20 animate-pulse" />
                            Analyzing injury risks...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                      Emergency Severity
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-6">
                      {(['minor', 'major', 'critical'] as const).map(sev => {
                        const active = manualSeverity === sev;
                        return (
                          <button
                            key={sev}
                            type="button"
                            onClick={() => setManualSeverity(sev)}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                              active 
                                ? sev === 'critical' ? 'bg-red-500/20 border-red-500/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                                : sev === 'major' ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' 
                                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                                : 'bg-white/[0.02] border-white/10 text-white/40 hover:bg-white/[0.05]'
                            }`}
                          >
                            {sev.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                      What happened?
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {(
                        [
                          { id: 'crash',   label: 'High impact / Crash',   icon: <Car className="h-4 w-4" />,        tint: '#f59e0b' },
                          { id: 'fall',    label: 'Vehicle Skid / Fall',   icon: <Bandage className="h-4 w-4" />,    tint: '#f59e0b' },
                          { id: 'medical', label: 'Medical Emergency',     icon: <HeartPulse className="h-4 w-4" />, tint: '#ec4899' },
                          { id: 'other',   label: 'Other / Not Sure',      icon: <HelpCircle className="h-4 w-4" />, tint: '#6366f1' },
                        ] as const
                      ).map((opt) => {
                        const active = incidentType === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setIncidentType(opt.id)}
                            className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
                              active
                                ? 'border-white/20 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                                : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                            }`}
                          >
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                              style={{
                                backgroundColor: active ? `${opt.tint}25` : 'rgba(255,255,255,0.05)',
                                color: active ? opt.tint : 'rgba(255,255,255,0.5)',
                              }}
                            >
                              {opt.icon}
                            </div>
                            <span className={`text-sm font-bold transition-colors ${active ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
                              {opt.label}
                            </span>
                            {active && (
                              <motion.div
                                layoutId="activeIndicator"
                                className="absolute right-4 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </motion.div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <Mic className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[11px] font-black text-emerald-300">Live audio analysis: ON</span>
              </div>

              {!user && (
                <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] text-white/40 leading-relaxed">
                    <span className="text-white/60 font-semibold">No emergency contacts?</span><br />
                    Add in Safety Circle (optional)
                  </div>
                  <Link to="/signup"
                    className="shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black text-white/70 hover:bg-white/[0.1] transition">
                    Sign up
                  </Link>
                </div>
              )}

              <button
                type="button"
                id="btn-emergency-call-countdown"
                onClick={() => setCallPopup(true)}
                className="mt-4 w-full rounded-2xl border border-red-500/30 bg-red-500/10 py-3.5 text-sm font-black text-red-200 hover:bg-red-500/15 transition flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4" /> Emergency Call
              </button>
            </div>
          </motion.div>
        )}

        {/* ── ACTIVE PHASE. Helmet One sequence: Alert sent → Live → Guidance → Hospital ── */}
        {phase === 'active' && (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-y-auto">
            {helmetFlowStep === 'alert_sent' ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 pt-10 pb-4 max-w-md mx-auto w-full flex flex-col items-center text-center">
                  <div className="mx-auto h-[88px] w-[88px] rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_48px_rgba(16,185,129,0.45)] mb-4">
                    <CheckCircle2 className="h-11 w-11 text-white stroke-[2.5]" />
                  </div>
                  <h1 className="text-2xl font-black text-white">Help is on the way!</h1>
                  <p className="mt-2 text-sm text-white/50 leading-relaxed">
                    We&apos;ve notified responders and started live location sharing.
                  </p>

                  <div className="mt-6 w-full rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 text-left space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/35">We&apos;ve notified</div>
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Ambulance className="h-4 w-4 text-emerald-300 shrink-0" />
                        <span className="text-sm font-black text-white truncate">Ambulance</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-300 shrink-0">ETA: ~4 mins</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <ShieldAlert className="h-4 w-4 text-blue-300 shrink-0" />
                        <span className="text-sm font-black text-white truncate">Police</span>
                      </div>
                      <span className="text-xs font-bold text-blue-300 shrink-0">ETA: ~10 mins</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="h-4 w-4 text-violet-300 shrink-0" />
                        <span className="text-sm font-black text-white truncate">Emergency Contacts</span>
                      </div>
                      <span className="text-xs font-bold text-violet-300 shrink-0">
                        {(profile?.contacts?.length ?? 0) > 0
                          ? `${profile?.contacts?.length} people`
                          : 'Add in Safety Circle'}
                      </span>
                    </div>
                  </div>

                  {displayCoords && (
                    <div className="mt-4 w-full rounded-3xl border border-white/[0.06] bg-[#13141a] overflow-hidden text-left">
                      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/35">Live location sharing</span>
                        <a
                          href={`https://maps.google.com/?q=${displayCoords.lat},${displayCoords.lon}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-black text-sky-400 hover:text-sky-300"
                        >
                          View on Map
                        </a>
                      </div>
                      <div className="relative h-36 bg-[#0c1420]">
                        <iframe
                          title="Live preview"
                          className="absolute inset-0 w-full h-full opacity-80 filter invert hue-rotate-180"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${displayCoords.lon - 0.008}%2C${displayCoords.lat - 0.008}%2C${displayCoords.lon + 0.008}%2C${displayCoords.lat + 0.008}&layer=mapnik&marker=${displayCoords.lat}%2C${displayCoords.lon}`}
                          style={{ border: 0 }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 w-full">
                    <p className="text-xs font-bold text-emerald-100/90 leading-relaxed">
                      Stay calm. Help is on the way. Keep your phone unlocked so responders can reach you.
                    </p>
                  </div>
                </div>
                <div className="sticky bottom-0 px-5 py-4 border-t border-white/[0.06] space-y-2 max-w-md mx-auto w-full"
                  style={{ background: 'linear-gradient(to top, #0a0b0f 85%, transparent)' }}>
                  <button
                    type="button"
                    id="btn-track-live-status"
                    onClick={() => setHelmetFlowStep('live_track')}
                    className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-[0_0_28px_rgba(16,185,129,0.35)] active:scale-[0.99] transition"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                  >
                    Track Live Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setCallPopup(true)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-xs font-bold text-white/55 hover:bg-white/[0.07] transition"
                  >
                    Emergency call (112)
                  </button>
                </div>
              </>
            ) : helmetFlowStep === 'guidance' ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 pt-8 pb-4 max-w-md mx-auto w-full">
                  <h1 className="text-xl font-black text-white text-center">Live road guidance</h1>
                  <p className="text-center text-xs text-white/45 mt-1">Turn-by-turn updates while help is moving</p>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_132px] gap-3 items-stretch">
                    <div className="space-y-2 rounded-3xl border border-white/[0.06] bg-[#13141a] p-4">
                      {[
                        { t: '100 m', d: 'Turn right toward main road' },
                        { t: '2.3 km', d: 'Ambulance approaching your corridor' },
                        { t: 'Stay', d: 'Keep hazard lights on if safe to do so' },
                      ].map((row, i) => (
                        <div key={i} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5">
                          <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">{row.t}</div>
                          <div className="text-sm font-bold text-white/90 mt-0.5">{row.d}</div>
                        </div>
                      ))}
                    </div>
                    {displayCoords ? (
                      <div className="rounded-3xl border border-white/[0.06] overflow-hidden bg-[#0c1420] min-h-[160px]">
                        <iframe
                          title="Guidance map"
                          className="w-full h-full min-h-[160px] opacity-75 filter invert hue-rotate-180"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${displayCoords.lon - 0.006}%2C${displayCoords.lat - 0.006}%2C${displayCoords.lon + 0.006}%2C${displayCoords.lat + 0.006}&layer=mapnik&marker=${displayCoords.lat}%2C${displayCoords.lon}`}
                          style={{ border: 0 }}
                        />
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] min-h-[160px] flex items-center justify-center text-[11px] text-white/35 px-3 text-center">
                        Enable location for map guidance
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-3xl border border-amber-500/25 bg-amber-500/[0.07] p-4 flex gap-3">
                    <div className="text-2xl">🛡️</div>
                    <div>
                      <div className="text-xs font-black text-amber-200">Safety Guide</div>
                      <div className="text-[11px] text-amber-100/70 mt-1 leading-snug">
                        Move to a safe place if you can. Stay visible and avoid unnecessary movement if injured.
                      </div>
                    </div>
                  </div>

                  <a
                    href="tel:18002330233"
                    className="mt-3 flex items-center gap-3 rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.08] p-4 hover:bg-emerald-500/[0.12] transition"
                  >
                    <div className="h-12 w-12 rounded-full bg-emerald-500/25 flex items-center justify-center shrink-0">
                      <Phone className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-black text-emerald-100">Need to talk?</div>
                      <div className="text-[11px] text-emerald-200/70">24×7 crisis support. Tap to call</div>
                    </div>
                  </a>
                </div>
                <div className="sticky bottom-0 px-5 py-4 border-t border-white/[0.06] flex flex-col gap-2 max-w-md mx-auto w-full"
                  style={{ background: 'linear-gradient(to top, #0a0b0f 85%, transparent)' }}>
                  <button
                    type="button"
                    onClick={() => setHelmetFlowStep('live_track')}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 text-xs font-black text-white/75 hover:bg-white/[0.08] transition"
                  >
                    Back to live map
                  </button>
                  <button
                    type="button"
                    onClick={() => setHelmetFlowStep('at_hospital')}
                    className="w-full rounded-2xl py-3.5 text-xs font-black text-white"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                  >
                    I&apos;ve reached the hospital
                  </button>
                </div>
              </>
            ) : helmetFlowStep === 'at_hospital' ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 pt-10 pb-4 max-w-md mx-auto w-full text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center text-3xl mb-3">
                    🏥
                  </div>
                  <h1 className="text-xl font-black text-white leading-tight">
                    You have reached{' '}
                    {hospitalAlerts.filter((a) => a.status !== 'cancelled')[0]?.hospitalName ?? 'Civil Hospital, Gurugram'}
                  </h1>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Check-in complete</span>
                  </div>
                  <p className="mt-3 text-xs text-white/50 leading-relaxed">
                    The hospital team has been notified. Share your Medical ID with triage if asked.
                  </p>

                  <Link
                    to="/app/medical-id?from=sos"
                    className="mt-6 block w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] py-4 text-sm font-black text-white hover:bg-white/[0.08] transition"
                  >
                    Show Medical ID
                  </Link>

                  <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-left">
                    <div className="text-[11px] font-black text-emerald-200">Emergency contacts notified</div>
                    <div className="text-[10px] text-emerald-100/65 mt-1">They know you&apos;ve arrived for care.</div>
                  </div>

                  <div className="mt-6 rounded-3xl border border-white/[0.06] bg-[#13141a] p-5 w-full">
                    <div className="text-sm font-black text-white">How are you feeling?</div>
                    <div className="text-[11px] text-white/45 mt-1">This helps medical staff respond better.</div>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {(
                        [
                          { id: 'not_good', label: 'Not good', emoji: '😣', tint: '#ef4444' },
                          { id: 'in_pain', label: 'In pain', emoji: '😖', tint: '#f59e0b' },
                          { id: 'okay', label: 'Okay', emoji: '🙂', tint: '#eab308' },
                          { id: 'better', label: 'Better', emoji: '😊', tint: '#10b981' },
                        ] as const
                      ).map((m) => {
                        const active = feelingMood === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setFeelingMood(m.id)}
                            className={[
                              'flex flex-col items-center gap-1 rounded-2xl border py-2.5 transition active:scale-95',
                              active ? 'border-white/25 bg-white/[0.08]' : 'border-white/[0.06] bg-white/[0.025]',
                            ].join(' ')}
                            style={active ? { boxShadow: `0 0 12px ${m.tint}55` } : undefined}
                          >
                            <span className="text-2xl">{m.emoji}</span>
                            <span className={`text-[9px] font-black ${active ? 'text-white' : 'text-white/55'}`}>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-pink-500/25 bg-pink-500/[0.06] p-4 flex items-center gap-3 text-left">
                    <span className="text-2xl">💗</span>
                    <div>
                      <div className="text-sm font-black text-pink-200">Thank you!</div>
                      <div className="text-[11px] text-white/55">We hope you recover soon.</div>
                    </div>
                  </div>
                </div>
                <div className="sticky bottom-0 px-5 py-4 border-t border-white/[0.06] max-w-md mx-auto w-full"
                  style={{ background: 'linear-gradient(to top, #0a0b0f 85%, transparent)' }}>
                  <button
                    type="button"
                    onClick={markSafe}
                    className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-[0_0_24px_rgba(16,185,129,0.3)] active:scale-[0.99] transition"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                  >
                    Finish &amp; return home
                  </button>
                </div>
              </>
            ) : (
            <>
            <div className="px-5 pt-8 pb-4 text-center"
              style={{ background: 'linear-gradient(to bottom, rgba(220,38,38,0.12), transparent)' }}>
              <motion.div className="text-3xl mb-2" animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                <Ambulance className="h-10 w-10 text-red-300 mx-auto" />
              </motion.div>
              <h1 className="text-2xl font-black text-white">Help is on the way</h1>
              <p className="mt-1 text-sm text-white/45">
                {uiPrimaryResponder?.etaSeconds
                  ? `Ambulance / responder ETA ${formatEta(uiPrimaryResponder.etaSeconds)}`
                  : 'Live tracking & responders below'}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-rose-400" />
                  <span className="text-xs font-bold text-rose-300">Severity: <span className="uppercase">{liveSosDoc?.severity || 'MINOR'}</span></span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">Priority: {liveSosDoc?.priority || 1}</span>
                </div>
                {liveSosDoc?.escalated && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 flex items-center gap-2">
                    <Siren className="h-4 w-4 text-red-400 animate-pulse" />
                    <span className="text-xs font-bold text-red-300">ESCALATED</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-6 space-y-4 flex-1">
              {/* No-location warning banner. Shown when SOS created without GPS or manual location */}
              {noLocationMode && (
                <div className="rounded-3xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black text-amber-300">⚠ Location not found</div>
                      <div className="text-[10px] text-amber-300/60 mt-1 leading-relaxed">
                        Notifying ambulance only. Enable GPS or select location manually to alert nearby helpers.
                      </div>
                    </div>
                  </div>
                </div>
              )}

                <IncidentTimeline steps={timelineSteps} />

                {uiPrimaryResponder && (
                  <>
                    <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-white">Responder is on the way</div>
                        <div className="text-[10px] font-black text-white/35 uppercase tracking-widest mt-2">ETA</div>
                        <div className="text-3xl font-black text-white mt-0.5">
                          {uiPrimaryResponder.etaSeconds ? formatEta(uiPrimaryResponder.etaSeconds) : '-'}
                        </div>
                        {uiPrimaryResponder.distanceMeters != null && (
                          <div className="text-xs text-white/50 mt-1 font-semibold">
                            {formatDistance(uiPrimaryResponder.distanceMeters)} away
                          </div>
                        )}
                      </div>
                      <Ambulance className="h-14 w-14 text-red-400/90 shrink-0" />
                    </div>

                    <button
                      onClick={() => setShowChat(true)}
                      className="w-full mt-3 rounded-2xl py-4 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                    >
                      <MessageSquare className="h-5 w-5" />
                      Chat with {uiPrimaryResponder.helperName || 'Responder'}
                    </button>
                  </>
                )}

                {/* Live map */}
                {displayCoords && (() => {
                  const liveAssignment = trackedAssignment;

                  if (liveAssignment && liveAssignment.helperLocation) {
                    return (
                      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] overflow-hidden">
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                            Live Tracking
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Helper en route
                          </div>
                        </div>
                        <div className="px-3 pb-3">
                          <LiveTrackingMap
                            viewerRole="victim"
                            victim={{ lat: displayCoords.lat, lon: displayCoords.lon }}
                            helper={{
                              lat: liveAssignment.helperLocation.lat,
                              lon: liveAssignment.helperLocation.lon,
                            }}
                            routeEncoded={liveAssignment.routeEncoded}
                            etaSeconds={liveAssignment.etaSeconds}
                            distanceMeters={liveAssignment.distanceMeters}
                            helperName={liveAssignment.helperName || 'Helper'}
                            height={260}
                          />
                        </div>
                      </div>
                    );
                  }

                  // Fallback: no helper streaming yet → keep OSM preview
                  return (
                    <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] overflow-hidden">
                      <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-white/30 uppercase tracking-widest">Live Map</div>
                      <div className="relative h-44"
                        style={{ background: '#0c1420' }}>
                        <iframe
                          width="100%"
                          height="100%"
                          className="absolute inset-0 z-0 opacity-70 filter invert hue-rotate-180"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${displayCoords.lon - 0.01}%2C${displayCoords.lat - 0.01}%2C${displayCoords.lon + 0.01}%2C${displayCoords.lat + 0.01}&layer=mapnik&marker=${displayCoords.lat}%2C${displayCoords.lon}`}
                          style={{ border: 0 }}
                          title="Live Location Map"
                        />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                          <div className="relative">
                            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-60" style={{ animationDuration: '1.5s' }} />
                            <div className="h-5 w-5 rounded-full bg-red-500 border-2 border-[#13141a] shadow-lg flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex bg-[#13141a] border-t border-white/[0.05]">
                        <div className="px-4 py-3 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                            <MapPin className="h-3.5 w-3.5 text-red-400" />
                            {displayCoords.lat.toFixed(5)}, {displayCoords.lon.toFixed(5)}
                          </div>
                        </div>
                        <a href={`https://maps.google.com/?q=${displayCoords.lat},${displayCoords.lon}`}
                          target="_blank" rel="noreferrer"
                          className="flex shrink-0 items-center justify-center px-4 border-l border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] transition text-[10px] font-bold text-white/60">
                          Open in<br />Google Maps
                        </a>
                      </div>
                    </div>
                  );
                })()}

              {/* Rapido-style reach (no per-helper list); slim bar once a responder is assigned */}
              {!noLocationMode && !uiPrimaryResponder && (
                <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#151622] to-[#101118] p-4 shadow-[0_0_40px_rgba(59,130,246,0.06)]">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-blue-300" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/35">
                        Nearby responders
                      </div>
                      <div className="mt-1 text-sm font-black text-white leading-snug">
                        {contactedDisplay === 0
                          ? 'Finding a nearby responder…'
                          : 'Notifying responders in your area…'}
                      </div>
                      <p className="mt-1 text-[11px] text-white/45 leading-relaxed">
                        Your alert is live in a 5 km radius. Full responder details appear here as soon as someone accepts.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeAssignments.map((a, index) => {
                const hb = a.helperBrief;
                const reached = a.status === 'reached' || !!a.arrivedAt;
                const hName = (hb?.name || a.helperName || 'Responder').trim();
                const hAge = hb?.age ?? (helperPublic ? computeAgeFromDob(helperPublic.dob) : undefined);
                const hAddr = hb?.shortAddress ?? shortAddressFromProfile(helperPublic);
                const hPhone = hb?.phone?.trim() || helperPublic?.phone?.trim();
                const vb = liveSosDoc?.victimBrief;
                const yName = vb?.name || profile?.name?.trim() || user?.displayName?.trim() || 'You';
                const yAge = vb?.age ?? (profile ? computeAgeFromDob(profile.dob) : undefined);
                const yAddr = vb?.shortAddress ?? shortAddressFromProfile(profile);
                const yPhone = vb?.phone?.trim() || profile?.phone?.trim();
                return (
                  <div key={a.id} className="space-y-3 mt-4">
                    {index === 0 && (
                      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-3">Your details (shared)</div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-base font-black text-white truncate">{yName}</div>
                            <div className="text-[11px] text-white/50 mt-1 space-y-0.5">
                              {yAge != null && <div>Age {yAge}</div>}
                              {yAddr && <div className="truncate">{yAddr}</div>}
                              {!yAddr && <div className="text-white/35">Address on profile</div>}
                            </div>
                          </div>
                          {yPhone && (
                            <a href={`tel:${yPhone.replace(/\s/g, '')}`} className="h-10 w-10 rounded-full bg-sky-500/20 border border-sky-500/35 flex items-center justify-center shrink-0">
                              <Phone className="h-4 w-4 text-sky-300" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300/90">
                          Responder {activeAssignments.length > 1 ? `#${index + 1}` : 'details'}
                        </div>
                        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200">
                          <Navigation className="h-3 w-3" />
                          Live
                        </div>
                      </div>

                      <div className={`rounded-2xl border px-3 py-2.5 flex items-center gap-3 ${reached ? 'border-emerald-400/35 bg-emerald-500/10' : 'border-white/[0.08] bg-[#0f1016]'}`}>
                        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-sm font-black text-white/70">
                          {hName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-white">Responder</div>
                          <div className="text-sm font-bold text-white/90 truncate">{hName}</div>
                          <div className="text-[10px] text-white/45 mt-0.5">
                            {hAge != null && <span>Age {hAge} · </span>}
                            {hAddr ? <span className="truncate">{hAddr}</span> : <span>En route to you</span>}
                          </div>
                          {(hb?.trustScore || (hb?.badges && hb.badges.length > 0)) && (
                            <div className="mt-2 flex flex-col gap-1.5 border-t border-white/[0.06] pt-2">
                              {hb.trustScore && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                                  <Star className="h-3 w-3 fill-amber-400" />
                                  Trust Score: {hb.trustScore}/100
                                </div>
                              )}
                              {hb.badges && hb.badges.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                  {hb.badges.map((b, bi) => (
                                    <div key={bi} className="flex items-center gap-1 bg-[#1d1e26] border border-amber-500/20 text-amber-200/90 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                      <Award className="h-2.5 w-2.5 text-amber-400" />
                                      {b}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="text-[11px] font-black text-emerald-300/90 mt-2">
                            {reached
                              ? 'Arrived at your location'
                              : a.etaSeconds
                                ? `${formatEta(a.etaSeconds)}${a.distanceMeters != null ? ` · ${formatDistance(a.distanceMeters)}` : ''}`
                                : a.distanceMeters != null
                                  ? `${formatDistance(a.distanceMeters)} away`
                                  : 'Heading your way'}
                          </div>
                        </div>
                        {hPhone && (
                          <a href={`tel:${hPhone.replace(/\s/g, '')}`} className="h-10 w-10 rounded-full bg-sky-500/20 border border-sky-500/35 flex items-center justify-center shrink-0">
                            <Phone className="h-4 w-4 text-sky-300" />
                          </a>
                        )}
                      </div>

                      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2.5 flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-200 text-xs">i</div>
                        <div>
                          <div className="text-[11px] font-black text-emerald-200">Important</div>
                          <div className="text-[10px] text-emerald-100/75 leading-snug mt-0.5">
                            Keep your phone unlocked. Your responder may call you on the number you shared.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Hospital notifications raised by helpers ──────────────────── */}
              {hospitalAlerts.filter((a) => a.status !== 'cancelled').length > 0 && (
                <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                    <Hospital className="h-3 w-3" />
                    Hospital alerted ({hospitalAlerts.filter((a) => a.status !== 'cancelled').length})
                  </div>
                  {hospitalAlerts
                    .filter((a) => a.status !== 'cancelled')
                    .map((a) => (
                      <div key={a.id} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-white"
                            style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>
                            🏥
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-black text-white truncate">{a.hospitalName}</div>
                            {a.hospitalAddress && (
                              <div className="text-[10px] text-white/55 truncate">{a.hospitalAddress}</div>
                            )}
                            <div className="text-[10px] text-emerald-300/80 mt-0.5">
                              {a.status === 'acknowledged'
                                ? '✅ ER acknowledged · preparing treatment'
                                : a.status === 'arrived'
                                  ? '🎉 Patient delivered to hospital'
                                  : `Notified by ${a.helperName || 'helper'} · waiting for ER ack`}
                            </div>
                          </div>
                          <span className={[
                            'rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-wider shrink-0',
                            a.status === 'acknowledged' || a.status === 'arrived'
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-amber-500/15 text-amber-200',
                          ].join(' ')}>
                            {a.status}
                          </span>
                        </div>
                        {a.injuryNotes && (
                          <div className="mt-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/65">
                            <span className="text-white/35 font-black mr-1">NOTE</span> {a.injuryNotes}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="sticky bottom-0 px-5 py-4 space-y-2 border-t border-white/[0.05]"
              style={{ background: 'linear-gradient(to top, #0a0b0f 60%, transparent)' }}>

              <button
                onClick={simulateVoiceFallback}
                className="w-full h-10 rounded-2xl border border-white/5 bg-white/[0.03] text-[10px] font-bold text-white/40 hover:bg-white/[0.06] transition flex items-center justify-center mb-1">
                Simulate Voice Fallback (Demo Only)
              </button>

              <a id="btn-call-112" href="tel:112"
                className="relative flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white active:scale-95 transition overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.35)' }}>
                <div className="absolute inset-0 bg-white/20 animate-pulse" style={{ animationDuration: '1s' }} />
                <Phone className="h-4 w-4 relative z-10" />
                <span className="relative z-10">📞 Call Emergency (112)</span>
              </a>

              <button id="btn-helplines-toggle"
                onClick={() => setShowHelplines(!showHelplines)}
                className="w-full flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/50 hover:bg-white/[0.07] transition">
                <span>Other helplines</span>
                {showHelplines ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <AnimatePresence>
                {showHelplines && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 pb-1">
                      {HELPLINES.map((h) => (
                        <a key={h.number} href={`tel:${h.number}`}
                          className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.03] py-3 text-xs font-bold text-white/70 hover:bg-white/[0.06] transition active:scale-95 gap-1">
                          <span style={{ color: h.color }}>{h.label}</span>
                          <span className="text-white/40">{h.number}</span>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Safety guidance + "Need to talk?" support ───────────── */}
              <div className="grid grid-cols-1 gap-2 mb-2">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 flex items-center gap-3">
                  <div className="text-xl">🛡️</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black text-amber-200">Safety Guide</div>
                    <div className="text-[10px] text-amber-100/65 leading-snug">
                      If you can, move to a safe place and stay calm. Keep your phone unlocked. Responders may need to contact you.
                    </div>
                  </div>
                </div>

                <a
                  href="tel:18002330233"
                  className="rounded-2xl border border-pink-500/25 bg-pink-500/[0.06] px-3 py-2.5 flex items-center gap-3 hover:bg-pink-500/[0.10] transition active:scale-95"
                >
                  <div className="h-9 w-9 rounded-xl bg-pink-500/20 flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4 text-pink-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-black text-pink-200">Need to talk?</div>
                    <div className="text-[10px] text-pink-100/60">Tap to reach our 24×7 crisis support team</div>
                  </div>
                </a>
              </div>

              {/* First-Aid Guide */}
              <button
                type="button"
                onClick={() => setFirstAidOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-3.5 text-xs font-black text-red-300 hover:bg-red-500/20 transition active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
              >
                <Bandage className="h-4 w-4" /> Open First-Aid Guide
              </button>

              {/* Cancel + I Am Safe */}
              <div className="flex gap-2">
                <button id="btn-cancel-alert" onClick={cancelAlert}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-xs font-bold text-white/50 hover:bg-white/10 transition active:scale-95">
                  <X className="h-3.5 w-3.5" /> Cancel Alert
                </button>
                <button id="btn-i-am-safe" onClick={markSafe}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95">
                  <CheckCircle2 className="h-3.5 w-3.5" /> I Am Safe
                </button>
              </div>

              <button
                type="button"
                onClick={() => setHelmetFlowStep('guidance')}
                className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 py-3 text-xs font-black text-amber-200 hover:bg-amber-500/15 transition active:scale-95"
              >
                View live guidance
              </button>
            </div>
            </>
            )}
          </motion.div>
        )}

        {/* ── SAFE PHASE ── */}
        {phase === 'safe' && (
          <motion.div key="safe" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col px-6 pt-12 pb-6 max-w-md mx-auto w-full">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl" />
                <CheckCircle2 className="relative h-20 w-20 text-emerald-400" />
              </div>
              <h1 className="text-3xl font-black text-white">You are Safe</h1>
              <p className="mt-2 text-sm text-white/55">All helpers and emergency contacts have been notified that you're OK.</p>
            </div>

            {/* Mood feedback. "How are you feeling?" */}
            <div className="mt-8 rounded-3xl border border-white/[0.06] bg-[#13141a] p-5 text-center">
              <div className="text-xs font-black text-white">How are you feeling?</div>
              <div className="text-[11px] text-white/45 mt-1">This helps medical staff respond better.</div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'not_good', label: 'Not good', emoji: '😣', tint: '#ef4444' },
                    { id: 'in_pain',  label: 'In pain',  emoji: '😖', tint: '#f59e0b' },
                    { id: 'okay',     label: 'Okay',     emoji: '🙂', tint: '#3b82f6' },
                    { id: 'better',   label: 'Better',   emoji: '😊', tint: '#10b981' },
                  ] as const
                ).map((m) => {
                  const active = feelingMood === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setFeelingMood(m.id)}
                      className={[
                        'flex flex-col items-center gap-1 rounded-2xl border py-2.5 transition active:scale-95',
                        active
                          ? 'border-white/30 bg-white/[0.07]'
                          : 'border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.04]',
                      ].join(' ')}
                      style={active ? { boxShadow: `0 0 14px ${m.tint}40` } : undefined}
                    >
                      <span className="text-2xl">{m.emoji}</span>
                      <span className={`text-[10px] font-black ${active ? 'text-white' : 'text-white/55'}`}>{m.label}</span>
                    </button>
                  );
                })}
              </div>
              {feelingMood && (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                  <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">Recorded</span>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-pink-500/25 bg-pink-500/[0.06] p-4 flex items-center gap-3">
              <div className="text-2xl">💗</div>
              <div className="flex-1">
                <div className="text-xs font-black text-pink-200">Thank you</div>
                <div className="text-[11px] text-white/55">We hope you recover soon.</div>
              </div>
            </div>

            <div className="mt-auto pt-6 grid grid-cols-2 gap-2">
              <button onClick={goHome}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-xs font-black text-white/70 hover:bg-white/10 transition active:scale-95">
                Back to Home
              </button>
              <Link to="/app/care"
                className="h-11 rounded-2xl flex items-center justify-center text-xs font-black text-white transition active:scale-95"
                style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>
                Book follow-up
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Call Popup */}
      <AnimatePresence>
        {callPopup && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs rounded-3xl border border-white/[0.08] bg-[#13141a] p-6 text-center shadow-2xl">
              <div className="text-3xl mb-3">📞</div>
              <h2 className="text-lg font-black text-white">Call Emergency Services?</h2>
              <p className="mt-1 text-xs text-white/40">This will dial 112. The SOS alert will continue in the background.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setCallPopup(false)}
                  className="flex-1 h-11 rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-white/60 hover:bg-white/10 transition">
                  Cancel
                </button>
                <a href="tel:112" onClick={() => setCallPopup(false)}
                  className="flex-1 h-11 rounded-2xl flex items-center justify-center text-xs font-black text-white transition active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
                  Call Now
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Bridge Drawer */}
      {showChat && sosId && (
        <SosChatBridge
          sosId={sosId}
          currentUserId={uid}
          currentUserName={profile?.name || 'Victim'}
          currentUserRole="victim"
          phoneToCall={primaryResponder?.helperBrief?.phone}
          counterpartyName={primaryResponder?.helperName || 'Responder'}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* ── Developer Debug Panel for Vitals & Movement ── */}
      {phase === 'active' && (
        <div className="fixed bottom-24 right-4 z-50 rounded-2xl border border-white/10 bg-[#13141a]/95 backdrop-blur-md p-3 shadow-2xl max-w-[230px]">
          <div className="text-[10px] font-black uppercase text-white/50 mb-2 border-b border-white/10 pb-1 flex items-center justify-between">
            <span>Vitals Simulator</span>
            <span className="text-[8px] text-white/30 normal-case">WHO/AHA/ATLS</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-white/70 flex justify-between">
                <span>Heart Rate</span> <span>{mockHr} bpm</span>
              </label>
              <input type="range" min="30" max="200" value={mockHr} onChange={e => setMockHr(Number(e.target.value))} className="w-full accent-rose-500 h-1" />
              {heartRateBadge(mockHr) && <div className="mt-1">{heartRateBadge(mockHr)}</div>}
            </div>
            <div>
              <label className="text-[10px] text-white/70 flex justify-between">
                <span>SpO2</span> <span>{mockSpo2}%</span>
              </label>
              <input type="range" min="80" max="100" value={mockSpo2} onChange={e => setMockSpo2(Number(e.target.value))} className="w-full accent-sky-500 h-1" />
              {spo2Badge(mockSpo2) && <div className="mt-1">{spo2Badge(mockSpo2)}</div>}
            </div>
            <div>
              <label className="text-[10px] text-white/70 flex justify-between">
                <span>Movement</span> <span>{mockNoMovement}s idle</span>
              </label>
              <input type="range" min="0" max="120" value={mockNoMovement} onChange={e => setMockNoMovement(Number(e.target.value))} className="w-full accent-amber-500 h-1" />
              {noMovementBadge(mockNoMovement) && <div className="mt-1">{noMovementBadge(mockNoMovement)}</div>}
            </div>
          </div>
        </div>
      )}

      <FirstAidDrawer isOpen={firstAidOpen} onClose={() => setFirstAidOpen(false)} />

      {/* Crash Replay — only available when the SOS came from a hardware crash */}
      {liveSosDoc?.source === 'hardware' && phase === 'active' && (
        <button
          type="button"
          onClick={() => setCrashReplayOpen(true)}
          className="fixed bottom-24 left-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-3 py-2 text-[11px] font-black text-rose-200 hover:bg-rose-500/25 transition active:scale-95 backdrop-blur-md shadow-2xl"
          title="View 10-second flight recorder window before the crash"
        >
          <Siren className="h-3.5 w-3.5" /> Crash Replay
        </button>
      )}

      <CrashReplay
        open={crashReplayOpen}
        onClose={() => setCrashReplayOpen(false)}
        samples={helmetHist.samples}
        crashAt={helmetHist.helmet?.crashEvent?.at ?? null}
      />
    </div>
  );
};

