import { useEffect, useState } from 'react';
import {
  listenAllSosRequests,
  listenAllAssignments,
  listenHospitalAlerts,
  listenHelpers,
  type AnalyticsSosDoc,
  type AnalyticsAssignmentDoc,
  type AnalyticsHospitalAlertDoc,
  type AnalyticsHelperDoc,
} from '../data/analytics';

// ── Output types ─────────────────────────────────────────────────────────────

export type SosTotals = {
  total: number;
  active: number;
  resolved: number;
  expired: number;
  cancelled: number;
  countdown: number;
};

export type ResponseMetrics = {
  avgAcceptanceTimeSec: number;   // createdAt → first assignment acceptedAt
  avgResolutionTimeSec: number;   // createdAt → resolvedAt (resolved SOS only)
  avgArrivalTimeSec: number;      // acceptedAt → arrivedAt (reached assignments)
};

export type SeverityBreakdown = {
  minor: number;
  major: number;
  critical: number;
  minorPct: number;
  majorPct: number;
  criticalPct: number;
};

export type GuardianStat = {
  helperId: string;
  helperName: string;
  accepted: number;
  completed: number;
  avgResponseTimeSec: number;
};

export type DayBucket = {
  label: string;   // e.g. "Mon", "Tue"
  date: string;    // YYYY-MM-DD
  count: number;
  avgResponseSec: number;
};

export type LocationHotspot = {
  lat: number;
  lon: number;
  label: string;
  count: number;
};

export type RecentIncident = {
  id: string;
  status: string;
  severity: string;
  incidentType: string;
  createdAtMs: number;
  escalated: boolean;
};

export type AnalyticsState = {
  loading: boolean;
  sosTotals: SosTotals;
  responseMetrics: ResponseMetrics;
  severityBreakdown: SeverityBreakdown;
  guardianLeaderboard: GuardianStat[];
  activeGuardians: number;
  hospitalAlertsCount: number;
  networkHardware: number;
  networkMobile: number;
  networkEscalated: number;
  last7Days: DayBucket[];
  hotspots: LocationHotspot[];
  recentIncidents: RecentIncident[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ── Core aggregation ─────────────────────────────────────────────────────────

function aggregate(
  sosDocs: AnalyticsSosDoc[],
  assignments: AnalyticsAssignmentDoc[],
  hospitalAlerts: AnalyticsHospitalAlertDoc[],
  helpers: AnalyticsHelperDoc[],
): Omit<AnalyticsState, 'loading'> {

  // ── SOS totals ──────────────────────────────────────────────────────────
  const sosTotals: SosTotals = {
    total: sosDocs.length,
    active: sosDocs.filter(s => s.status === 'active').length,
    resolved: sosDocs.filter(s => s.status === 'resolved').length,
    expired: sosDocs.filter(s => s.status === 'expired').length,
    cancelled: sosDocs.filter(s => s.status === 'cancelled').length,
    countdown: sosDocs.filter(s => s.status === 'countdown').length,
  };

  // ── Response Metrics ────────────────────────────────────────────────────
  // acceptance: compare assignment acceptedAtMs vs parent SOS createdAtMs
  const acceptanceTimes: number[] = [];
  for (const asgn of assignments) {
    const sos = sosDocs.find(s => s.id === asgn.requestId);
    if (sos && sos.createdAtMs > 0 && asgn.acceptedAtMs > 0) {
      const diff = (asgn.acceptedAtMs - sos.createdAtMs) / 1000;
      if (diff > 0 && diff < 3600) acceptanceTimes.push(diff);
    }
  }

  const resolutionTimes: number[] = [];
  for (const sos of sosDocs) {
    if (sos.status === 'resolved' && sos.resolvedAtMs && sos.createdAtMs > 0) {
      const diff = (sos.resolvedAtMs - sos.createdAtMs) / 1000;
      if (diff > 0 && diff < 86400) resolutionTimes.push(diff);
    }
  }

  const arrivalTimes: number[] = [];
  for (const asgn of assignments) {
    if (asgn.status === 'reached' && asgn.arrivedAtMs && asgn.acceptedAtMs > 0) {
      const diff = (asgn.arrivedAtMs - asgn.acceptedAtMs) / 1000;
      if (diff > 0 && diff < 3600) arrivalTimes.push(diff);
    }
  }

  const responseMetrics: ResponseMetrics = {
    avgAcceptanceTimeSec: avg(acceptanceTimes),
    avgResolutionTimeSec: avg(resolutionTimes),
    avgArrivalTimeSec: avg(arrivalTimes),
  };

  // ── Severity ────────────────────────────────────────────────────────────
  const minor = sosDocs.filter(s => s.severity === 'minor').length;
  const major = sosDocs.filter(s => s.severity === 'major').length;
  const critical = sosDocs.filter(s => s.severity === 'critical').length;
  const total = sosDocs.length || 1;
  const severityBreakdown: SeverityBreakdown = {
    minor, major, critical,
    minorPct: Math.round((minor / total) * 100),
    majorPct: Math.round((major / total) * 100),
    criticalPct: Math.round((critical / total) * 100),
  };

  // ── Guardian Leaderboard ────────────────────────────────────────────────
  const helperMap = new Map<string, {
    name: string; accepted: number; completed: number; times: number[];
  }>();

  for (const asgn of assignments) {
    if (!helperMap.has(asgn.helperId)) {
      const h = helpers.find(x => x.id === asgn.helperId);
      helperMap.set(asgn.helperId, {
        name: asgn.helperName || h?.name || asgn.helperId.slice(0, 8),
        accepted: 0, completed: 0, times: [],
      });
    }
    const entry = helperMap.get(asgn.helperId)!;
    entry.accepted++;
    if (asgn.status === 'reached') entry.completed++;

    const sos = sosDocs.find(s => s.id === asgn.requestId);
    if (sos && sos.createdAtMs > 0 && asgn.acceptedAtMs > 0) {
      const diff = (asgn.acceptedAtMs - sos.createdAtMs) / 1000;
      if (diff > 0 && diff < 3600) entry.times.push(diff);
    }
  }

  const guardianLeaderboard: GuardianStat[] = Array.from(helperMap.entries())
    .map(([helperId, e]) => ({
      helperId,
      helperName: e.name,
      accepted: e.accepted,
      completed: e.completed,
      avgResponseTimeSec: avg(e.times),
    }))
    .sort((a, b) => b.accepted - a.accepted)
    .slice(0, 5);

  const activeGuardians = helpers.length;

  // ── Hospital alerts ──────────────────────────────────────────────────────
  const hospitalAlertsCount = hospitalAlerts.length;

  // ── Network ─────────────────────────────────────────────────────────────
  const networkHardware = sosDocs.filter(s => s.source === 'hardware').length;
  const networkMobile = sosDocs.filter(s => s.source === 'mobile' && !s.escalated).length;
  const networkEscalated = sosDocs.filter(s => s.escalated).length;

  // ── Last 7 days bucketed ─────────────────────────────────────────────────
  const now = Date.now();
  const buckets: Map<string, { count: number; times: number[] }> = new Map();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    buckets.set(isoDate(d.getTime()), { count: 0, times: [] });
  }

  for (const sos of sosDocs) {
    if (!sos.createdAtMs) continue;
    const key = isoDate(sos.createdAtMs);
    if (buckets.has(key)) {
      buckets.get(key)!.count++;
      // response time for this SOS
      const firstAsgn = assignments
        .filter(a => a.requestId === sos.id && a.acceptedAtMs > 0)
        .sort((a, b) => a.acceptedAtMs - b.acceptedAtMs)[0];
      if (firstAsgn) {
        const diff = (firstAsgn.acceptedAtMs - sos.createdAtMs) / 1000;
        if (diff > 0 && diff < 3600) buckets.get(key)!.times.push(diff);
      }
    }
  }

  const last7Days: DayBucket[] = Array.from(buckets.entries()).map(([date, val]) => ({
    label: dayLabel(new Date(date + 'T12:00:00')),
    date,
    count: val.count,
    avgResponseSec: avg(val.times),
  }));

  // ── Location hotspots ────────────────────────────────────────────────────
  const locMap = new Map<string, { lat: number; lon: number; count: number }>();
  for (const sos of sosDocs) {
    if (!sos.location?.lat) continue;
    // Round to 3 decimal places (~111m grid)
    const lat = Math.round(sos.location.lat * 1000) / 1000;
    const lon = Math.round(sos.location.lon * 1000) / 1000;
    const key = `${lat},${lon}`;
    if (!locMap.has(key)) locMap.set(key, { lat, lon, count: 0 });
    locMap.get(key)!.count++;
  }

  const hotspots: LocationHotspot[] = Array.from(locMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(h => ({
      ...h,
      label: `${h.lat.toFixed(3)}°N, ${h.lon.toFixed(3)}°E`,
    }));

  // ── Recent incidents ─────────────────────────────────────────────────────
  const recentIncidents: RecentIncident[] = [...sosDocs]
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, 10)
    .map(s => ({
      id: s.id,
      status: s.status,
      severity: s.severity,
      incidentType: s.incidentType ?? 'other',
      createdAtMs: s.createdAtMs,
      escalated: s.escalated ?? false,
    }));

  return {
    sosTotals,
    responseMetrics,
    severityBreakdown,
    guardianLeaderboard,
    activeGuardians,
    hospitalAlertsCount,
    networkHardware,
    networkMobile,
    networkEscalated,
    last7Days,
    hotspots,
    recentIncidents,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const DEFAULT_STATE: Omit<AnalyticsState, 'loading'> = {
  sosTotals: { total: 0, active: 0, resolved: 0, expired: 0, cancelled: 0, countdown: 0 },
  responseMetrics: { avgAcceptanceTimeSec: 0, avgResolutionTimeSec: 0, avgArrivalTimeSec: 0 },
  severityBreakdown: { minor: 0, major: 0, critical: 0, minorPct: 0, majorPct: 0, criticalPct: 0 },
  guardianLeaderboard: [],
  activeGuardians: 0,
  hospitalAlertsCount: 0,
  networkHardware: 0,
  networkMobile: 0,
  networkEscalated: 0,
  last7Days: [],
  hotspots: [],
  recentIncidents: [],
};

export function useAnalytics(): AnalyticsState {
  const [sosDocs, setSosDocs] = useState<AnalyticsSosDoc[]>([]);
  const [assignments, setAssignments] = useState<AnalyticsAssignmentDoc[]>([]);
  const [hospitalAlerts, setHospitalAlerts] = useState<AnalyticsHospitalAlertDoc[]>([]);
  const [helpers, setHelpers] = useState<AnalyticsHelperDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    const markLoaded = () => setLoadedCount(c => {
      const next = c + 1;
      if (next >= 4) setLoading(false);
      return next;
    });

    const u1 = listenAllSosRequests(docs => { setSosDocs(docs); markLoaded(); });
    const u2 = listenAllAssignments(docs => { setAssignments(docs); markLoaded(); });
    const u3 = listenHospitalAlerts(docs => { setHospitalAlerts(docs); markLoaded(); });
    const u4 = listenHelpers(docs => { setHelpers(docs); markLoaded(); });

    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  if (loading && loadedCount < 4) {
    return { loading: true, ...DEFAULT_STATE };
  }

  const computed = aggregate(sosDocs, assignments, hospitalAlerts, helpers);
  return { loading: false, ...computed };
}
