import { Link, useParams, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Brain, CheckCircle2, HelpCircle, Play, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getEventById, isEventActive } from '../../data/healthAwareness';
import { getEventCompletion, isQuizCompleted, isScenarioCompleted } from '../../data/challengeProgress';
import { useAuth } from '../../auth/AuthProvider';
import { getChallengeUserId } from '../../lib/challengeUserId';
import { challengeFromQuery, challengesHref, challengeQuerySuffix } from '../../lib/challengeNav';

export const ChallengeEventPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const from = challengeFromQuery(searchParams.get('from'));
  const q = challengeQuerySuffix(from);
  const [, setTick] = useState(0);
  const event = eventId ? getEventById(eventId) : undefined;

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener('arogya-challenge-progress', refresh);
    return () => window.removeEventListener('arogya-challenge-progress', refresh);
  }, []);

  if (!event) return <Navigate to={challengesHref(from)} replace />;

  const challengeUid = getChallengeUserId(user?.uid);
  const completion = getEventCompletion(challengeUid, event.id);
  const live = isEventActive(event);
  const bonusMultiplier = live ? 1.25 : 1;

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-8 pb-8 max-w-lg mx-auto w-full space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to={challengesHref(from)}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/60 hover:bg-white/[0.08] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-white truncate">{event.name}</h1>
          <p className="text-xs text-white/40 truncate">{event.tagline}</p>
        </div>
        <span className="text-3xl shrink-0">{event.emoji}</span>
      </div>

      <div
        className="rounded-3xl p-5 border border-white/10 relative overflow-hidden"
        style={{ background: event.gradient }}
      >
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative text-center">
          {live && (
            <div className="inline-block text-[10px] font-black uppercase tracking-widest bg-white/20 text-white px-3 py-1 rounded-full mb-3">
              Health Day Live · 25% bonus points
            </div>
          )}
          <p className="text-sm text-white/90 leading-relaxed">
            Complete the quick quiz and interactive emergency scenarios to earn Aarogya Points and boost your Emergency Readiness Score.
          </p>
          <div className="mt-4 flex justify-center gap-4 text-center">
            <div>
              <div className="text-2xl font-black text-white">{Math.round(event.quizPoints * bonusMultiplier)}</div>
              <div className="text-[10px] text-white/70 font-bold">Quiz pts</div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">{event.scenarios.length}×{Math.round(event.scenarioBonus * bonusMultiplier)}</div>
              <div className="text-[10px] text-white/70 font-bold">Scenario pts</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-[#13141a] p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-11 w-11 rounded-2xl bg-violet-500/15 flex items-center justify-center shrink-0">
            <HelpCircle className="h-5 w-5 text-violet-300" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-black text-white">Health Day Quiz</h2>
            <p className="text-[11px] text-white/45 mt-0.5">{event.quiz.length} multiple-choice questions · ~3 min</p>
          </div>
          {isQuizCompleted(challengeUid, event.id) && (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          )}
        </div>
        <Link
          to={`/app/challenges/${event.id}/quiz${q}`}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition active:scale-[0.98]"
          style={{ background: event.gradient }}
        >
          <Play className="h-4 w-4" />
          {isQuizCompleted(challengeUid, event.id) ? 'Retake Quiz' : 'Start Quiz'}
        </Link>
        {completion?.quizScore != null && (
          <p className="text-center text-[10px] text-white/35 mt-2">Best score: {completion.quizScore}/{event.quiz.length}</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-cyan-300" />
          <h2 className="text-sm font-black text-white">Interactive Scenarios</h2>
        </div>
        <p className="text-[11px] text-white/40 mb-3">
          Realistic emergency situations — choose the best action under pressure.
        </p>
        <div className="space-y-2">
          {event.scenarios.map((scenario, idx) => {
            const done = isScenarioCompleted(challengeUid, event.id, scenario.id);
            return (
              <Link
                key={scenario.id}
                to={`/app/challenges/${event.id}/scenario/${scenario.id}${q}`}
                className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#13141a] p-4 hover:border-cyan-500/25 transition active:scale-[0.99]"
              >
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-sm font-black text-cyan-300 shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-white">{scenario.title}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 line-clamp-2">{scenario.situation}</div>
                </div>
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                ) : (
                  <div className="text-[10px] font-black text-amber-300 shrink-0">+{Math.round(scenario.points * bonusMultiplier)}</div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {(completion?.pointsAwarded ?? 0) > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-amber-300 shrink-0" />
          <div className="text-xs font-bold text-amber-100">
            You earned {completion!.pointsAwarded} Aarogya Points from this event!
          </div>
        </div>
      )}
    </div>
  );
};
