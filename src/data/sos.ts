import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type SosSeverity = 'minor' | 'major' | 'critical';
export type SosStatus = 'countdown' | 'active' | 'resolved' | 'cancelled' | 'expired';

/**
 * High-level category of incident captured from the victim during the
 * countdown intake screen. Used by helpers + hospital alerts to know what
 * kind of trauma to prepare for.
 */
export type IncidentType = 'crash' | 'fall' | 'medical' | 'other';

/** Snapshot shared between victim ↔ responder (ride-hailing style). */
export type ParticipantBrief = {
  name?: string;
  age?: number;
  shortAddress?: string;
  phone?: string;
  trustScore?: number;
  badges?: string[];
};

export type SosRequestDoc = {
  id: string;
  victimId: string;
  status: SosStatus;
  severity: SosSeverity;
  source: 'hardware' | 'mobile';
  countdown: number;
  location: { lat: number; lon: number } | null;
  hasValidLocation?: boolean;
  isApproximate?: boolean;
  radiusKm: number;
  primaryHelperId?: string;
  /** What kind of emergency this is (helps responders prepare). */
  incidentType?: IncidentType;
  /** Free-form one-liner the victim or caller adds in the intake. */
  symptomNotes?: string;
  /** Victim details shared with the assigned helper when they accept. */
  victimBrief?: ParticipantBrief;
  // ── Part 3: helper assignment tracking ────────────────────────────────────
  helpersAssigned?: string[];   // UIDs notified
  helpersAccepted?: string[];   // UIDs who clicked "Help Now"
};

export type SosAssignmentDoc = {
  id: string;
  requestId: string;
  victimId: string;
  helperId: string;
  status: 'accepted' | 'enroute' | 'reached' | 'secondary' | 'cancelled';
  lastLocation?: { lat: number; lon: number };
  distanceMeters?: number;
  distanceTrend?: 'closing' | 'stalled' | 'unknown';
  // ── Uber/Rapido-style live tracking ───────────────────────────────────────
  /** Helper (ambulance/user) current GPS fix — updated every few seconds */
  helperLocation?: { lat: number; lon: number; updatedAt?: number };
  /** Seconds until helper reaches victim (from last Directions API call) */
  etaSeconds?: number;
  /** Encoded Google polyline for the full route, for the receiver to render */
  routeEncoded?: string;
  /** When the route/ETA was last recomputed (ms epoch) */
  lastRouteAt?: number;
  /** Set when helper is within ~30m of victim */
  arrivedAt?: number;
  /** Optional display name written at accept time so victim can see who's coming */
  helperName?: string;
  /** Helper details shared with the victim at accept time. */
  helperBrief?: ParticipantBrief;
};

// ── Part 1: check for existing active SOS before creating a new one ────────
export async function getActiveSosForUser(victimId: string): Promise<SosRequestDoc | null> {
  if (isDemoMode) return null;
  const q = query(
    collection(db, 'sosRequests'),
    where('victimId', '==', victimId),
    limit(50)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const activeDocs = snap.docs.filter(d => (d.data() as any).status === 'active');
  if (activeDocs.length === 0) return null;
  const d = activeDocs[0]!;
  const data: any = d.data();
  return {
    id: d.id,
    victimId: data.victimId,
    status: data.status,
    severity: data.severity,
    source: data.source || 'mobile',
    countdown: data.countdown ?? 0,
    location: data.location ?? null,
    hasValidLocation: data.hasValidLocation ?? false,
    isApproximate: data.isApproximate ?? false,
    radiusKm: data.radiusKm ?? 5,
    primaryHelperId: data.primaryHelperId,
    incidentType: data.incidentType,
    symptomNotes: data.symptomNotes,
    victimBrief: data.victimBrief,
    helpersAssigned: data.helpersAssigned ?? [],
    helpersAccepted: data.helpersAccepted ?? [],
  };
}

/**
 * Cancel ALL active/countdown SOS docs for this user in parallel.
 * Returns the IDs that were cancelled so the caller can flag them in sessionStorage.
 */
export async function cancelAllActiveSosForUser(victimId: string): Promise<string[]> {
  if (isDemoMode) return [];
  const q = query(
    collection(db, 'sosRequests'),
    where('victimId', '==', victimId),
    limit(50)
  );
  const snap = await getDocs(q);
  if (snap.empty) return [];
  const toCancel = snap.docs.filter(d => {
    const s = (d.data() as any).status;
    return s === 'active' || s === 'countdown';
  });
  if (toCancel.length === 0) return [];
  await Promise.all(
    toCancel.map(d =>
      updateDoc(doc(db, 'sosRequests', d.id), { status: 'cancelled', updatedAt: serverTimestamp() })
        .catch(console.warn)
    )
  );
  return toCancel.map(d => d.id);
}


/** Fetch a single SOS request document by its ID. */
export async function getSosRequestDoc(id: string): Promise<SosRequestDoc | null> {
  if (isDemoMode) return null;
  const snap = await getDocs(query(collection(db, 'sosRequests'), where('__name__', '==', id)));
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  const data: any = d.data();
  return {
    id: d.id,
    victimId: data.victimId,
    status: data.status,
    severity: data.severity,
    source: data.source || 'mobile',
    countdown: data.countdown ?? 0,
    location: data.location ?? null,
    hasValidLocation: data.hasValidLocation ?? false,
    isApproximate: data.isApproximate ?? false,
    radiusKm: data.radiusKm ?? 5,
    primaryHelperId: data.primaryHelperId,
    incidentType: data.incidentType,
    symptomNotes: data.symptomNotes,
    victimBrief: data.victimBrief,
    helpersAssigned: data.helpersAssigned ?? [],
    helpersAccepted: data.helpersAccepted ?? [],
  };
}

// ── createSosRequest: idempotent via pre-check ────────────────────────────
export async function createSosRequest(input: Omit<SosRequestDoc, 'id' | 'primaryHelperId'>) {
  if (isDemoMode) return { ...input, id: `demo-${Date.now()}` } as SosRequestDoc;

  // ── Part 1: duplicate-prevention ─────────────────────────────────────────
  const existing = await getActiveSosForUser(input.victimId);
  if (existing) {
    console.warn('[SOS] ⚠ Existing active SOS found — cancelling old one.');
    try {
      await updateDoc(doc(db, 'sosRequests', existing.id), { status: 'cancelled', updatedAt: serverTimestamp() });
    } catch (e) {
      console.error('Failed to cancel old SOS', e);
    }
  }

  const payload: Record<string, unknown> = {
    victimId: input.victimId,
    status: input.status,
    severity: input.severity,
    source: input.source || 'mobile',
    countdown: input.countdown ?? 0,
    location: input.location,
    hasValidLocation: input.hasValidLocation ?? false,
    isApproximate: input.isApproximate ?? false,
    radiusKm: input.radiusKm,
    helpersAssigned: [],
    helpersAccepted: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.incidentType) payload.incidentType = input.incidentType;
  if (input.symptomNotes) payload.symptomNotes = input.symptomNotes;
  if (input.victimBrief) payload.victimBrief = input.victimBrief;

  const ref = await addDoc(collection(db, 'sosRequests'), payload);
  return { ...input, id: ref.id } as SosRequestDoc;
}

// ── updateSosRequest: generic patch ──────────────────────────────────────
export async function updateSosRequest(id: string, patch: Record<string, unknown>) {
  if (isDemoMode) return;
  await updateDoc(doc(db, 'sosRequests', id), { ...patch, updatedAt: serverTimestamp() });
}

// ── listenCurrentSosRequest ────────────────────────────────────────────────
export function listenCurrentSosRequest(victimId: string, cb: (item: SosRequestDoc | null) => void) {
  if (isDemoMode) { cb(null); return () => {}; }

  console.log('[SOS Listener] Starting for victimId:', victimId);

  const q = query(
    collection(db, 'sosRequests'),
    where('victimId', '==', victimId),
    limit(50)
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) { cb(null); return; }
      const active = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((d) => d.status === 'countdown' || d.status === 'active')
        .sort((a, b) => {
          const ta = a.createdAt?.seconds ?? (typeof a.createdAt === 'number' ? a.createdAt / 1000 : 0);
          const tb = b.createdAt?.seconds ?? (typeof b.createdAt === 'number' ? b.createdAt / 1000 : 0);
          return tb - ta;
        });

      if (!active.length) { cb(null); return; }
      const data = active[0];
      console.log('[SOS Listener] Active SOS found:', data.id, data.status);
      cb({
        id: data.id,
        victimId: data.victimId,
        status: data.status,
        severity: data.severity,
        source: data.source,
        countdown: data.countdown,
        location: data.location,
        hasValidLocation: data.hasValidLocation,
        isApproximate: data.isApproximate ?? false,
        radiusKm: data.radiusKm ?? 5,
        primaryHelperId: data.primaryHelperId,
        incidentType: data.incidentType,
        symptomNotes: data.symptomNotes,
        victimBrief: data.victimBrief,
        helpersAssigned: data.helpersAssigned ?? [],
        helpersAccepted: data.helpersAccepted ?? [],
      });
    },
    (err) => {
      console.error('[SOS Listener] onSnapshot error:', err.code, err.message);
      cb(null);
    }
  );
}

// ── listenActiveSosRequests ────────────────────────────────────────────────
// Single where() clause → no composite index needed.
// Part 5: frontend filter adds 30-min expiry guard.
// Part 7: _createdMs exposed for staleness check.
export function listenActiveSosRequests(cb: (items: SosRequestDoc[]) => void) {
  if (isDemoMode) {
    cb([]);
    return () => {};
  }

  const q = query(
    collection(db, 'sosRequests'),
    where('status', '==', 'active')
  );

  return onSnapshot(
    q,
    (snap) => {
      console.log(`[HELPER RAW DOCS]: ${snap.docs.length}`);
      const now = Date.now();
      const THIRTY_MIN = 30 * 60 * 1000;

      const results = snap.docs
        .map((d) => {
          const data: any = d.data();
          const createdMs: number = data.createdAt?.seconds
            ? data.createdAt.seconds * 1000
            : (data.createdAt ?? 0);
          return {
            id: d.id,
            victimId: data.victimId,
            status: data.status as SosStatus,
            severity: data.severity as SosSeverity,
            source: (data.source || 'mobile') as 'hardware' | 'mobile',
            countdown: data.countdown ?? 0,
            location: data.location ?? null,
            hasValidLocation: data.hasValidLocation ?? false,
            isApproximate: data.isApproximate ?? false,
            radiusKm: data.radiusKm ?? 5,
            primaryHelperId: data.primaryHelperId,
            incidentType: data.incidentType as IncidentType | undefined,
            symptomNotes: data.symptomNotes,
            victimBrief: data.victimBrief,
            helpersAssigned: data.helpersAssigned ?? [],
            helpersAccepted: data.helpersAccepted ?? [],
            _createdMs: createdMs,
          } satisfies SosRequestDoc & { _createdMs: number };
        })
        // ── Part 5 / Part 7: discard docs older than 30 minutes ───────────
        .filter((r) => !r._createdMs || now - r._createdMs < THIRTY_MIN)
        .sort((a, b) => b._createdMs - a._createdMs);

      cb(results);
    },
    (err) => {
      console.error('[Active SOS Listener] onSnapshot error:', err.code, err.message);
      cb([]);
    }
  );
}

// ── listenSosRequestDoc ─────────────────────────────────────────────────────
/** Single-doc listener for the active SOS (helpersAssigned, primaryHelperId, etc.). */
export function listenSosRequestDoc(requestId: string, cb: (item: SosRequestDoc | null) => void) {
  if (isDemoMode) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'sosRequests', requestId),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const data: any = snap.data();
      cb({
        id: snap.id,
        victimId: data.victimId,
        status: data.status,
        severity: data.severity,
        source: (data.source || 'mobile') as 'hardware' | 'mobile',
        countdown: data.countdown ?? 0,
        location: data.location ?? null,
        hasValidLocation: data.hasValidLocation ?? false,
        isApproximate: data.isApproximate ?? false,
        radiusKm: data.radiusKm ?? 5,
        primaryHelperId: data.primaryHelperId,
        incidentType: data.incidentType,
        symptomNotes: data.symptomNotes,
        victimBrief: data.victimBrief,
        helpersAssigned: data.helpersAssigned ?? [],
        helpersAccepted: data.helpersAccepted ?? [],
      });
    },
    (err) => {
      console.error('[SOS doc Listener] onSnapshot error:', err.code, err.message);
      cb(null);
    }
  );
}

// ── listenAssignmentsForRequest ────────────────────────────────────────────
export function listenAssignmentsForRequest(
  requestId: string,
  cb: (items: SosAssignmentDoc[]) => void,
  _victimId?: string
) {
  if (isDemoMode) {
    cb([]);
    return () => {};
  }

  console.log('[Assignments Listener] requestId:', requestId);

  // Always scope by requestId so the victim does not watch unrelated assignment docs
  // (broader queries stress the client and can trigger Firestore watch edge cases).
  const q = query(collection(db, 'sosAssignments'), where('requestId', '==', requestId));

  return onSnapshot(
    q,
    (snap) => {
      console.log('[Assignments Listener] docs received:', snap.docs.length);
      const results = snap.docs
        .map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            requestId: data.requestId,
            victimId: data.victimId,
            helperId: data.helperId,
            status: data.status,
            lastLocation: data.lastLocation,
            distanceMeters: data.distanceMeters,
            distanceTrend: data.distanceTrend,
            helperLocation: data.helperLocation,
            etaSeconds: data.etaSeconds,
            routeEncoded: data.routeEncoded,
            lastRouteAt: data.lastRouteAt,
            arrivedAt: data.arrivedAt,
            helperName: data.helperName,
            helperBrief: data.helperBrief,
            _acceptedMs: data.acceptedAt?.seconds
              ? data.acceptedAt.seconds * 1000
              : (data.acceptedAt ?? 0),
          } satisfies SosAssignmentDoc & { _acceptedMs: number };
        })
        .sort((a, b) => a._acceptedMs - b._acceptedMs);
      cb(results);
    },
    (err) => {
      console.error('[Assignments Listener] onSnapshot error:', err.code, err.message);
      cb([]);
    }
  );
}

// ── listenMyAssignment ─────────────────────────────────────────────────────
// Returns the single assignment doc for (helperId, requestId). Used by the
// helper-side map to know their assignment id for writing location updates.
export function listenMyAssignment(
  requestId: string,
  helperId: string,
  cb: (assignment: SosAssignmentDoc | null) => void
) {
  if (isDemoMode) { cb(null); return () => {}; }
  const q = query(
    collection(db, 'sosAssignments'),
    where('requestId', '==', requestId),
    where('helperId', '==', helperId),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) { cb(null); return; }
      const d = snap.docs[0];
      if (!d) { cb(null); return; }
      const data: any = d.data();
      cb({
        id: d.id,
        requestId: data.requestId,
        victimId: data.victimId,
        helperId: data.helperId,
        status: data.status,
        lastLocation: data.lastLocation,
        distanceMeters: data.distanceMeters,
        distanceTrend: data.distanceTrend,
        helperLocation: data.helperLocation,
        etaSeconds: data.etaSeconds,
        routeEncoded: data.routeEncoded,
        lastRouteAt: data.lastRouteAt,
        arrivedAt: data.arrivedAt,
        helperName: data.helperName,
        helperBrief: data.helperBrief,
      });
    },
    (err) => {
      console.error('[My Assignment Listener] error:', err.code, err.message);
      cb(null);
    }
  );
}

// ── acceptSosRequest ───────────────────────────────────────────────────────
// Only one helper may accept per SOS (transaction). Writes helperBrief on assignment.
export async function acceptSosRequest(input: {
  requestId: string;
  victimId: string;
  helperId: string;
  helperName?: string;
  helperBrief?: ParticipantBrief;
  helperLocation?: { lat: number; lon: number };
}) {
  if (isDemoMode) return `demo-${Date.now()}`;

  const assignRef = doc(collection(db, 'sosAssignments'));

  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'sosRequests', input.requestId);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error('SOS_NOT_FOUND');
    const d: any = reqSnap.data();
    // Allow multiple helpers to accept
    tx.set(assignRef, {
      requestId: input.requestId,
      victimId: input.victimId,
      helperId: input.helperId,
      helperName: input.helperName ?? '',
      helperBrief: input.helperBrief ?? null,
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      distanceTrend: 'unknown',
      ...(input.helperLocation
        ? { helperLocation: { ...input.helperLocation, updatedAt: Date.now() } }
        : {}),
    });

    const patch: Record<string, unknown> = {
      helpersAccepted: arrayUnion(input.helperId),
      updatedAt: serverTimestamp(),
    };
    if (!d.primaryHelperId) patch.primaryHelperId = input.helperId;
    tx.update(reqRef, patch);
  });

  return assignRef.id;
}

// ── removeHelperFromSos ─────────────────────────────────────────────────────
// Part 4: called when helper is now >5 km from victim's updated location.
export async function removeHelperFromSos(requestId: string, helperId: string) {
  if (isDemoMode) return;
  await updateDoc(doc(db, 'sosRequests', requestId), {
    helpersAccepted: arrayRemove(helperId),
    updatedAt: serverTimestamp(),
  });
}

// ── updateAssignment ──────────────────────────────────────────────────────
export async function updateAssignment(id: string, patch: Partial<SosAssignmentDoc>) {
  if (isDemoMode) return;
  const { id: _id, ...rest } = patch as any;
  await updateDoc(doc(db, 'sosAssignments', id), { ...rest, updatedAt: serverTimestamp() });
}

// ── tryAssignPrimaryHelper ────────────────────────────────────────────────
export async function tryAssignPrimaryHelper(requestId: string, helperId: string) {
  if (isDemoMode) return;
  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'sosRequests', requestId);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) return;
    const data: any = reqSnap.data();
    if (data.primaryHelperId) return;
    tx.update(reqRef, { primaryHelperId: helperId, updatedAt: serverTimestamp() });
  });
}

// ── markSosExpired ────────────────────────────────────────────────────────
// Part 5: call this from a Cloud Function scheduler or admin script.
// Frontend uses the 30-min listener filter instead.
export async function markSosExpired(id: string) {
  if (isDemoMode) return;
  await updateDoc(doc(db, 'sosRequests', id), {
    status: 'expired',
    updatedAt: serverTimestamp(),
  });
}
