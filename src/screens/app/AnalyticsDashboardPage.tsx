import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Siren,
  Users,
  Hospital,
  Clock,
  TrendingUp,
  AlertTriangle,
  Shield,
  MapPin,
  Trophy,
  Wifi,
  Cpu,
  Radio,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../../hooks/useAnalytics';

// ── Utility helpers ──────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  if (sec <= 0) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.round(sec / 60)}m ${Math.round(sec % 60)}s`;
}

function timeAgo(ms: number): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  minor:    { bg: 'bg-emerald-500/15',  text: 'text-emerald-300',  border: 'border-emerald-500/30' },
  major:    { bg: 'bg-amber-500/15',    text: 'text-amber-300',    border: 'border-amber-500/30'   },
  critical: { bg: 'bg-red-500/15',      text: 'text-red-400',      border: 'border-red-500/30'     },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: 'bg-blue-500/15',    text: 'text-blue-300'    },
  resolved:  { bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  expired:   { bg: 'bg-white/10',       text: 'text-white/50'    },
  cancelled: { bg: 'bg-white/10',       text: 'text-white/50'    },
  countdown: { bg: 'bg-amber-500/15',   text: 'text-amber-300'   },
};

// ── Sub-components ───────────────────────────────────────────────────────────

const SummaryCard = ({
  label, value, sub, icon, gradient, glow,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; gradient: string; glow: string;
}) => (
  <div
    className="relative rounded-3xl border border-white/[0.07] bg-[#13141a] p-4 overflow-hidden"
    style={{ boxShadow: `0 4px 24px ${glow}` }}
  >
    <div
      className="absolute -top-8 -right-8 h-28 w-28 rounded-full opacity-20 blur-2xl pointer-events-none"
      style={{ background: gradient }}
    />
    <div className="relative flex items-start justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">{label}</div>
        <div className="text-2xl font-black text-white">{value}</div>
        {sub && <div className="text-[11px] text-white/40 font-semibold mt-0.5">{sub}</div>}
      </div>
      <div
        className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: gradient }}
      >
        {icon}
      </div>
    </div>
  </div>
);

// Pure SVG donut chart
const DonutChart = ({
  minor, major, critical, total,
}: { minor: number; major: number; critical: number; total: number }) => {
  const r = 52;
  const cx = 70; const cy = 70;
  const circ = 2 * Math.PI * r;

  const minorPct = total > 0 ? minor / total : 0;
  const majorPct = total > 0 ? major / total : 0;
  const critPct  = total > 0 ? critical / total : 0;

  const minorDash = minorPct * circ;
  const majorDash = majorPct * circ;
  const critDash  = critPct * circ;

  const gap = 2;
  let offset = 0;

  const segments = [
    { dash: critDash,  color: '#ef4444', label: 'Critical', count: critical },
    { dash: majorDash, color: '#f59e0b', label: 'Major',    count: major },
    { dash: minorDash, color: '#10b981', label: 'Minor',    count: minor },
  ];

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff08" strokeWidth={16} />
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff10" strokeWidth={16} />
        ) : (
          segments.map((seg, i) => {
            const dashArray = `${Math.max(0, seg.dash - gap)} ${circ - Math.max(0, seg.dash - gap)}`;
            const dashOffset = circ - offset;
            offset += seg.dash;
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={16}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
              />
            );
          })
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize={20} fontWeight={900}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9} fontWeight={700}>TOTAL SOS</text>
      </svg>
      <div className="flex flex-col gap-2 flex-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
              <span className="text-xs font-bold text-white/70">{seg.label}</span>
            </div>
            <span className="text-xs font-black text-white">{seg.count}</span>
          </div>
        ))}
        <div className="mt-1 pt-2 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] text-white/35 font-bold">TOTAL</span>
          <span className="text-xs font-black text-white">{total}</span>
        </div>
      </div>
    </div>
  );
};

// Pure SVG 7-day bar chart
const BarChart7Day = ({
  days, valueKey, label, color,
}: { days: Array<{ label: string; count: number; avgResponseSec: number }>; valueKey: 'count' | 'avgResponseSec'; label: string; color: string }) => {
  const values = days.map(d => valueKey === 'count' ? d.count : d.avgResponseSec);
  const maxVal = Math.max(...values, 1);
  const barWidth = 28;
  const gap = 10;
  const chartH = 80;
  const totalW = days.length * (barWidth + gap) - gap;

  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-3">{label}</div>
      <svg width="100%" viewBox={`0 0 ${totalW + 4} ${chartH + 24}`} className="overflow-visible">
        {days.map((d, i) => {
          const barH = Math.max(4, (values[i]! / maxVal) * chartH);
          const x = i * (barWidth + gap);
          const y = chartH - barH;
          const val = values[i] ?? 0;
          return (
            <g key={`${d.label}-${i}`}>
              {/* Background bar */}
              <rect x={x} y={0} width={barWidth} height={chartH} rx={6} fill="rgba(255,255,255,0.04)" />
              {/* Value bar */}
              <rect x={x} y={y} width={barWidth} height={barH} rx={6} fill={color} opacity={0.85} />
              {/* Day label */}
              <text x={x + barWidth / 2} y={chartH + 16} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} fontWeight={700}>{d.label}</text>
              {/* Value on top if > 0 */}
              {val > 0 && (
                <text x={x + barWidth / 2} y={y - 3} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={8} fontWeight={900}>
                  {valueKey === 'avgResponseSec' && val > 0 ? `${Math.round(val)}s` : val}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Metric row
const MetricRow = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-white/40 shrink-0">{icon}</span>
      <span className="text-xs font-semibold text-white/60 truncate">{label}</span>
    </div>
    <span className="text-sm font-black text-white shrink-0">{value}</span>
  </div>
);

// Section wrapper
const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-3xl border border-white/[0.07] bg-[#13141a] p-5">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-white/50">{icon}</span>
      <h2 className="text-sm font-black text-white uppercase tracking-wide">{title}</h2>
    </div>
    {children}
  </div>
);

// ── Main Page ────────────────────────────────────────────────────────────────

export const AnalyticsDashboardPage = () => {
  const nav = useNavigate();
  const a = useAnalytics();
  const { t } = useTranslation();

  return (
    <div className="min-h-full bg-[#0a0b0f] max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0b0f]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-white/60 hover:bg-white/[0.08] transition shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-white">{t('analytics.title')}</h1>
          <p className="text-[10px] text-white/35 font-semibold">{t('analytics.live')}</p>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Live</span>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">

        {/* Loading state */}
        {a.loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
            <p className="text-sm font-bold text-white/40">Loading analytics…</p>
          </div>
        )}

        {!a.loading && (
          <>
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard
                label={t('analytics.totalSos')}
                value={a.sosTotals.total}
                sub={`${a.sosTotals.active} ${t('analytics.activeNow')}`}
                icon={<Siren className="h-5 w-5 text-red-300" />}
                gradient="linear-gradient(135deg,#ef4444,#b91c1c)"
                glow="rgba(220,38,38,0.15)"
              />
              <SummaryCard
                label={t('analytics.criticalCases')}
                value={a.severityBreakdown.critical}
                sub={`${a.severityBreakdown.criticalPct}% ${t('analytics.ofAllSos')}`}
                icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}
                gradient="linear-gradient(135deg,#f59e0b,#b45309)"
                glow="rgba(245,158,11,0.15)"
              />
              <SummaryCard
                label={t('analytics.activeGuardians')}
                value={a.activeGuardians}
                sub={t('analytics.inNetwork')}
                icon={<Shield className="h-5 w-5 text-emerald-300" />}
                gradient="linear-gradient(135deg,#10b981,#047857)"
                glow="rgba(16,185,129,0.15)"
              />
              <SummaryCard
                label={t('analytics.hospitalAlerts')}
                value={a.hospitalAlertsCount}
                icon={<Hospital className="h-5 w-5 text-white" />}
                gradient="linear-gradient(135deg,#06b6d4,#0e7490)"
                glow="rgba(6,182,212,0.12)"
              />
            </div>

            {/* ── Severity Distribution ── */}
            <Section title={t('analytics.severityDist')} icon={<Activity className="h-4 w-4" />}>
              <DonutChart
                minor={a.severityBreakdown.minor}
                major={a.severityBreakdown.major}
                critical={a.severityBreakdown.critical}
                total={a.sosTotals.total}
              />
              {/* Breakdown pills */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(['minor', 'major', 'critical'] as const).map((s) => {
                  const c = SEVERITY_COLORS[s]!;
                  const count = a.severityBreakdown[s];
                  const pct = a.severityBreakdown[`${s}Pct`];
                  return (
                    <div key={s} className={`rounded-2xl border ${c.border} ${c.bg} py-2 px-3 text-center`}>
                      <div className={`text-lg font-black ${c.text}`}>{count}</div>
                      <div className={`text-[9px] font-black uppercase tracking-widest ${c.text} opacity-70`}>{s}</div>
                      <div className="text-[10px] font-bold text-white/40">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* ── SOS Trend (7-day) ── */}
            <Section title={t('analytics.sosTrend')} icon={<TrendingUp className="h-4 w-4" />}>
              {a.last7Days.length > 0 ? (
                <BarChart7Day
                  days={a.last7Days}
                  valueKey="count"
                  label="Daily SOS count"
                  color="url(#redGrad)"
                />
              ) : (
                <p className="text-xs text-white/30 text-center py-6">{t('analytics.noData')}</p>
              )}
              {/* Inject gradient def */}
              <svg width="0" height="0" className="absolute">
                <defs>
                  <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#b91c1c" />
                  </linearGradient>
                  <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
              </svg>
            </Section>

            {/* ── Response Time Trend ── */}
            <Section title={t('analytics.avgResponseTrend')} icon={<Clock className="h-4 w-4" />}>
              {a.last7Days.some(d => d.avgResponseSec > 0) ? (
                <BarChart7Day
                  days={a.last7Days}
                  valueKey="avgResponseSec"
                  label="Seconds to first helper acceptance"
                  color="url(#skyGrad)"
                />
              ) : (
                <p className="text-xs text-white/30 text-center py-6">{t('analytics.noData')}</p>
              )}
            </Section>

            {/* ── Response Metrics ── */}
            <Section title={t('analytics.responseMetrics')} icon={<Clock className="h-4 w-4" />}>
              <MetricRow
                label={t('analytics.avgAcceptance')}
                value={fmtTime(a.responseMetrics.avgAcceptanceTimeSec)}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
              <MetricRow
                label={t('analytics.avgArrival')}
                value={fmtTime(a.responseMetrics.avgArrivalTimeSec)}
                icon={<Activity className="h-3.5 w-3.5" />}
              />
              <MetricRow
                label={t('analytics.avgResolution')}
                value={fmtTime(a.responseMetrics.avgResolutionTimeSec)}
                icon={<TrendingUp className="h-3.5 w-3.5" />}
              />
              <MetricRow
                label={t('analytics.hospitalAlerts')}
                value={String(a.hospitalAlertsCount)}
                icon={<Hospital className="h-3.5 w-3.5" />}
              />
            </Section>

            {/* ── Network Analytics ── */}
            <Section title={t('analytics.networkAnalytics')} icon={<Wifi className="h-4 w-4" />}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t('analytics.normalMobile'), value: a.networkMobile, icon: <Wifi className="h-4 w-4 text-sky-300" />, color: 'border-sky-500/25 bg-sky-500/[0.08]', text: 'text-sky-300' },
                  { label: t('analytics.hardwareSos'), value: a.networkHardware, icon: <Cpu className="h-4 w-4 text-violet-300" />, color: 'border-violet-500/25 bg-violet-500/[0.08]', text: 'text-violet-300' },
                  { label: t('analytics.escalatedSos'), value: a.networkEscalated, icon: <Radio className="h-4 w-4 text-amber-300" />, color: 'border-amber-500/25 bg-amber-500/[0.08]', text: 'text-amber-300' },
                ].map(item => (
                  <div key={item.label} className={`rounded-2xl border ${item.color} p-3 text-center`}>
                    <div className="flex justify-center mb-1.5">{item.icon}</div>
                    <div className={`text-xl font-black ${item.text}`}>{item.value}</div>
                    <div className="text-[9px] font-black text-white/35 uppercase tracking-wide leading-tight mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Guardian Leaderboard ── */}
            <Section title={t('analytics.guardianLeaderboard')} icon={<Trophy className="h-4 w-4" />}>
              {a.guardianLeaderboard.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-6">{t('analytics.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-[24px_1fr_48px_56px_64px] gap-2 pb-2 border-b border-white/[0.06]">
                    <span className="text-[9px] font-black text-white/30 uppercase">{t('analytics.rank')}</span>
                    <span className="text-[9px] font-black text-white/30 uppercase">{t('analytics.guardian')}</span>
                    <span className="text-[9px] font-black text-white/30 uppercase text-center">{t('analytics.accept')}</span>
                    <span className="text-[9px] font-black text-white/30 uppercase text-center">{t('analytics.done')}</span>
                    <span className="text-[9px] font-black text-white/30 uppercase text-right">{t('analytics.avgTime')}</span>
                  </div>
                  {a.guardianLeaderboard.map((g, i) => (
                    <div key={g.helperId} className="grid grid-cols-[24px_1fr_48px_56px_64px] gap-2 items-center py-1">
                      <span className={`text-xs font-black ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-white/60' : i === 2 ? 'text-amber-700' : 'text-white/30'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <span className="text-xs font-bold text-white truncate">{g.helperName}</span>
                      <span className="text-xs font-black text-emerald-300 text-center">{g.accepted}</span>
                      <span className="text-xs font-black text-sky-300 text-center">{g.completed}</span>
                      <span className="text-xs font-bold text-white/60 text-right">{fmtTime(g.avgResponseTimeSec)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Geographic Hotspots ── */}
            <Section title={t('analytics.hotspots')} icon={<MapPin className="h-4 w-4" />}>
              {a.hotspots.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-6">{t('analytics.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {a.hotspots.map((h, i) => (
                    <div key={`${h.lat},${h.lon}`} className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0">
                      <div className="h-7 w-7 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-red-400">#{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white/80 font-mono truncate">{h.label}</div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 shrink-0">
                        <span className="text-[10px] font-black text-red-400">{h.count} SOS</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Recent Incidents ── */}
            <Section title={t('analytics.recentIncidents')} icon={<Activity className="h-4 w-4" />}>
              {a.recentIncidents.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-6">{t('analytics.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_60px_64px_56px] gap-2 pb-2 border-b border-white/[0.06]">
                    <span className="text-[9px] font-black text-white/30 uppercase">{t('analytics.when')}</span>
                    <span className="text-[9px] font-black text-white/30 uppercase">{t('analytics.severity')}</span>
                    <span className="text-[9px] font-black text-white/30 uppercase">{t('analytics.status')}</span>
                    <span className="text-[9px] font-black text-white/30 uppercase">{t('analytics.type')}</span>
                  </div>
                  {a.recentIncidents.map((inc) => {
                    const sev = SEVERITY_COLORS[inc.severity] ?? SEVERITY_COLORS.minor!;
                    const st = STATUS_COLORS[inc.status] ?? STATUS_COLORS.cancelled!;
                    return (
                      <div key={inc.id} className="grid grid-cols-[1fr_60px_64px_56px] gap-2 items-center py-1">
                        <span className="text-[11px] font-bold text-white/50">{timeAgo(inc.createdAtMs)}</span>
                        <span className={`text-[10px] font-black rounded-lg px-1.5 py-0.5 text-center ${sev.bg} ${sev.text}`}>
                          {inc.severity}
                        </span>
                        <span className={`text-[10px] font-black rounded-lg px-1.5 py-0.5 text-center ${st.bg} ${st.text}`}>
                          {inc.status}
                        </span>
                        <span className="text-[10px] font-bold text-white/40 capitalize truncate">{inc.incidentType}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* ── SOS Status Breakdown ── */}
            <Section title={t('analytics.statusBreakdown')} icon={<Users className="h-4 w-4" />}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t('sos.active'),    val: a.sosTotals.active,    color: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
                  { label: t('sos.resolved'),  val: a.sosTotals.resolved,  color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                  { label: t('sos.cancelled'), val: a.sosTotals.cancelled, color: 'text-white/40',    bg: 'bg-white/5',        border: 'border-white/10'        },
                  { label: t('sos.countdown'), val: a.sosTotals.countdown, color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
                  { label: t('sos.expired'),   val: a.sosTotals.expired,   color: 'text-white/30',    bg: 'bg-white/5',        border: 'border-white/10'        },
                  { label: 'Total',     val: a.sosTotals.total,     color: 'text-white',       bg: 'bg-white/5',        border: 'border-white/15'        },
                ].map(item => (
                  <div key={item.label} className={`rounded-2xl border ${item.border} ${item.bg} p-3 text-center`}>
                    <div className={`text-xl font-black ${item.color}`}>{item.val}</div>
                    <div className="text-[9px] font-black text-white/35 uppercase tracking-wide mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Footer note */}
            <div className="text-center text-[10px] text-white/20 font-semibold pb-2">
              All data sourced live from Firestore · Updates in real-time
            </div>
          </>
        )}
      </div>
    </div>
  );
};
