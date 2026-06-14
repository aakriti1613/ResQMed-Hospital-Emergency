import { Link } from 'react-router-dom';
import { ChevronRight, Shield, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import type { EmergencyReadinessResult } from '../data/readinessScore';

type Props = {
  readiness: EmergencyReadinessResult;
  compact?: boolean;
  showFactors?: boolean;
};

export const ReadinessScoreCard = ({ readiness, compact, showFactors }: Props) => {
  const { score, grade, gradeColor, factors } = readiness;
  const pct = score;

  if (compact) {
    return (
      <Link
        to="/app/challenges"
        className="block rounded-3xl border border-white/[0.08] bg-[#13141a] p-4 hover:border-white/15 transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div
            className="relative h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center"
            style={{ background: `${gradeColor}22`, border: `2px solid ${gradeColor}55` }}
          >
            <span className="text-lg font-black text-white">{score}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Emergency Readiness</div>
            <div className="text-sm font-black text-white">{grade}</div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: gradeColor }}
              />
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
        </div>
      </Link>
    );
  }

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#13141a] p-5 relative overflow-hidden">
      <div
        className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: gradeColor }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${gradeColor}25` }}
            >
              <Shield className="h-6 w-6" style={{ color: gradeColor }} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Emergency Readiness Score</div>
              <div className="text-xl font-black text-white">{grade}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-white tabular-nums">{score}</div>
            <div className="text-[10px] font-bold text-white/35">/ 100</div>
          </div>
        </div>

        <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-1">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${gradeColor}, ${gradeColor}aa)` }}
          />
        </div>
        <p className="text-[11px] text-white/45 mb-4">
          Improve your score by completing profile, contacts, and health challenges.
        </p>

        {showFactors && (
          <div className="space-y-2">
            {factors.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                <div className={`h-2 w-2 rounded-full shrink-0 ${f.complete ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white/80">{f.label}</div>
                  <div className="text-[10px] text-white/40">{f.earned}/{f.maxPoints} pts</div>
                </div>
                {!f.complete && f.actionPath && (
                  <Link
                    to={f.actionPath}
                    className="text-[10px] font-black text-sky-300 shrink-0 hover:text-sky-200"
                  >
                    Fix →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        <Link
          to="/app/challenges"
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-xs font-black text-white/70 hover:bg-white/[0.08] transition"
        >
          <TrendingUp className="h-4 w-4" /> Play health challenges to improve
        </Link>
      </div>
    </div>
  );
};
