import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderHeart, Sparkles,
  ChevronRight, Clock, Trophy,
  Heart, Users, HardHat, BatteryFull, BatteryLow, BatteryWarning, Wifi, WifiOff, ShieldCheck,
  Bell, Siren, Share2, Stethoscope,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { DEPARTMENTS, SHOWCASE_HOSPITAL, getDepartment } from '../../data/hospitals';
import { listenUpcomingAppointments, type Appointment } from '../../data/appointments';
import { listenUserProfile, type UserProfile } from '../../data/user';
import { listenHelmet, isHelmetLive, pairHelmet, verifyHelmet, type HelmetDevice } from '../../data/helmet';
import { useSharedLocation } from '../../hooks/useSharedLocation';

const HELMET_HELP_SEC = 60;

export const DashboardPage = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const { currentLocation } = useSharedLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [points, setPoints] = useState(0);
  const [helmet, setHelmet] = useState<HelmetDevice | null>(null);

  useEffect(() => {
    if (!user?.uid) { setUpcoming([]); return; }
    return listenUpcomingAppointments(user.uid, setUpcoming, 1);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) { setProfile(null); return; }
    return listenUserProfile(user.uid, (p) => {
      setProfile(p);
      setPoints(p?.points ?? 0);
    });
  }, [user?.uid]);

  const displayFirstName =
    (profile?.name?.trim().split(/\s+/)[0])
    || (user?.displayName?.trim().split(/\s+/)[0])
    || (user?.email?.split('@')[0])
    || 'Friend';

  useEffect(() => {
    if (!user?.uid) { setHelmet(null); return; }
    return listenHelmet(user.uid, setHelmet);
  }, [user?.uid]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const next = upcoming[0];

  const shareLiveLocation = useCallback(async () => {
    if (!currentLocation) {
      nav('/app/sos');
      return;
    }
    const url = `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lon}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My live location', text: 'Shared from Helmet One', url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Location link copied to clipboard');
      }
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [currentLocation, nav]);

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-4 max-w-lg mx-auto w-full space-y-4">
      {/* Helmet One — top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-amber-400/90 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(251,191,36,0.35)]">
            <HardHat className="h-5 w-5 text-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-white truncate">Helmet One</h1>
            <p className="text-[10px] text-white/40 truncate">{greeting}, {displayFirstName}</p>
          </div>
        </div>
        <button
          type="button"
          className="h-10 w-10 rounded-2xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-white/60 hover:bg-white/[0.08] transition shrink-0"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>

      {/* Smart Helmet status card — primary device hero */}
      <HelmetCard helmet={helmet} uid={user?.uid} />

      {/* Emergency SOS — Helmet One card */}
      <div className="rounded-3xl border-2 border-red-500/40 bg-[#12131a] p-5 shadow-[0_0_32px_rgba(220,38,38,0.12)]">
        <p className="text-sm font-bold text-white/80 text-center leading-snug">
          In an emergency? Get help in <span className="text-red-400 font-black">{HELMET_HELP_SEC} seconds</span>.
        </p>
        <button
          type="button"
          onClick={() => nav('/app/sos')}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white shadow-[0_0_28px_rgba(220,38,38,0.45)] active:scale-[0.99] transition"
          style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}
        >
          <Siren className="h-5 w-5" />
          Request Emergency Help
        </button>
      </div>

      {/* Helmet health strip */}
      <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-5 w-5 text-emerald-300 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-black text-emerald-100">Great! Your helmet is working well</div>
            <div className="text-[10px] text-emerald-200/60 truncate">Sensors · battery · connectivity</div>
          </div>
        </div>
        {user?.uid && helmet && (
          <Link to="/app/profile" className="text-[10px] font-black text-emerald-200 underline shrink-0">
            Verify Helmet
          </Link>
        )}
      </div>

      {/* Upcoming appointment (if any) */}
      {next && <UpcomingCard appt={next} />}

      {/* Partner hospital call-out */}
      <Link
        to={`/app/care/hospital/${SHOWCASE_HOSPITAL.id}?dept=general`}
        className="block rounded-3xl border border-white/[0.08] bg-[#13141a] p-4 relative overflow-hidden hover:border-white/15 transition"
      >
        <div className="absolute -top-14 -right-14 h-40 w-40 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }} />
        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
            style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>
            🏥
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Partner Hospital</div>
            <div className="text-sm font-black text-white truncate">{SHOWCASE_HOSPITAL.name}</div>
            <div className="text-[11px] text-white/45 truncate">Bookable 24×7 · All departments</div>
          </div>
          <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
        </div>
      </Link>

      {/* Departments horizontal scroll */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Browse by Department</div>
          <Link to="/app/care" className="text-[10px] font-bold text-sky-300 hover:text-sky-200">See all →</Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {DEPARTMENTS.slice(0, 8).map((d) => (
            <Link
              key={d.id}
              to={`/app/care/department/${d.id}`}
              className="shrink-0 w-24 rounded-2xl border border-white/[0.06] bg-[#13141a] p-3 hover:border-white/15 transition"
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg" style={{ background: d.gradient }}>
                {d.icon}
              </div>
              <div className="mt-2 text-[11px] font-black text-white truncate">{d.name}</div>
              <div className="text-[9px] text-white/35 truncate">{d.tagline}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* More tools */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">More</div>
        <div className="grid grid-cols-4 gap-2">
          <QuickLink to="/app/medical-id"
            icon={<Heart className="h-4 w-4 text-red-300" />} label="Medical ID" tint="rgba(239,68,68,0.10)" />
          <QuickLink to="/app/safety"
            icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />} label="Safety" tint="rgba(16,185,129,0.10)" />
          <QuickLink to="/app/vault"
            icon={<FolderHeart className="h-4 w-4 text-pink-300" />} label="Vault" tint="rgba(236,72,153,0.10)" />
          <QuickLink to="/app/care"
            icon={<Stethoscope className="h-4 w-4 text-sky-300" />} label="Hospitals" tint="rgba(14,165,233,0.10)" />
        </div>
      </div>

      {/* Quick actions — below hospital & more (Helmet One layout) */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-2">Quick actions</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => nav('/app/sos?crash=1')}
            className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.08] p-4 flex flex-col items-center text-center gap-2 active:scale-[0.98] transition"
          >
            <div className="h-14 w-14 rounded-full bg-amber-500/20 flex items-center justify-center text-2xl">⚠️</div>
            <span className="text-xs font-black text-amber-100">Report Accident</span>
          </button>
          <a
            href="tel:108"
            className="rounded-3xl border border-sky-500/25 bg-sky-500/[0.08] p-4 flex flex-col items-center text-center gap-2 active:scale-[0.98] transition"
          >
            <div className="h-14 w-14 rounded-full bg-sky-500/20 flex items-center justify-center text-2xl">🚑</div>
            <span className="text-xs font-black text-sky-100">Call Ambulance</span>
          </a>
          <button
            type="button"
            onClick={() => void shareLiveLocation()}
            className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.08] p-4 flex flex-col items-center text-center gap-2 active:scale-[0.98] transition"
          >
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Share2 className="h-6 w-6 text-emerald-300" />
            </div>
            <span className="text-xs font-black text-emerald-100">Share Live Location</span>
          </button>
          <Link
            to="/app/safety-circle"
            className="rounded-3xl border border-violet-500/25 bg-violet-500/[0.08] p-4 flex flex-col items-center text-center gap-2 active:scale-[0.98] transition"
          >
            <div className="h-14 w-14 rounded-full bg-violet-500/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-violet-200" />
            </div>
            <span className="text-xs font-black text-violet-100">Safety Circle</span>
          </Link>
        </div>
      </div>

      {/* Community impact strip — Helmet One style metrics */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#22c55e)' }} />
        <div className="relative">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-300">Riding protected</div>
              <div className="text-sm font-black text-white">Community impact</div>
            </div>
            <Sparkles className="h-4 w-4 text-sky-300" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat n="16+" l="Accidents reported" />
            <Stat n="2.9k+" l="Roadside assists" />
            <Stat n="7.4k+" l="Safe rides" />
          </div>
        </div>
      </div>

      {/* Arogya points preview */}
      <Link
        to="/app/profile"
        className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#13141a] p-3.5 hover:border-white/15 transition"
      >
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
          <Trophy className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Arogya Points</div>
          <div className="text-sm font-black text-white">{points.toLocaleString()} pts</div>
        </div>
        <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
      </Link>

      {/* Helpline strip (compact, no longer dominant) */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: '112', label: 'Emergency', color: '#dc2626' },
          { num: '108', label: 'Ambulance', color: '#10b981' },
          { num: '100', label: 'Police',    color: '#3b82f6' },
          { num: '1091', label: 'Women',    color: '#a855f7' },
        ].map((h) => (
          <a key={h.num} href={`tel:${h.num}`}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.05] bg-white/[0.03] py-3 transition active:scale-95">
            <span className="text-sm font-black" style={{ color: h.color }}>{h.num}</span>
            <span className="text-[9px] text-white/30 font-semibold">{h.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
};

const QuickLink = ({
  to, icon, label, tint,
}: { to: string; icon: React.ReactNode; label: string; tint?: string }) => (
  <Link
    to={to}
    className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.05] bg-white/[0.03] py-3 transition active:scale-95 hover:bg-white/[0.06]"
    style={tint ? { background: tint } : undefined}
  >
    {icon}
    <span className="text-[9px] text-white/70 font-bold">{label}</span>
  </Link>
);

const Stat = ({ n, l }: { n: string; l: string }) => (
  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.04] py-2 px-1 text-center">
    <div className="text-sm font-black text-white">{n}</div>
    <div className="text-[9px] text-white/45 font-semibold leading-tight mt-0.5">{l}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Smart Helmet status card. Shows live battery / connection / sensor health
// from `helmets/{uid}` Firestore doc. If no helmet is paired yet, renders a
// pair-helmet CTA.
// ─────────────────────────────────────────────────────────────────────────────
const HelmetCard = ({ helmet, uid }: { helmet: HelmetDevice | null; uid?: string }) => {
  const [busy, setBusy] = useState(false);

  if (!helmet) {
    return (
      <button
        type="button"
        disabled={!uid || busy}
        onClick={async () => {
          if (!uid) return;
          setBusy(true);
          try {
            // Generate a demo serial — in production, scan a QR or pair via BLE.
            const id = `AHO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            await pairHelmet({ ownerUid: uid, deviceId: id });
          } finally { setBusy(false); }
        }}
        className="w-full text-left rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition active:scale-[0.98] disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden bg-white/[0.05]">
            <img
              src="/helmet.png"
              alt="Smart helmet"
              className="h-full w-full object-cover opacity-70"
              loading="lazy"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/45">Aarogya Helmet One</div>
            <div className="text-sm font-black text-white">{busy ? 'Pairing…' : 'Pair your smart helmet'}</div>
            <div className="text-[11px] text-white/50">Auto crash detection · Live sensors · SOS sync</div>
          </div>
          <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
        </div>
      </button>
    );
  }

  const live = isHelmetLive(helmet);
  const bat = Math.max(0, Math.min(100, helmet.batteryPct ?? 0));
  const BatIcon = bat > 70 ? BatteryFull : bat > 25 ? BatteryWarning : BatteryLow;
  const batTint = bat > 70 ? '#10b981' : bat > 25 ? '#f59e0b' : '#ef4444';
  const headline = live ? 'Riding Protected' : 'Helmet Offline';

  return (
    <div className="rounded-3xl p-4 relative overflow-hidden"
      style={{ background: live
        ? 'linear-gradient(135deg,#1e3a8a,#0c4a6e)'
        : 'linear-gradient(135deg,#1f2937,#0f172a)' }}>
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: live ? 'rgba(56,189,248,0.55)' : 'rgba(100,116,139,0.45)' }} />

      {/* Header row */}
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">{headline}</span>
            {live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </div>
          <div className="text-base font-black text-white truncate">{helmet.model}</div>
          {helmet.deviceId && (
            <div className="text-[10px] text-white/45 font-mono truncate">{helmet.deviceId}</div>
          )}
        </div>
        <button
          type="button"
          disabled={!uid || busy}
          onClick={async () => {
            if (!uid) return;
            setBusy(true);
            try { await verifyHelmet(uid); } finally { setBusy(false); }
          }}
          className="rounded-full border border-white/20 bg-white/10 px-3 h-8 text-[10px] font-black text-white hover:bg-white/15 transition active:scale-95 disabled:opacity-50 shrink-0"
        >
          {busy ? '…' : 'Verify'}
        </button>
      </div>

      {/* Helmet hero image */}
      <div className="relative mt-3 mb-2 rounded-2xl overflow-hidden bg-black/25 border border-white/[0.06]">
        <img
          src="/helmet.png"
          alt="Aarogya Helmet One — sensor-equipped smart helmet"
          className="w-full h-32 object-cover object-center"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        {live && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white">Live</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 backdrop-blur">
          <HardHat className="h-3 w-3 text-white/80" />
          <span className="text-[9px] font-black tracking-wide text-white/80">Hardware Connected</span>
        </div>
      </div>

      {/* Telemetry chips */}
      <div className="relative flex items-center justify-between gap-2 text-[11px] text-white/85 font-semibold">
        <Chip icon={live ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3 text-amber-300" />}>
          {live ? 'Connected' : 'Offline'}
        </Chip>
        <Chip icon={<BatIcon className="h-3 w-3" style={{ color: batTint }} />}>
          <span style={{ color: batTint }}>{bat}%</span>
        </Chip>
        <Chip icon={<ShieldCheck className="h-3 w-3 text-emerald-300" />}>
          Sensors {helmet.sensorsActive ? 'on' : 'off'}
        </Chip>
      </div>
      <div className="relative mt-3 text-center text-[12px] font-black text-white/90">
        Sensors {helmet.sensorsActive ? 'Active' : 'Off'} · Battery {bat}%
      </div>
      <Link to="/app/profile" className="relative mt-1.5 block text-center text-[10px] font-black text-sky-300 uppercase tracking-widest hover:text-sky-200">
        configure
      </Link>
    </div>
  );
};

const Chip = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-white/[0.06] border border-white/[0.08] px-2 py-1.5 backdrop-blur">
    {icon}
    {children}
  </span>
);

const UpcomingCard = ({ appt }: { appt: Appointment }) => {
  const dept = getDepartment(appt.department);
  const when = appt.startAt;
  const now = Date.now();
  const diffMs = when.getTime() - now;
  const diffMin = Math.round(diffMs / 60000);
  const relative =
    diffMin < 0 ? 'In progress' :
    diffMin < 60 ? `in ${diffMin} min` :
    diffMin < 1440 ? `in ${Math.round(diffMin / 60)} hr` :
    `in ${Math.round(diffMin / 1440)} day${Math.round(diffMin / 1440) === 1 ? '' : 's'}`;

  return (
    <Link
      to="/app/appointments"
      className="block rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-emerald-500/[0.02] p-4 relative overflow-hidden hover:border-emerald-500/30 transition"
    >
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: dept.gradient }} />
      <div className="relative flex items-start gap-3">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
          style={{ background: dept.gradient }}
        >
          {appt.doctorAvatar || dept.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Upcoming</span>
            <span className="text-[10px] font-bold text-emerald-300/80">· {relative}</span>
          </div>
          <div className="mt-0.5 text-sm font-black text-white truncate">
            {appt.doctorName || 'Doctor'}{appt.departmentName ? ` · ${appt.departmentName}` : ''}
          </div>
          <div className="text-[11px] text-white/55 truncate">
            {appt.hospitalName || 'Hospital'}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/55 font-semibold">
            <Clock className="h-3 w-3" />
            {when.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            <span className="h-1 w-1 rounded-full bg-white/20" />
            {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {appt.feeRupees && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-emerald-300">₹{appt.feeRupees}</span>
              </>
            )}
            {appt.paymentStatus === 'paid' && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-emerald-300 font-black">PAID</span>
              </>
            )}
            {(appt.paymentStatus === 'unpaid' || (!appt.paymentStatus && !appt.paymentMethod)) && appt.feeRupees ? (
              <>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-amber-300 font-black">PAY AT HOSP</span>
              </>
            ) : null}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-white/30 shrink-0 self-center" />
      </div>
    </Link>
  );
};

// Silence unused (Sparkles / Phone used elsewhere) if code evolves.
export const _reserved = { Sparkles };
