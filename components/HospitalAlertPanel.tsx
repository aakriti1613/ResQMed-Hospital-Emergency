import { useEffect, useMemo, useState } from 'react';
import {
  Hospital, Search, MapPin, Star, ShieldCheck, Send, X, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SHOWCASE_HOSPITAL,
  findNearbyHospitals,
  formatDistanceKm,
  type HospitalInfo,
} from '../data/hospitals';
import {
  notifyHospital,
  cancelHospitalAlert,
  listenMyAlertForRequest,
  type HospitalAlert,
} from '../data/hospitalAlerts';
import type { SosSeverity } from '../data/sos';

type Props = {
  requestId: string;
  victimId: string;
  helperId: string;
  helperName?: string;
  victimLocation: { lat: number; lon: number };
  severity?: SosSeverity;
};

/**
 * Panel rendered inside an accepted SOS card.
 * Shows hospitals around the **incident location** (not helper location, so the
 * list reflects where the patient will actually be taken). The helper picks one
 * to notify — that creates a `hospitalAlerts/*` doc the hospital portal reads.
 */
export const HospitalAlertPanel = ({
  requestId, victimId, helperId, helperName, victimLocation, severity,
}: Props) => {
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<HospitalInfo | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<HospitalAlert | null>(null);

  // Fetch nearby hospitals AROUND the incident location.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await findNearbyHospitals(victimLocation, 10);
        if (cancelled) return;
        const showcase: HospitalInfo = { ...SHOWCASE_HOSPITAL, distanceKm: 0.4 };
        const seen = new Set<string>();
        const merged = [showcase, ...list].filter((h) => {
          if (seen.has(h.id)) return false;
          seen.add(h.id);
          return true;
        });
        setHospitals(merged);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load hospitals.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [victimLocation.lat, victimLocation.lon]);

  // Subscribe to my own alert (if I've already notified one for this SOS).
  useEffect(() => {
    if (!helperId || !requestId) return;
    return listenMyAlertForRequest(requestId, helperId, setActiveAlert);
  }, [requestId, helperId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return hospitals;
    return hospitals.filter((h) =>
      h.name.toLowerCase().includes(needle) ||
      (h.address || '').toLowerCase().includes(needle) ||
      (h.tagline || '').toLowerCase().includes(needle),
    );
  }, [hospitals, query]);


  const submit = async () => {
    if (!picked) { setErr('Pick a hospital first.'); return; }
    setBusy(true); setErr(null);
    try {
      await notifyHospital({
        requestId,
        victimId,
        helperId,
        helperName,
        hospitalId: picked.id,
        hospitalName: picked.name,
        hospitalAddress: picked.address,
        hospitalLocation: picked.location,
        distanceFromSosKm: picked.distanceKm,
        severity,
        victimLocation,
        injuryNotes: notes.trim() || undefined,
      });
      setPicked(null);
      setNotes('');
    } catch (e: any) {
      setErr(e?.message || 'Failed to notify hospital.');
    } finally {
      setBusy(false);
    }
  };

  const reroute = async () => {
    if (!activeAlert) return;
    setBusy(true); setErr(null);
    try { await cancelHospitalAlert(activeAlert.id); }
    catch (e: any) { setErr(e?.message || 'Failed to cancel alert.'); }
    finally { setBusy(false); }
  };

  // ── Already notified a hospital → compact status card ──────────────────────
  if (activeAlert) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3.5 space-y-2">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
              Successfully notified
            </div>
            <div className="text-[11px] font-black text-emerald-100/95 leading-snug">
              ER is preparing for treatment — stay with the person until handover.
            </div>
            <div className="text-sm font-black text-white truncate mt-1">{activeAlert.hospitalName}</div>
            {activeAlert.hospitalAddress && (
              <div className="text-[11px] text-white/55 truncate flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {activeAlert.hospitalAddress}
              </div>
            )}
            <div className="text-[10px] text-white/40 mt-0.5">
              {activeAlert.status === 'acknowledged'
                ? '✅ ER team has acknowledged · preparing the bay'
                : 'Waiting for ER acknowledgement…'}
            </div>
          </div>
          <span className={[
            'rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-wider shrink-0',
            activeAlert.status === 'acknowledged'
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'bg-amber-500/15 text-amber-200',
          ].join(' ')}>
            {activeAlert.status}
          </span>
        </div>
        {activeAlert.injuryNotes && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/70">
            <span className="text-white/40 font-black mr-1">NOTE</span> {activeAlert.injuryNotes}
          </div>
        )}
        <button
          onClick={reroute}
          disabled={busy}
          className="text-[10px] font-black text-white/55 hover:text-red-300 transition underline underline-offset-2 disabled:opacity-40"
        >
          Re-route to a different hospital
        </button>
      </div>
    );
  }

  // ── No alert yet → picker UI ───────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Hospital className="h-3.5 w-3.5 text-blue-300" />
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">
          Alert a nearby hospital
        </span>
      </div>
      <p className="text-[11px] text-white/55 leading-relaxed">
        Pick the hospital you're heading to. We'll notify their ER + on-call doctor with the injury
        info so treatment is ready when you arrive.
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search hospital by name or area"
          className="w-full h-9 rounded-xl border border-white/[0.07] bg-white/[0.03] pl-9 pr-3 text-[12px] text-white placeholder:text-white/25 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-3 text-[11px] text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" />
          Finding hospitals near the incident…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-[11px] text-white/40">
          No hospitals found near this location.
          <div className="text-white/30 mt-0.5">Try a different search term.</div>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 -mr-1">
          {filtered.map((h) => {
            const isPicked = picked?.id === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setPicked(h)}
                className={[
                  'w-full text-left rounded-xl border px-2.5 py-2 transition flex items-start gap-2',
                  isPicked
                    ? 'border-emerald-500/45 bg-emerald-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]',
                ].join(' ')}
              >
                <div
                  className={[
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-sm',
                    h.isShowcase ? 'text-white' : 'text-blue-200',
                  ].join(' ')}
                  style={{
                    background: h.isShowcase
                      ? 'linear-gradient(135deg,#10b981,#0891b2)'
                      : 'rgba(59,130,246,0.15)',
                  }}
                >
                  🏥
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[12px] font-black text-white truncate">{h.name}</span>
                    {h.isShowcase && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 px-1 rounded bg-emerald-500/15">
                        Partner
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/45 truncate">{h.address || '—'}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/55">
                    {typeof h.distanceKm === 'number' && (
                      <span className="text-blue-200 font-bold">
                        {formatDistanceKm(h.distanceKm)}
                      </span>
                    )}
                    {typeof h.rating === 'number' && (
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                        {h.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                {isPicked && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Injury notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Briefly describe the injury (e.g. head trauma, possible fracture)…"
        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] text-white placeholder:text-white/25 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 resize-none"
      />

      <AnimatePresence>
        {err && (
          <motion.div initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-1.5 text-[11px] text-red-300">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {err}
            <button onClick={() => setErr(null)} className="ml-auto"><X className="h-3 w-3 text-red-300/60" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={submit}
        disabled={busy || !picked}
        className="w-full h-10 rounded-xl text-[12px] font-black text-white transition active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
        style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', boxShadow: '0 0 18px rgba(29,78,216,0.30)' }}
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Notifying…
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" />
            {picked ? `Notify ${picked.name}` : 'Notify hospital'}
          </>
        )}
      </button>
    </div>
  );
};
