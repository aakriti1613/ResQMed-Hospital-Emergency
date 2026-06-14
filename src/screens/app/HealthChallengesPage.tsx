import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Gamepad2, Sparkles, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HEALTH_AWARENESS_EVENTS,
  getActiveEvents,
  getFeaturedEvent,
  isEventActive,
  daysUntilEvent,
} from '../../data/healthAwareness';
import { getEventCompletion } from '../../data/challengeProgress';
import { useAuth } from '../../auth/AuthProvider';
import { getChallengeUserId } from '../../lib/challengeUserId';
import { ReadinessScoreCard } from '../../components/ReadinessScoreCard';
import { useEmergencyReadiness } from '../../hooks/useEmergencyReadiness';
import { challengeBackPath, challengeEventHref, challengeFromQuery } from '../../lib/challengeNav';

export const HealthChallengesPage = () => {
  const { user } = useAuth();
  const { readiness } = useEmergencyReadiness();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const from = challengeFromQuery(searchParams.get('from'));
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener('arogya-challenge-progress', refresh);
    return () => window.removeEventListener('arogya-challenge-progress', refresh);
  }, []);

  const activeEvents = getActiveEvents();
  const featured = getFeaturedEvent();
  const challengeUid = getChallengeUserId(user?.uid);
  const eventSuffix = from ? `?from=${from}` : '';

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-8 pb-8 max-w-lg mx-auto w-full space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to={challengeBackPath(from)}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/60 hover:bg-white/[0.08] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">{t('challenges.title')}</h1>
          <p className="text-xs text-white/40">{t('challenges.subtitle')}</p>
        </div>
      </div>

      <ReadinessScoreCard readiness={readiness} showFactors from={from} />

      {activeEvents.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-emerald-300 shrink-0" />
          <div>
            <div className="text-xs font-black text-emerald-200">{t('challenges.weekLive')}</div>
            <div className="text-[11px] text-emerald-200/70">{t('challenges.weekLiveSub')}</div>
          </div>
        </div>
      )}

      <Link
        to={challengeEventHref(featured.id, from)}
        className="block rounded-3xl border border-white/[0.1] p-5 relative overflow-hidden hover:border-white/20 transition active:scale-[0.99]"
        style={{ background: featured.gradient }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1">
            {isEventActive(featured)
              ? t('challenges.liveNow')
              : t('challenges.upcomingIn', { days: daysUntilEvent(featured) })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{featured.emoji}</span>
            <div>
              <h2 className="text-lg font-black text-white">{featured.name}</h2>
              <p className="text-xs text-white/80 mt-0.5">{featured.tagline}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-black text-white">
              <Gamepad2 className="h-3 w-3" /> {t('challenges.quizScenarios')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-black text-white">
              <Trophy className="h-3 w-3" /> +{featured.quizPoints} {t('dashboard.pts')}
            </span>
          </div>
        </div>
      </Link>

      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-3">{t('challenges.allHealthDays')}</div>
        <div className="space-y-2">
          {HEALTH_AWARENESS_EVENTS.map((event, i) => {
            const completion = getEventCompletion(challengeUid, event.id);
            const quizDone = completion?.quizDone;
            const scenariosDone = completion?.scenariosDone?.length ?? 0;
            const live = isEventActive(event);

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/app/challenges/${event.id}${eventSuffix}`}
                  className="flex items-center gap-4 rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 hover:border-white/12 transition"
                >
                  <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: `${event.color}22` }}
                  >
                    {event.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white truncate">{event.name}</span>
                      {live && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-md shrink-0">
                          {t('challenges.live')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/40 flex items-center gap-2 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(2000, event.month - 1, event.day).toLocaleString('en', { month: 'short', day: 'numeric' })}
                      {!live && <span>· {t('challenges.inDays', { days: daysUntilEvent(event) })}</span>}
                    </div>
                    {(quizDone || scenariosDone > 0) && (
                      <div className="text-[10px] text-amber-300/90 font-bold mt-1">
                        {quizDone ? t('challenges.quizDone') : ''}{quizDone && scenariosDone > 0 ? ' · ' : ''}
                        {scenariosDone > 0 ? t('challenges.scenariosDone', { count: scenariosDone }) : ''}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-amber-300">+{event.quizPoints}</div>
                    <div className="text-[9px] text-white/30">{t('dashboard.pts')}</div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
