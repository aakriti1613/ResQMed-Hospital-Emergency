import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ChevronRight, ChevronDown, Clock, Trophy, Mic,
  Users, HardHat, BatteryFull, BatteryLow, BatteryWarning, Wifi, WifiOff, ShieldCheck,
  Bell, Siren, Share2, Stethoscope, Shield, TrendingUp, MapPin,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { getDepartment } from '../../data/hospitals';
import { listenUpcomingAppointments, type Appointment } from '../../data/appointments';
import { listenUserProfile, type UserProfile } from '../../data/user';
import { listenHelmet, isHelmetLive, pairHelmet, verifyHelmet, type HelmetDevice } from '../../data/helmet';
import {
  predictLive, riskColor, riskLabel, googleMapsUrl, lastSeenLabel,
} from '../../features/sos/liveCrashPrediction';
import { useHelmetHistory } from '../../hooks/useHelmetHistory';
import { Sparkline } from '../../components/Sparkline';
import { useSharedLocation } from '../../hooks/useSharedLocation';
import { useVoiceSos } from '../../hooks/useVoiceSos';
import { useTranslation } from 'react-i18next';
import { useEmergencyReadiness } from '../../hooks/useEmergencyReadiness';

const HELMET_HELP_SEC = 10;

export const DashboardPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const { readiness } = useEmergencyReadiness();
  const { currentLocation } = useSharedLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [points, setPoints] = useState(0);
  const [helmet, setHelmet] = useState<HelmetDevice | null>(null);
  const [showMore, setShowMore] = useState(false);
  // 60-second rolling history per vital — feeds sparklines below.
  const helmetHist = useHelmetHistory(user?.uid, 60);

  const { isListening: isVoiceListening, toggleListening: toggleVoiceSos, isSupported: isVoiceSupported } = useVoiceSos(() => {
    nav(`/app/sos?from=${encodeURIComponent('/app')}`);
  }, i18n.language);

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
  const greeting = hour < 12 ? t('dashboard.goodMorning') : hour < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening');

  const next = upcoming[0];

  const shareLiveLocation = useCallback(async () => {
    if (!currentLocation) {
      nav(`/app/sos?from=${encodeURIComponent('/app')}`);
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

  const helmetLive = helmet ? isHelmetLive(helmet) : false;
  const helmetLabel = !helmet
    ? t('dashboard.helmetNotPaired')
    : helmetLive
      ? t('dashboard.helmetLive')
      : t('dashboard.helmetOffline');

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-4 max-w-lg mx-auto w-full space-y-4">
      {/* ── Zone 1: Header + compact status ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-amber-400/90 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(251,191,36,0.35)]">
            <HardHat className="h-5 w-5 text-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-white truncate">{t('dashboard.helmetOne')}</h1>
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

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-[#13141a] px-3 py-2.5 text-left hover:border-white/12 transition active:scale-[0.99]"
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${helmetLive ? 'bg-emerald-400 animate-pulse' : helmet ? 'bg-amber-400' : 'bg-white/25'}`} />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold text-white/35 uppercase tracking-wider">{t('dashboard.helmetStatus')}</div>
            <div className="text-xs font-black text-white truncate">{helmetLabel}</div>
          </div>
        </button>
        <Link
          to="/app/challenges?from=home"
          className="flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-[#13141a] px-3 py-2.5 hover:border-white/12 transition active:scale-[0.99]"
        >
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black text-white"
            style={{ background: `${readiness.gradeColor}22`, border: `1.5px solid ${readiness.gradeColor}55` }}
          >
            {readiness.score}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold text-white/35 uppercase tracking-wider">{t('dashboard.readinessShort')}</div>
            <div className="text-xs font-black text-white truncate">{readiness.grade}</div>
          </div>
        </Link>
      </div>

      {/* Live helmet vitals strip — shows live OR last-known data with offline badge */}
      {helmet && (
        helmet.heartRate !== undefined || helmet.spo2 !== undefined ||
        helmet.vibration !== undefined || helmet.distanceCm !== undefined ||
        helmet.lat !== undefined
      ) && (() => {
        const live = helmetLive;
        const pred = predictLive(helmet);
        const mapsUrl = googleMapsUrl(helmet.lat, helmet.lon);
        const borderColor = live ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                                 : 'border-amber-500/15 bg-amber-500/[0.04]';
        const eyebrowColor = live ? 'text-emerald-300/90' : 'text-amber-300/90';
        const dotColor    = live ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400';
        return (
          <div className={`rounded-2xl border px-3 py-2.5 ${borderColor}`}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${eyebrowColor}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                {live ? 'Live helmet readings' : `Helmet offline · last seen ${lastSeenLabel(helmet.lastPingAt)}`}
              </div>
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline truncate"
                  title="Open in Google Maps"
                >
                  📍 {helmet.lat!.toFixed(4)}, {helmet.lon!.toFixed(4)}
                </a>
              ) : null}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <MiniVital label="HR"   value={helmet.heartRate}  unit="BPM"                          tint="#fb7185" series={helmetHist.hrSeries} />
              <MiniVital label="SpO₂" value={helmet.spo2}       unit="%"                            tint="#38bdf8" series={helmetHist.spo2Series} />
              <MiniVital label="Vib"  value={helmet.vibration}  unit={helmet.vibrationLabel ?? ''}  tint="#facc15" series={helmetHist.vibSeries} />
              <MiniVital label="Dist" value={helmet.distanceCm} unit="cm"                           tint="#a78bfa" series={helmetHist.distSeries} />
            </div>
            {/* Live crash-risk prediction (trained rule layer over current data) */}
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-black/30 border border-white/[0.05] px-2.5 py-2">
              <span
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: riskColor(pred.risk) }}
              >
                {riskLabel(pred.risk)}
              </span>
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${pred.confidence}%`, background: riskColor(pred.risk) }}
                />
              </div>
              <span className="text-[10px] font-black text-white/85 tabular-nums w-9 text-right">
                {pred.confidence}%
              </span>
            </div>
            {pred.crashed && (
              <div className="mt-1 text-[10px] font-bold text-red-300 leading-tight">
                ⚠ Model classifies current readings as a crash · severity: {pred.severity.toUpperCase()}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Zone 2: Primary SOS ── */}
      <div className="rounded-3xl border-2 border-red-500/40 bg-[#12131a] p-5 shadow-[0_0_32px_rgba(220,38,38,0.12)]">
        <p className="text-sm font-bold text-white/80 text-center leading-snug">
          {t('dashboard.emergencyText1')}{' '}
          <span className="text-red-400 font-black">{t('dashboard.emergencyText2', { seconds: HELMET_HELP_SEC })}</span>
        </p>
        <button
          type="button"
          onClick={() => nav(`/app/sos?from=${encodeURIComponent('/app')}`)}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white shadow-[0_0_28px_rgba(220,38,38,0.45)] active:scale-[0.99] transition"
          style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}
        >
          <Siren className="h-5 w-5" />
          {t('dashboard.requestHelp')}
        </button>
        {isVoiceSupported && (
          <button
            type="button"
            onClick={toggleVoiceSos}
            className={`mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[11px] font-bold transition border ${
              isVoiceListening
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : 'bg-transparent border-transparent text-white/45 hover:text-white/65'
            }`}
          >
            {isVoiceListening ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                {t('dashboard.listeningVoice')}
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                {t('dashboard.enableVoice')}
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Zone 3: Three clear shortcuts ── */}
      <div className="grid grid-cols-3 gap-2">
        <ShortcutTile
          to="/app/care"
          icon={<Stethoscope className="h-5 w-5 text-emerald-300" />}
          label={t('dashboard.shortcutCare')}
          sub={t('dashboard.shortcutCareSub')}
          tint="emerald"
        />
        <ShortcutTile
          to="/app/safety"
          icon={<Shield className="h-5 w-5 text-amber-300" />}
          label={t('dashboard.shortcutSafety')}
          sub={t('dashboard.shortcutSafetySub')}
          tint="amber"
        />
        <ShortcutTile
          to="/app/challenges?from=home"
          icon={<TrendingUp className="h-5 w-5 text-violet-300" />}
          label={t('dashboard.shortcutProgress')}
          sub={t('dashboard.shortcutProgressSub')}
          tint="violet"
        />
      </div>

      {next && <UpcomingCard appt={next} />}

      {/* ── Expandable: all secondary features (same links as before) ── */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition"
        >
          <div className="h-9 w-9 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-sky-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-white">{t('dashboard.moreServices')}</div>
            <div className="text-[10px] text-white/40 truncate">{t('dashboard.moreServicesHint')}</div>
          </div>
          <ChevronDown className={`h-5 w-5 text-white/30 shrink-0 transition-transform ${showMore ? 'rotate-180' : ''}`} />
        </button>

        {showMore && (
          <div className="px-4 pb-4 space-y-4 border-t border-white/[0.05] pt-4">
            <HelmetCard helmet={helmet} uid={user?.uid} />

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-2">{t('dashboard.quickActions')}</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => nav(`/app/sos?crash=1&from=${encodeURIComponent('/app')}`)}
                  className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-3 flex flex-col items-center text-center gap-1.5 active:scale-[0.98] transition"
                >
                  <span className="text-xl">⚠️</span>
                  <span className="text-[10px] font-black text-amber-100 leading-tight">{t('dashboard.reportAccident')}</span>
                </button>
                <a
                  href="tel:108"
                  className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.08] p-3 flex flex-col items-center text-center gap-1.5 active:scale-[0.98] transition"
                >
                  <span className="text-xl">🚑</span>
                  <span className="text-[10px] font-black text-sky-100 leading-tight">{t('dashboard.callAmbulance')}</span>
                </a>
                <button
                  type="button"
                  onClick={() => void shareLiveLocation()}
                  className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3 flex flex-col items-center text-center gap-1.5 active:scale-[0.98] transition"
                >
                  <Share2 className="h-5 w-5 text-emerald-300" />
                  <span className="text-[10px] font-black text-emerald-100 leading-tight">{t('dashboard.shareLocation')}</span>
                </button>
                <Link
                  to="/app/safety-circle?from=home"
                  className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.08] p-3 flex flex-col items-center text-center gap-1.5 active:scale-[0.98] transition"
                >
                  <Users className="h-5 w-5 text-violet-200" />
                  <span className="text-[10px] font-black text-violet-100 leading-tight">{t('dashboard.safetyCircle')}</span>
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-black text-white">{t('dashboard.communityImpact')}</div>
                <Link to="/app/analytics?from=home" className="text-[10px] font-bold text-sky-300">{t('nav.analytics')} →</Link>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Stat n="16+" l={t('dashboard.accidentsReported')} />
                <Stat n="2.9k+" l={t('dashboard.roadsideAssists')} />
                <Stat n="7.4k+" l={t('dashboard.safeRides')} />
              </div>
            </div>

            <Link
              to="/app/points?from=home"
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/12 transition"
            >
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">{t('dashboard.arogyaPoints')}</div>
                <div className="text-xs font-black text-white">{points.toLocaleString()} {t('dashboard.pts')}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

const TINT_BORDER: Record<string, string> = {
  emerald: 'border-emerald-500/20 bg-emerald-500/[0.06]',
  amber: 'border-amber-500/20 bg-amber-500/[0.06]',
  violet: 'border-violet-500/20 bg-violet-500/[0.06]',
};

const ShortcutTile = ({
  to, icon, label, sub, tint,
}: { to: string; icon: React.ReactNode; label: string; sub: string; tint: string }) => (
  <Link
    to={to}
    className={`rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5 hover:border-white/20 transition active:scale-[0.98] ${TINT_BORDER[tint] ?? TINT_BORDER.emerald}`}
  >
    <div className="h-10 w-10 rounded-xl bg-black/20 flex items-center justify-center">{icon}</div>
    <span className="text-[11px] font-black text-white leading-tight">{label}</span>
    <span className="text-[8px] text-white/40 leading-tight line-clamp-2">{sub}</span>
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
            // Generate a demo serial. In production, scan a QR or pair via BLE.
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
          alt="Aarogya Helmet One. Sensor-equipped smart helmet"
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
      {/* Live vitals grid — populated by the helmet bridge / GSM ingest */}
      {live && (helmet.heartRate !== undefined || helmet.spo2 !== undefined
                || helmet.vibration !== undefined || helmet.distanceCm !== undefined
                || helmet.lat !== undefined) && (
        <div className="relative mt-3 grid grid-cols-4 gap-1.5 text-[10px] font-bold">
          <VitalTile label="HR" value={helmet.heartRate !== undefined ? `${Math.round(helmet.heartRate)}` : '—'} unit="BPM" tint="#fb7185" />
          <VitalTile label="SpO₂" value={helmet.spo2 !== undefined ? `${Math.round(helmet.spo2)}` : '—'} unit="%" tint="#38bdf8" />
          <VitalTile
            label="Vib"
            value={helmet.vibration !== undefined ? `${Math.round(helmet.vibration)}` : '—'}
            unit={helmet.vibrationLabel ?? ''}
            tint="#facc15"
          />
          <VitalTile
            label="Dist"
            value={helmet.distanceCm !== undefined ? `${helmet.distanceCm.toFixed(0)}` : '—'}
            unit="cm"
            tint="#a78bfa"
          />
        </div>
      )}
      {helmet.lat !== undefined && helmet.lon !== undefined && (
        <a
          href={googleMapsUrl(helmet.lat, helmet.lon) || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-2 flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 text-[10px] font-bold text-white/75 hover:bg-white/[0.10] hover:text-white transition"
        >
          <MapPin className="h-3 w-3 text-emerald-300" />
          <span className="font-mono">{helmet.lat.toFixed(5)}, {helmet.lon.toFixed(5)}</span>
          <span className="ml-auto text-[9px] uppercase tracking-widest text-sky-300">Open ↗</span>
        </a>
      )}
      {!live && helmet.lastPingAt && (
        <div className="relative mt-2 text-center text-[10px] font-bold text-amber-300/80">
          Offline · last seen {lastSeenLabel(helmet.lastPingAt)}
        </div>
      )}

      <div className="relative mt-3 text-center text-[12px] font-black text-white/90">
        Sensors {helmet.sensorsActive ? 'Active' : 'Off'} · Battery {bat}%
      </div>
      <Link to="/app/profile" className="relative mt-1.5 block text-center text-[10px] font-black text-sky-300 uppercase tracking-widest hover:text-sky-200">
        configure
      </Link>
    </div>
  );
};

const VitalTile = ({
  label, value, unit, tint,
}: { label: string; value: string; unit: string; tint: string }) => (
  <div className="rounded-xl border border-white/[0.08] bg-black/30 px-2 py-2 text-center">
    <div className="text-[9px] font-black uppercase tracking-widest text-white/45">{label}</div>
    <div className="mt-0.5 text-base font-black leading-none" style={{ color: tint }}>{value}</div>
    <div className="mt-0.5 text-[9px] text-white/45 truncate">{unit}</div>
  </div>
);

const MiniVital = ({
  label, value, unit, tint, series,
}: { label: string; value: number | undefined; unit: string; tint: string; series?: number[] }) => {
  const display = value === undefined ? '—' : (Number.isInteger(value) ? `${value}` : value.toFixed(1));
  return (
    <div className="rounded-lg bg-black/30 border border-white/[0.05] px-1.5 py-1 text-center">
      <div className="text-[8px] font-black uppercase tracking-widest text-white/40 leading-tight">{label}</div>
      <div className="text-[13px] font-black leading-tight" style={{ color: tint }}>{display}</div>
      {series && series.length >= 2 ? (
        <div className="flex items-center justify-center mt-0.5">
          <Sparkline data={series} width={56} height={14} color={tint} dot fill ariaLabel={`${label} trend`} />
        </div>
      ) : (
        unit && <div className="text-[8px] text-white/35 leading-tight truncate">{unit}</div>
      )}
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
