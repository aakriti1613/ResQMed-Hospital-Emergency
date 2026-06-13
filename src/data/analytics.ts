import {
  collection,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

// ── Raw document shapes (analytics reads) ───────────────────────────────────

export type AnalyticsSosDoc = {
  id: string;
  status: string;         // 'countdown' | 'active' | 'resolved' | 'cancelled' | 'expired'
  severity: string;       // 'minor' | 'major' | 'critical'
  source: string;         // 'hardware' | 'mobile'
  incidentType?: string;
  location?: { lat: number; lon: number } | null;
  escalated?: boolean;
  createdAtMs: number;    // normalised epoch ms
  resolvedAtMs?: number;
  hospitalNotifiedAtMs?: number;
};

export type AnalyticsAssignmentDoc = {
  id: string;
  requestId: string;
  helperId: string;
  helperName?: string;
  status: string;         // 'accepted' | 'enroute' | 'reached' | 'secondary' | 'cancelled'
  acceptedAtMs: number;
  arrivedAtMs?: number;
};

export type AnalyticsHospitalAlertDoc = {
  id: string;
  requestId: string;
  hospitalId?: string;
  createdAtMs: number;
};

export type AnalyticsHelperDoc = {
  id: string;
  name?: string;
  trustScore?: number;
};

// ── Helper: safely convert Firestore Timestamp or epoch number ───────────────
function toMs(raw: any): number {
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw.toMillis === 'function') return raw.toMillis();
  if (raw.seconds) return raw.seconds * 1000;
  return 0;
}

// ── listenAllSosRequests ────────────────────────────────────────────────────
/** Listens to ALL sosRequests (all statuses) for analytics. */
export function listenAllSosRequests(cb: (docs: AnalyticsSosDoc[]) => void) {
  if (isDemoMode) { cb([]); return () => {}; }

  return onSnapshot(
    query(collection(db, 'sosRequests')),
    (snap) => {
      const results = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          status: data.status ?? 'unknown',
          severity: data.severity ?? 'minor',
          source: data.source ?? 'mobile',
          incidentType: data.incidentType,
          location: data.location ?? null,
          escalated: data.escalated ?? false,
          createdAtMs: toMs(data.createdAt),
          resolvedAtMs: toMs(data.resolvedAt) || undefined,
          hospitalNotifiedAtMs: toMs(data.hospitalNotifiedAt) || undefined,
        } satisfies AnalyticsSosDoc;
      });
      cb(results);
    },
    (err) => {
      console.error('[Analytics SOS Listener] error:', err.message);
      cb([]);
    }
  );
}

// ── listenAllAssignments ────────────────────────────────────────────────────
/** Listens to ALL sosAssignments for guardian analytics. */
export function listenAllAssignments(cb: (docs: AnalyticsAssignmentDoc[]) => void) {
  if (isDemoMode) { cb([]); return () => {}; }

  return onSnapshot(
    query(collection(db, 'sosAssignments')),
    (snap) => {
      const results = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          requestId: data.requestId ?? '',
          helperId: data.helperId ?? '',
          helperName: data.helperName,
          status: data.status ?? 'accepted',
          acceptedAtMs: toMs(data.acceptedAt),
          arrivedAtMs: toMs(data.arrivedAt) || undefined,
        } satisfies AnalyticsAssignmentDoc;
      });
      cb(results);
    },
    (err) => {
      console.error('[Analytics Assignments Listener] error:', err.message);
      cb([]);
    }
  );
}

// ── listenHospitalAlerts ───────────────────────────────────────────────────
export function listenHospitalAlerts(cb: (docs: AnalyticsHospitalAlertDoc[]) => void) {
  if (isDemoMode) { cb([]); return () => {}; }

  return onSnapshot(
    query(collection(db, 'hospitalAlerts')),
    (snap) => {
      const results = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          requestId: data.requestId ?? '',
          hospitalId: data.hospitalId,
          createdAtMs: toMs(data.createdAt),
        } satisfies AnalyticsHospitalAlertDoc;
      });
      cb(results);
    },
    (err) => {
      console.error('[Analytics Hospital Listener] error:', err.message);
      cb([]);
    }
  );
}

// ── listenHelpers ──────────────────────────────────────────────────────────
export function listenHelpers(cb: (docs: AnalyticsHelperDoc[]) => void) {
  if (isDemoMode) { cb([]); return () => {}; }

  return onSnapshot(
    query(collection(db, 'helpers')),
    (snap) => {
      const results = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          trustScore: data.trustScore,
        } satisfies AnalyticsHelperDoc;
      });
      cb(results);
    },
    (err) => {
      console.error('[Analytics Helpers Listener] error:', err.message);
      cb([]);
    }
  );
}
