/**
 * ClinicalBadge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Small "WHO / AHA / ATLS"-style citation pill for clinical thresholds.
 * Displayed next to vitals or escalation events so judges and clinicians can
 * see WHICH international standard a threshold maps to.
 *
 * Sources match those used in ml_service/medical_risk_layer.py:
 *   - WHO ETAT (Emergency Triage Assessment & Treatment)
 *   - AHA/ACC heart-rate reference ranges
 *   - WHO pulse oximetry guidelines (2011)
 *   - ATLS (Advanced Trauma Life Support)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Activity, AlertTriangle, HeartPulse, Wind } from 'lucide-react';

export type ClinicalAuthority = 'WHO' | 'AHA' | 'ATLS';

const STYLES: Record<ClinicalAuthority, { bg: string; ring: string; text: string }> = {
  WHO:  { bg: 'bg-sky-500/10',    ring: 'ring-sky-500/30',    text: 'text-sky-300' },
  AHA:  { bg: 'bg-rose-500/10',   ring: 'ring-rose-500/30',   text: 'text-rose-300' },
  ATLS: { bg: 'bg-amber-500/10',  ring: 'ring-amber-500/30',  text: 'text-amber-300' },
};

export const ClinicalBadge = ({
  authority, label, title,
}: { authority: ClinicalAuthority; label: string; title?: string }) => {
  const s = STYLES[authority];
  return (
    <span
      title={title || `${authority} clinical threshold`}
      className={`inline-flex items-center gap-1 rounded-full ring-1 ${s.bg} ${s.ring} px-2 py-0.5 text-[9px] font-black tracking-wider ${s.text}`}
    >
      <span className="uppercase">{authority}</span>
      <span className="text-white/60 normal-case font-bold tracking-normal">{label}</span>
    </span>
  );
};

// ── Helpers: turn a vital value into the right citation badge ──────────────

export const heartRateBadge = (bpm?: number) => {
  if (typeof bpm !== 'number' || bpm <= 0) return null;
  if (bpm < 40)  return <ClinicalBadge key="hr-low"  authority="AHA"  label="HR < 40 — severe bradycardia" title="AHA/ACC: heart rate < 40 BPM = critical bradycardia" />;
  if (bpm > 170) return <ClinicalBadge key="hr-high" authority="AHA"  label="HR > 170 — severe tachycardia" title="AHA/ACC: sustained HR > 170 BPM = critical tachycardia" />;
  if (bpm < 50)  return <ClinicalBadge key="hr-low2" authority="AHA"  label="HR < 50 — bradycardia"        title="AHA/ACC: heart rate < 50 BPM = bradycardic range" />;
  if (bpm > 120) return <ClinicalBadge key="hr-high2" authority="AHA" label="HR > 120 — tachycardia"       title="AHA/ACC: heart rate > 120 BPM = tachycardic range" />;
  return null;
};

export const spo2Badge = (pct?: number) => {
  if (typeof pct !== 'number' || pct <= 0) return null;
  if (pct < 88) return <ClinicalBadge key="spo2-crit" authority="WHO" label="SpO₂ < 88% — critical hypoxia" title="WHO pulse oximetry guidelines (2011): SpO₂ < 88% = critical" />;
  if (pct < 94) return <ClinicalBadge key="spo2-low"  authority="WHO" label="SpO₂ < 94% — hypoxia"          title="WHO pulse oximetry guidelines: SpO₂ < 94% = compromised oxygenation" />;
  return null;
};

export const noMovementBadge = (seconds?: number) => {
  if (typeof seconds !== 'number' || seconds < 60) return null;
  return <ClinicalBadge authority="ATLS" label={`No movement ${Math.round(seconds)}s — possible unconscious`} title="ATLS protocol: prolonged immobility post-impact suggests unconsciousness" />;
};

export const ICONS = { Activity, AlertTriangle, HeartPulse, Wind };
