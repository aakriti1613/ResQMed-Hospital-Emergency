import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listenAlertsForHospital, updateHospitalAlert, dispatchAmbulance,
  seedDemoAlerts, clearDemoAlerts,
  type HospitalAlert,
} from '../../data/hospitalAlerts';
import {
  getSosRequestDoc, listenAssignmentsForRequest,
  type SosAssignmentDoc, type SosRequestDoc,
} from '../../data/sos';
import { SHOWCASE_HOSPITAL } from '../../data/hospitals';
import { getUserProfile, type UserProfile, computeAgeFromDob } from '../../data/user';
import { listenHelmet, type HelmetDevice } from '../../data/helmet';
import {
  listenAppointmentsForHospital, completeAppointment, setAppointmentStatus,
  seedDemoAppointments, clearDemoAppointments,
  type Appointment,
} from '../../data/appointments';
import { googleMapsUrl, lastSeenLabel } from '../../features/sos/liveCrashPrediction';
import { formatEta } from '../../data/routing';
import { isDemoMode } from '../../app/env';
import {
  CheckCircle2, User, Activity, AlertTriangle, Syringe, Ambulance, ArrowLeft,
  Heart, Wind, Waves, MapPin, Wifi, WifiOff, LayoutDashboard, Siren, CalendarDays,
  Truck, X, Stethoscope, Clock, IndianRupee, ClipboardList, Sparkles, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkline } from '../../components/Sparkline';
import { heartRateBadge, spo2Badge } from '../../components/ClinicalBadge';

// ─────────────────────────────────────────────────────────────────────────────
// Ambulance fleet (showcase). Statuses are derived from which alerts have an
// active dispatch referencing each unit.
// ─────────────────────────────────────────────────────────────────────────────
const FLEET = [
  { id: 'ARG-108', type: 'Advanced Life Support' },
  { id: 'ARG-109', type: 'Basic Life Support' },
  { id: 'ARG-110', type: 'Patient Transport' },
  { id: 'ARG-111', type: 'Advanced Life Support' },
] as const;

// A single comprehensive object representing an incoming patient
type PatientIncoming = {
  alert: HospitalAlert;
  sos: SosRequestDoc | null;
  victimProfile: UserProfile | null;
  primaryResponder: SosAssignmentDoc | null;
};

type Tab = 'overview' | 'emergencies' | 'appointments' | 'ambulances';

// ── Display helpers (prefer live profile, fall back to alert snapshot) ───────
const pName = (p: PatientIncoming) =>
  p.victimProfile?.name || p.sos?.victimBrief?.name || p.alert.patientName || 'Unknown Patient';
const pAge = (p: PatientIncoming): number | undefined =>
  (p.victimProfile?.dob ? computeAgeFromDob(p.victimProfile.dob) : undefined)
  ?? p.sos?.victimBrief?.age ?? p.alert.patientAge;
const pBlood = (p: PatientIncoming) => p.victimProfile?.bloodGroup || p.alert.bloodGroup || 'Unknown';
const pConditions = (p: PatientIncoming) => p.victimProfile?.medicalConditions || p.alert.medicalConditions || '';
const pAllergies = (p: PatientIncoming) => p.victimProfile?.allergies || p.alert.allergies || '';
const pIncident = (p: PatientIncoming) => p.sos?.incidentType || p.alert.incidentType || 'unknown';

export const HospitalPortalPage = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [alerts, setAlerts] = useState<HospitalAlert[]>([]);
  const [patients, setPatients] = useState<PatientIncoming[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [emergencyView, setEmergencyView] = useState<'list' | 'detail'>('list');

  useEffect(() => listenAlertsForHospital(SHOWCASE_HOSPITAL.id, setAlerts), []);
  useEffect(() => listenAppointmentsForHospital(SHOWCASE_HOSPITAL.id, setAppointments), []);

  useEffect(() => {
    let active = true;
    const fetchContext = async () => {
      const enriched: PatientIncoming[] = await Promise.all(
        alerts.map(async (alert) => {
          let sos: SosRequestDoc | null = null;
          let victimProfile: UserProfile | null = null;
          let primaryResponder: SosAssignmentDoc | null = null;
          try {
            sos = await getSosRequestDoc(alert.requestId);
            if (sos) victimProfile = await getUserProfile(sos.victimId);
            if (alert.helperId && alert.requestId) {
              const assignments = await new Promise<SosAssignmentDoc[]>((resolve) => {
                const unsub = listenAssignmentsForRequest(alert.requestId, (assigns) => {
                  unsub();
                  resolve(assigns);
                });
              });
              primaryResponder = assignments.find((a) => a.helperId === alert.helperId) || null;
            }
          } catch (e) {
            console.error('Error fetching context for alert', alert.id, e);
          }
          return { alert, sos, victimProfile, primaryResponder };
        }),
      );
      if (active) setPatients(enriched);
    };
    fetchContext();
    return () => { active = false; };
  }, [alerts]);

  const selectedPatient = patients.find((p) => p.alert.id === selectedAlertId) || null;

  // ── Live patient vitals (helmet stream) for the selected emergency ─────────
  const [helmet, setHelmet] = useState<HelmetDevice | null>(null);
  const hrBufRef = useRef<number[]>([]);
  const spo2BufRef = useRef<number[]>([]);
  const vibBufRef = useRef<number[]>([]);
  const [bufTick, setBufTick] = useState(0);

  useEffect(() => {
    hrBufRef.current = [];
    spo2BufRef.current = [];
    vibBufRef.current = [];
    setHelmet(null);
    setBufTick(0);
    const victimId = selectedPatient?.sos?.victimId;
    if (!victimId) return;
    return listenHelmet(victimId, (h) => {
      setHelmet(h);
      if (!h) return;
      const push = (buf: number[], v?: number) => {
        if (typeof v !== 'number') return;
        buf.push(v);
        if (buf.length > 30) buf.shift();
      };
      push(hrBufRef.current, h.heartRate);
      push(spo2BufRef.current, h.spo2);
      push(vibBufRef.current, h.vibration);
      setBufTick((t) => t + 1);
    });
  }, [selectedPatient?.sos?.victimId]);

  // ── Derived KPIs ───────────────────────────────────────────────────────────
  const pendingCount = patients.filter((p) => p.alert.status === 'notified').length;
  const ackCount = patients.filter((p) => p.alert.status === 'acknowledged').length;
  const busyUnits = useMemo(
    () => new Set(
      patients
        .filter((p) => p.alert.ambulanceStatus && p.alert.ambulanceStatus !== 'arrived' && p.alert.ambulanceVehicleNo)
        .map((p) => p.alert.ambulanceVehicleNo as string),
    ),
    [patients],
  );
  const availableUnits = FLEET.length - busyUnits.size;
  const todaysAppointments = useMemo(() => {
    const d = new Date();
    return appointments.filter(
      (a) => a.status === 'scheduled' && a.startAt.toDateString() === d.toDateString(),
    ).length;
  }, [appointments]);

  const openEmergency = (alertId: string) => {
    setSelectedAlertId(alertId);
    setEmergencyView('detail');
    setTab('emergencies');
  };

  return (
    <div className="relative mx-auto w-full max-w-lg min-h-dvh bg-[#0a0b0f] flex flex-col font-sans text-white">
      {/* Top Navbar */}
      <header className="h-16 shrink-0 border-b border-white/[0.06] bg-[#12131a] flex items-center px-4 justify-between shadow-md z-10 sticky top-0">
        <div className="flex items-center gap-3 min-w-0">
          {tab === 'emergencies' && emergencyView === 'detail' ? (
            <button
              onClick={() => setEmergencyView('list')}
              className="h-8 w-8 shrink-0 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition"
              aria-label="Back to queue"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/app"
              className="h-8 w-8 shrink-0 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition"
              aria-label="Close hospital portal"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Link>
          )}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">H</div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-wide leading-tight truncate">{SHOWCASE_HOSPITAL.name}</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">Command Center</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest whitespace-nowrap">{pendingCount} Pending</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + (tab === 'emergencies' ? emergencyView : '')}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'overview' && (
              <OverviewTab
                pendingCount={pendingCount}
                ackCount={ackCount}
                availableUnits={availableUnits}
                fleetTotal={FLEET.length}
                todaysAppointments={todaysAppointments}
                patients={patients}
                onOpenEmergency={openEmergency}
                onGoTab={setTab}
              />
            )}
            {tab === 'emergencies' && (
              <EmergenciesTab
                patients={patients}
                view={emergencyView}
                setView={setEmergencyView}
                selectedPatient={selectedPatient}
                onSelect={(id) => { setSelectedAlertId(id); setEmergencyView('detail'); }}
                helmet={helmet}
                hrBuf={hrBufRef.current}
                spo2Buf={spo2BufRef.current}
                vibBuf={vibBufRef.current}
                bufTick={bufTick}
                busyUnits={busyUnits}
              />
            )}
            {tab === 'appointments' && <AppointmentsTab appointments={appointments} />}
            {tab === 'ambulances' && <AmbulancesTab patients={patients} busyUnits={busyUnits} onOpenEmergency={openEmergency} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom tab bar (app-style) — sticky so it stays inside the phone frame */}
      <nav className="sticky bottom-0 z-20 border-t border-white/[0.06] bg-[#12131a]/95 backdrop-blur-md">
        <div className="flex items-stretch">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={<LayoutDashboard className="h-5 w-5" />} label="Overview" />
          <TabButton active={tab === 'emergencies'} onClick={() => setTab('emergencies')} icon={<Siren className="h-5 w-5" />} label="Emergencies" badge={pendingCount || undefined} />
          <TabButton active={tab === 'appointments'} onClick={() => setTab('appointments')} icon={<CalendarDays className="h-5 w-5" />} label="Visits" />
          <TabButton active={tab === 'ambulances'} onClick={() => setTab('ambulances')} icon={<Truck className="h-5 w-5" />} label="Fleet" />
        </div>
      </nav>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label, badge }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number;
}) => (
  <button
    onClick={onClick}
    className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition ${
      active ? 'text-emerald-400' : 'text-white/40 hover:text-white/70'
    }`}
  >
    <div className="relative">
      {icon}
      {badge ? (
        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">{badge}</span>
      ) : null}
    </div>
    {label}
  </button>
);

// ═════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═════════════════════════════════════════════════════════════════════════════
const OverviewTab = ({
  pendingCount, ackCount, availableUnits, fleetTotal, todaysAppointments,
  patients, onOpenEmergency, onGoTab,
}: {
  pendingCount: number; ackCount: number; availableUnits: number; fleetTotal: number;
  todaysAppointments: number; patients: PatientIncoming[];
  onOpenEmergency: (id: string) => void; onGoTab: (t: Tab) => void;
}) => {
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const recent = patients.slice(0, 4);

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-lg font-black">Today at a glance</h2>
        <p className="text-xs text-white/40">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Pending emergencies" value={pendingCount} tone="red" icon={<Siren className="h-4 w-4" />} onClick={() => onGoTab('emergencies')} />
        <KpiCard label="In preparation" value={ackCount} tone="amber" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => onGoTab('emergencies')} />
        <KpiCard label="Today's visits" value={todaysAppointments} tone="sky" icon={<CalendarDays className="h-4 w-4" />} onClick={() => onGoTab('appointments')} />
        <KpiCard label="Ambulances free" value={`${availableUnits}/${fleetTotal}`} tone="emerald" icon={<Truck className="h-4 w-4" />} onClick={() => onGoTab('ambulances')} />
      </div>

      {/* Recent emergencies */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/45">
            <Siren className="h-4 w-4" /> Latest incoming
          </div>
          <button onClick={() => onGoTab('emergencies')} className="text-[10px] font-black text-emerald-400 hover:text-emerald-300">View all →</button>
        </div>
        {recent.length === 0 ? (
          <div className="py-6 text-center text-white/30 text-sm">No active incoming alerts.</div>
        ) : (
          <div className="space-y-2">
            {recent.map((p) => (
              <button
                key={p.alert.id}
                onClick={() => onOpenEmergency(p.alert.id)}
                className="w-full text-left flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] p-3 transition"
              >
                <SeverityDot severity={p.alert.severity} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black truncate">{pName(p)}</div>
                  <div className="text-[11px] text-white/45 truncate">{p.alert.suggestedDept || 'Emergency Room'}</div>
                </div>
                <StatusPill status={p.alert.status} ambulance={p.alert.ambulanceStatus} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Demo controls — only in demo mode */}
      {isDemoMode && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">
            <Sparkles className="h-4 w-4" /> Demo data
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed mb-3">
            You're in demo mode (no Firebase). Load sample incoming patients and appointments to explore the full console.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const a = seedDemoAlerts(SHOWCASE_HOSPITAL.id, SHOWCASE_HOSPITAL.name);
                const b = seedDemoAppointments(SHOWCASE_HOSPITAL.id, SHOWCASE_HOSPITAL.name);
                setSeedMsg(`Loaded ${a} emergencies + ${b} appointments`);
                setTimeout(() => setSeedMsg(null), 2500);
              }}
              className="flex-1 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black transition"
            >
              Load demo data
            </button>
            <button
              onClick={() => {
                clearDemoAlerts();
                clearDemoAppointments();
                setSeedMsg('Cleared demo data');
                setTimeout(() => setSeedMsg(null), 2500);
              }}
              className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 text-xs font-black transition"
            >
              Clear demo data
            </button>
          </div>
          {seedMsg && <div className="mt-2 text-[11px] text-emerald-300 font-bold">{seedMsg}</div>}
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, tone, icon, onClick }: {
  label: string; value: number | string; tone: 'red' | 'amber' | 'sky' | 'emerald'; icon: React.ReactNode; onClick?: () => void;
}) => {
  const tones: Record<string, string> = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  return (
    <button onClick={onClick} className="text-left rounded-2xl border border-white/[0.06] bg-[#13141a] p-4 hover:bg-white/[0.04] transition">
      <div className={`h-8 w-8 rounded-lg border flex items-center justify-center mb-3 ${tones[tone]}`}>{icon}</div>
      <div className="text-3xl font-black leading-none">{value}</div>
      <div className="text-[10px] text-white/45 uppercase tracking-widest mt-1.5">{label}</div>
    </button>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// EMERGENCIES
// ═════════════════════════════════════════════════════════════════════════════
const EmergenciesTab = ({
  patients, view, setView, selectedPatient, onSelect,
  helmet, hrBuf, spo2Buf, vibBuf, bufTick, busyUnits,
}: {
  patients: PatientIncoming[];
  view: 'list' | 'detail';
  setView: (v: 'list' | 'detail') => void;
  selectedPatient: PatientIncoming | null;
  onSelect: (id: string) => void;
  helmet: HelmetDevice | null;
  hrBuf: number[]; spo2Buf: number[]; vibBuf: number[]; bufTick: number;
  busyUnits: Set<string>;
}) => {
  const [dispatchOpen, setDispatchOpen] = useState(false);

  if (view === 'list') {
    return (
      <div className="p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-white/50 mb-3">Incoming Patients</h2>
        <div className="space-y-2">
          {patients.length === 0 && (
            <div className="p-6 text-center text-white/30 text-sm mt-10">No active incoming alerts.</div>
          )}
          {patients.map((p) => {
            const isPending = p.alert.status === 'notified';
            return (
              <button
                key={p.alert.id}
                onClick={() => onSelect(p.alert.id)}
                className="w-full text-left p-4 rounded-2xl border transition-all bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] active:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isPending && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isPending ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isPending ? 'Action Required' : p.alert.status === 'arrived' ? 'Arrived' : 'Acknowledged'}
                      </span>
                    </div>
                    <div className="text-base font-black truncate">{pName(p)}</div>
                    <div className="text-xs text-white/50 mt-0.5 truncate">{p.alert.suggestedDept || 'Emergency Room'}</div>
                    {p.alert.ambulanceStatus && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-sky-300">
                        <Truck className="h-3 w-3" /> {p.alert.ambulanceVehicleNo} dispatched
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black text-white">
                      {p.primaryResponder?.etaSeconds ? formatEta(p.primaryResponder.etaSeconds)
                        : p.alert.ambulanceEtaMin ? `${p.alert.ambulanceEtaMin}m` : '-'}
                    </div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">ETA</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Detail ─────────────────────────────────────────────────────────────────
  if (!selectedPatient) {
    return (
      <div className="p-8 text-center text-white/40 font-semibold">
        <p>This patient is no longer in the queue.</p>
        <button onClick={() => setView('list')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15">
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </button>
      </div>
    );
  }

  const sp = selectedPatient;
  const age = pAge(sp);
  const conditions = pConditions(sp);
  const allergies = pAllergies(sp);

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-black mb-2 break-words">{pName(sp)}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60 font-semibold">
            <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-white/40" /> Age {age ?? 'Unknown'}</span>
            <span className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-white/40" /> Blood: {pBlood(sp)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {sp.alert.status === 'notified' ? (
            <>
              <button
                onClick={() => updateHospitalAlert(sp.alert.id, { status: 'acknowledged' })}
                className="w-full px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" /> Accept &amp; Prepare
              </button>
              <p className="text-[11px] text-white/40 text-center">Accept this emergency to dispatch an ambulance.</p>
            </>
          ) : (
            <>
              <div className="w-full px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> {sp.alert.status === 'arrived' ? 'Patient arrived' : 'Accepted · Preparing'}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {!sp.alert.ambulanceStatus ? (
                  <button
                    onClick={() => setDispatchOpen(true)}
                    className="px-4 py-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-200 font-black text-sm flex items-center justify-center gap-2 hover:bg-sky-500/25 transition"
                  >
                    <Truck className="h-4 w-4" /> Dispatch ambulance
                  </button>
                ) : (
                  <div className="px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 font-bold text-xs flex flex-col items-center justify-center">
                    <span className="flex items-center gap-1.5 font-black"><Truck className="h-4 w-4" /> {sp.alert.ambulanceVehicleNo}</span>
                    <span className="text-[10px] text-white/50">ETA {sp.alert.ambulanceEtaMin ?? '—'} min · {sp.alert.ambulanceStatus}</span>
                  </div>
                )}
                {sp.alert.status !== 'arrived' ? (
                  <button
                    onClick={() => updateHospitalAlert(sp.alert.id, { status: 'arrived' })}
                    className="px-4 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 font-black text-sm flex items-center justify-center gap-2 hover:bg-white/[0.08] transition"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark arrived
                  </button>
                ) : (
                  <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> In facility
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Live vitals */}
      <LiveVitalsCard helmet={helmet} hrBuf={hrBuf} spo2Buf={spo2Buf} vibBuf={vibBuf} bufTick={bufTick} />

      {/* Transport */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
          <Ambulance className="h-4 w-4" /> Transport
        </div>
        <div className="text-4xl font-black text-blue-400 mb-1">
          {sp.primaryResponder?.etaSeconds ? formatEta(sp.primaryResponder.etaSeconds)
            : sp.alert.ambulanceEtaMin ? `${sp.alert.ambulanceEtaMin} min` : 'N/A'}
        </div>
        <div className="text-sm font-bold text-white/80">
          Via {sp.alert.ambulanceVehicleNo || sp.alert.helperName || 'Responder'}
        </div>
      </div>

      {/* Incident context */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
          <AlertTriangle className="h-4 w-4" /> Incident Context
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-white/40 mb-1">Type</div>
            <div className="text-base font-black capitalize text-red-400">{pIncident(sp)} Emergency</div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-1">Severity</div>
            <div className="text-base font-black capitalize text-amber-400">{sp.alert.severity || sp.sos?.severity || 'Assessing...'}</div>
          </div>
          <div className="col-span-2 mt-2">
            <div className="text-xs text-white/40 mb-1">Responder Notes</div>
            <div className="text-sm bg-white/5 p-3 rounded-xl border border-white/10 italic text-white/80">
              "{sp.alert.injuryNotes || 'No notes provided by responder yet.'}"
            </div>
          </div>
        </div>
      </div>

      {/* Medical history */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
          <Syringe className="h-4 w-4" /> Critical Medical History
        </div>
        {conditions.trim().length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {conditions.split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
              <div key={c} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold">{c}</div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-white/40 italic">No critical conditions found in record.</div>
        )}
        {allergies.trim().length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-white/40 mb-2">Known Allergies</div>
            <div className="flex flex-wrap gap-2">
              {allergies.split(',').map((a) => a.trim()).filter(Boolean).map((a) => (
                <div key={a} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">{a}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {dispatchOpen && (
          <DispatchModal
            patientName={pName(sp)}
            busyUnits={busyUnits}
            onClose={() => setDispatchOpen(false)}
            onConfirm={async (vehicleNo, etaMin, crew) => {
              await dispatchAmbulance(sp.alert.id, { vehicleNo, etaMin, crew });
              setDispatchOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const DispatchModal = ({ patientName, busyUnits, onClose, onConfirm }: {
  patientName: string;
  busyUnits: Set<string>;
  onClose: () => void;
  onConfirm: (vehicleNo: string, etaMin: number, crew: string) => Promise<void>;
}) => {
  const free = FLEET.filter((u) => !busyUnits.has(u.id));
  const [vehicleNo, setVehicleNo] = useState(free[0]?.id ?? FLEET[0].id);
  const [etaMin, setEtaMin] = useState(8);
  const [crew, setCrew] = useState('Paramedic + EMT');
  const [busy, setBusy] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#13141a] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-black"><Truck className="h-5 w-5 text-sky-400" /> Dispatch ambulance</div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-white/50">Sending a unit to <span className="font-bold text-white/80">{patientName}</span>.</p>

        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Available unit</div>
          {free.length === 0 ? (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">All units are currently on call.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {free.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setVehicleNo(u.id)}
                  className={`text-left rounded-xl border p-3 transition ${vehicleNo === u.id ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}
                >
                  <div className="text-sm font-black">{u.id}</div>
                  <div className="text-[10px] text-white/45">{u.type}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">ETA (min)</span>
            <input type="number" min={1} max={60} value={etaMin} onChange={(e) => setEtaMin(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Crew</span>
            <input value={crew} onChange={(e) => setCrew(e.target.value)} maxLength={60}
              className="mt-1 w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white" />
          </label>
        </div>

        <button
          disabled={busy || free.length === 0}
          onClick={async () => { setBusy(true); try { await onConfirm(vehicleNo, etaMin, crew.trim()); } finally { setBusy(false); } }}
          className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-black text-sm transition flex items-center justify-center gap-2"
        >
          <Truck className="h-4 w-4" /> {busy ? 'Dispatching…' : `Dispatch ${vehicleNo}`}
        </button>
      </motion.div>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// APPOINTMENTS
// ═════════════════════════════════════════════════════════════════════════════
const AppointmentsTab = ({ appointments }: { appointments: Appointment[] }) => {
  const [filter, setFilter] = useState<'scheduled' | 'completed'>('scheduled');
  const [openId, setOpenId] = useState<string | null>(null);

  const scheduled = appointments.filter((a) => a.status === 'scheduled').sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const completed = appointments.filter((a) => a.status === 'completed').sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  const visible = filter === 'scheduled' ? scheduled : completed;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-black">Appointments</h2>
        <p className="text-xs text-white/40">Visits booked at {SHOWCASE_HOSPITAL.name}</p>
      </div>

      <div className="flex rounded-2xl border border-white/[0.05] bg-[#13141a] p-1 gap-1">
        <FilterBtn active={filter === 'scheduled'} onClick={() => setFilter('scheduled')} label={`Scheduled${scheduled.length ? ` · ${scheduled.length}` : ''}`} />
        <FilterBtn active={filter === 'completed'} onClick={() => setFilter('completed')} label={`Completed${completed.length ? ` · ${completed.length}` : ''}`} />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <CalendarDays className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm font-bold text-white/50">{filter === 'scheduled' ? 'No scheduled visits' : 'No completed visits'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((a) => (
            <AppointmentRow key={a.id} appt={a} open={openId === a.id} onToggle={() => setOpenId(openId === a.id ? null : a.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

const FilterBtn = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button onClick={onClick} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition ${active ? 'bg-emerald-500/20 text-emerald-200' : 'text-white/35 hover:text-white/60'}`}>{label}</button>
);

const AppointmentRow = ({ appt, open, onToggle }: { appt: Appointment; open: boolean; onToggle: () => void }) => {
  const isCompleted = appt.status === 'completed';
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#13141a] overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4 hover:bg-white/[0.02] transition">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-black truncate">{appt.patientName || 'Patient'}</div>
            <div className="text-[11px] text-white/50 truncate flex items-center gap-1 mt-0.5">
              <Stethoscope className="h-3 w-3 shrink-0" /> {appt.doctorName || 'Doctor'} · {appt.departmentName || ''}
            </div>
            <div className="text-[11px] text-white/45 flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              {appt.startAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {appt.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className={`rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-wider ${
              isCompleted ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300'
            }`}>{appt.status}</span>
            {appt.feeRupees !== undefined && (
              <div className="mt-1 text-[11px] text-amber-300 inline-flex items-center justify-end"><IndianRupee className="h-3 w-3" />{appt.feeRupees}</div>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.05] space-y-3">
              {(appt.patientAge || appt.patientBloodGroup) && (
                <div className="flex gap-3 text-[11px] text-white/55 font-semibold pt-2">
                  {appt.patientAge ? <span className="flex items-center gap-1"><User className="h-3 w-3" /> Age {appt.patientAge}</span> : null}
                  {appt.patientBloodGroup ? <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {appt.patientBloodGroup}</span> : null}
                </div>
              )}
              {appt.reason && (
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px] text-white/70">
                  <span className="text-white/35 font-black text-[10px] uppercase tracking-wider mr-1">Reason</span><br />{appt.reason}
                </div>
              )}
              {isCompleted ? <VisitSummaryView appt={appt} /> : <CompleteVisitForm appt={appt} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const VisitSummaryView = ({ appt }: { appt: Appointment }) => (
  <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-3 space-y-2">
    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-300">
      <ClipboardList className="h-3.5 w-3.5" /> Visit summary
    </div>
    <SummaryLine label="Diagnosis" value={appt.diagnosis} />
    <SummaryLine label="Prescription" value={appt.prescription} />
    <SummaryLine label="Advice" value={appt.advice} />
    {appt.completedAt && (
      <div className="text-[10px] text-white/35 pt-1">Completed {appt.completedAt.toLocaleString()}</div>
    )}
  </div>
);

const SummaryLine = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-[12px] text-white/80 leading-relaxed whitespace-pre-wrap">{value}</div>
    </div>
  );
};

const CompleteVisitForm = ({ appt }: { appt: Appointment }) => {
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [advice, setAdvice] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const inputCls = 'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[12px] text-white placeholder:text-white/25 outline-none focus:border-emerald-500/30';

  return (
    <div className="space-y-2.5">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
        <ClipboardList className="h-3.5 w-3.5" /> Complete visit
      </div>
      <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Diagnosis" className={inputCls} />
      <textarea value={prescription} onChange={(e) => setPrescription(e.target.value)} placeholder="Prescription / medication" rows={2} className={inputCls} />
      <textarea value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="After-care advice for the patient" rows={2} className={inputCls} />
      {done ? (
        <div className="text-[12px] text-emerald-300 font-bold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Visit completed · sent to patient</div>
      ) : (
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await completeAppointment(appt.id, {
                  diagnosis: diagnosis.trim() || undefined,
                  prescription: prescription.trim() || undefined,
                  advice: advice.trim() || undefined,
                });
                setDone(true);
              } finally { setBusy(false); }
            }}
            className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-black transition flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" /> {busy ? 'Saving…' : 'Mark visit complete'}
          </button>
          <button
            disabled={busy}
            onClick={() => setAppointmentStatus(appt.id, 'cancelled')}
            className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] text-white/50 hover:text-red-300 hover:bg-red-500/10 transition flex items-center justify-center"
            title="Cancel appointment"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// AMBULANCES
// ═════════════════════════════════════════════════════════════════════════════
const AmbulancesTab = ({ patients, busyUnits, onOpenEmergency }: {
  patients: PatientIncoming[]; busyUnits: Set<string>; onOpenEmergency: (id: string) => void;
}) => {
  const activeDispatches = patients.filter((p) => p.alert.ambulanceStatus && p.alert.ambulanceStatus !== 'arrived' && p.alert.ambulanceVehicleNo);

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-lg font-black">Ambulance fleet</h2>
        <p className="text-xs text-white/40">{FLEET.length - busyUnits.size} of {FLEET.length} units available</p>
      </div>

      {/* Fleet status */}
      <div className="grid grid-cols-1 gap-2">
        {FLEET.map((u) => {
          const onCall = patients.find((p) => p.alert.ambulanceVehicleNo === u.id && p.alert.ambulanceStatus && p.alert.ambulanceStatus !== 'arrived');
          const busy = !!onCall;
          return (
            <div key={u.id} className={`rounded-2xl border p-4 flex items-center gap-3 ${busy ? 'border-sky-500/25 bg-sky-500/[0.05]' : 'border-white/[0.06] bg-[#13141a]'}`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${busy ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black">{u.id}</div>
                <div className="text-[10px] text-white/45">{u.type}</div>
              </div>
              {busy && onCall ? (
                <button onClick={() => onOpenEmergency(onCall.alert.id)} className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">On call</div>
                  <div className="text-[11px] text-white/60 truncate max-w-[120px]">{pName(onCall)}</div>
                </button>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Available</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active dispatches */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/45 mb-2">Active dispatches</div>
        {activeDispatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/35">No ambulances are currently dispatched.</div>
        ) : (
          <div className="space-y-2">
            {activeDispatches.map((p) => (
              <div key={p.alert.id} className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black flex items-center gap-1.5"><Truck className="h-4 w-4 text-sky-300" /> {p.alert.ambulanceVehicleNo}</div>
                    <div className="text-[11px] text-white/55 truncate mt-0.5">→ {pName(p)} · ETA {p.alert.ambulanceEtaMin ?? '—'} min</div>
                    {p.alert.ambulanceCrew && <div className="text-[10px] text-white/35 mt-0.5">{p.alert.ambulanceCrew}</div>}
                  </div>
                  <button
                    onClick={() => updateHospitalAlert(p.alert.id, { ambulanceStatus: 'arrived' })}
                    className="shrink-0 h-9 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-black hover:bg-emerald-500/25 transition"
                  >
                    Mark returned
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Shared small UI
// ═════════════════════════════════════════════════════════════════════════════
const SeverityDot = ({ severity }: { severity?: string }) => {
  const color = severity === 'critical' ? 'bg-red-500' : severity === 'major' ? 'bg-amber-400' : 'bg-emerald-400';
  return <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />;
};

const StatusPill = ({ status, ambulance }: { status: HospitalAlert['status']; ambulance?: string }) => {
  if (ambulance && ambulance !== 'arrived') {
    return <span className="rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-300 shrink-0">Ambulance out</span>;
  }
  const map: Record<string, string> = {
    notified: 'bg-amber-500/15 text-amber-300',
    acknowledged: 'bg-emerald-500/15 text-emerald-300',
    arrived: 'bg-sky-500/15 text-sky-300',
    cancelled: 'bg-white/[0.06] text-white/40',
  };
  return <span className={`rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-wider shrink-0 ${map[status] ?? ''}`}>{status}</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// LiveVitalsCard — hospital-facing pre-arrival vitals (helmet stream).
// ─────────────────────────────────────────────────────────────────────────────
const LiveVitalsCard = ({ helmet, hrBuf, spo2Buf, vibBuf }: {
  helmet: HelmetDevice | null; hrBuf: number[]; spo2Buf: number[]; vibBuf: number[]; bufTick: number;
}) => {
  const live = !!helmet?.lastPingAt && (Date.now() - helmet.lastPingAt.getTime() < 60_000);

  const trend = (series: number[]): { delta: number; arrow: '↑' | '↓' | '→' } => {
    if (series.length < 3) return { delta: 0, arrow: '→' };
    const recent = series.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const older = series.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const delta = recent - older;
    if (Math.abs(delta) < 1) return { delta, arrow: '→' };
    return { delta, arrow: delta > 0 ? '↑' : '↓' };
  };

  const hrTrend = trend(hrBuf);
  const spo2Trend = trend(spo2Buf);
  const vibTrend = trend(vibBuf);
  const mapsUrl = googleMapsUrl(helmet?.lat, helmet?.lon);

  return (
    <div className={`rounded-2xl border p-5 ${live ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-amber-500/25 bg-amber-500/[0.04]'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {live ? <Wifi className="h-4 w-4 text-emerald-300" /> : <WifiOff className="h-4 w-4 text-amber-300" />}
          <div className="text-[10px] font-black uppercase tracking-widest text-white/65">
            Pre-arrival vitals · {live ? 'LIVE from helmet' : `last seen ${lastSeenLabel(helmet?.lastPingAt)}`}
          </div>
        </div>
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-[10px] font-black text-sky-200 hover:bg-sky-500/25 transition">
            <MapPin className="h-3 w-3" /> Open on Maps ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <VitalTrendTile icon={<Heart className="h-3.5 w-3.5 text-rose-300" />} label="Heart Rate" unit="BPM" value={helmet?.heartRate} series={hrBuf} color="#fb7185" arrow={hrTrend.arrow} delta={hrTrend.delta} />
        <VitalTrendTile icon={<Wind className="h-3.5 w-3.5 text-sky-300" />} label="SpO₂" unit="%" value={helmet?.spo2} series={spo2Buf} color="#38bdf8" arrow={spo2Trend.arrow} delta={spo2Trend.delta} />
        <VitalTrendTile icon={<Waves className="h-3.5 w-3.5 text-amber-300" />} label="Vibration" unit={helmet?.vibrationLabel ?? ''} value={helmet?.vibration} series={vibBuf} color="#facc15" arrow={vibTrend.arrow} delta={vibTrend.delta} />
      </div>

      {(heartRateBadge(helmet?.heartRate) || spo2Badge(helmet?.spo2)) && (
        <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
          {heartRateBadge(helmet?.heartRate)}
          {spo2Badge(helmet?.spo2)}
        </div>
      )}
    </div>
  );
};

const VitalTrendTile = ({ icon, label, unit, value, series, color, arrow, delta }: {
  icon: React.ReactNode; label: string; unit: string; value?: number; series: number[]; color: string; arrow: '↑' | '↓' | '→'; delta: number;
}) => {
  const display = value === undefined ? '—' : Number.isInteger(value) ? `${value}` : value.toFixed(1);
  const arrowColor = arrow === '↑' ? '#ef4444' : arrow === '↓' ? '#10b981' : '#94a3b8';
  return (
    <div className="rounded-xl bg-black/30 border border-white/[0.06] p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50">{icon} {label}</div>
        <span className="text-base font-black leading-none" style={{ color: arrowColor }} title={`Δ ${delta.toFixed(1)} over last 60s`}>{arrow}</span>
      </div>
      <div className="text-2xl font-black leading-none" style={{ color }}>{display}</div>
      <div className="text-[9px] text-white/40 mt-0.5">{unit}</div>
      <div className="mt-2">
        <Sparkline data={series} width={140} height={28} color={color} dot fill />
      </div>
    </div>
  );
};
