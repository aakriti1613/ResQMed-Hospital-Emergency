import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEventById, isEventActive } from '../../data/healthAwareness';
import { completeScenario, isScenarioCompleted } from '../../data/challengeProgress';
import { useAuth } from '../../auth/AuthProvider';
import { getChallengeUserId } from '../../lib/challengeUserId';
import { challengeFromQuery, challengesHref, challengeEventHref } from '../../lib/challengeNav';

export const ChallengeScenarioPage = () => {
  const { eventId, scenarioId } = useParams<{ eventId: string; scenarioId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const from = challengeFromQuery(searchParams.get('from'));
  const event = eventId ? getEventById(eventId) : undefined;
  const scenario = event?.scenarios.find((s) => s.id === scenarioId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [alreadyEarned, setAlreadyEarned] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!event || !scenario) return <Navigate to={challengesHref(from)} replace />;

  const live = isEventActive(event);
  const pts = Math.round(scenario.points * (live ? 1.25 : 1));
  const selected = scenario.choices.find((c) => c.id === selectedId);
  const challengeUid = getChallengeUserId(user?.uid);

  const handleChoose = async (choiceId: string) => {
    if (selectedId || busy) return;
    setSelectedId(choiceId);
    const choice = scenario.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    setBusy(true);
    const wasDone = isScenarioCompleted(challengeUid, event.id, scenario.id);
    const { points, alreadyDone } = await completeScenario(
      challengeUid,
      event.id,
      scenario.id,
      event.name,
      pts,
      choice.isCorrect,
      user?.uid
    );
    setPointsEarned(points);
    setAlreadyEarned(alreadyDone || wasDone);
    setFinished(true);
    setBusy(false);
  };

  if (finished && selected) {
    return (
      <div className="min-h-full bg-[#0a0b0f] px-4 pt-10 pb-8 max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border p-5 mb-5 ${selected.isCorrect ? 'border-emerald-500/30 bg-emerald-500/[0.08]' : 'border-amber-500/30 bg-amber-500/[0.08]'}`}
        >
          <div className="flex items-center gap-3 mb-3">
            {selected.isCorrect ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            ) : (
              <XCircle className="h-8 w-8 text-amber-400" />
            )}
            <div>
              <div className="text-lg font-black text-white">
                {selected.isCorrect ? 'Great decision!' : 'Not quite. Learn for next time'}
              </div>
              {pointsEarned > 0 ? (
                <div className="text-sm font-black text-amber-300">+{pointsEarned} Aarogya Points</div>
              ) : alreadyEarned ? (
                <div className="text-xs text-white/50">Already completed. Practice mode</div>
              ) : !user ? (
                <div className="text-xs text-sky-300">
                  <Link to={`/login?redirect=${encodeURIComponent(challengeEventHref(event.id, from))}`} className="underline font-bold">
                    Log in
                  </Link>{' '}
                  to earn points
                </div>
              ) : null}
            </div>
          </div>
          <p className="text-sm text-white/75 leading-relaxed">{selected.feedback}</p>
        </motion.div>

        {!selected.isCorrect && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 mb-5">
            <div className="text-[10px] font-black uppercase text-emerald-300 mb-1">Best answer</div>
            <p className="text-xs text-white/70">
              {scenario.choices.find((c) => c.isCorrect)?.text}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            to={challengeEventHref(event.id, from)}
            className="w-full rounded-2xl py-3.5 text-sm font-black text-white text-center"
            style={{ background: event.gradient }}
          >
            Back to {event.name}
          </Link>
          <Link to={challengesHref(from)} className="text-center text-xs font-bold text-white/40 hover:text-white/60">
            All health challenges
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-8 pb-8 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => nav(challengeEventHref(event.id, from))}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/60"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Interactive Scenario</div>
          <div className="text-sm font-black text-white truncate">{scenario.title}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.06] p-4 mb-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
          <p className="text-sm text-white/80 leading-relaxed">{scenario.situation}</p>
        </div>
      </div>

      <h2 className="text-base font-black text-white mb-4">{scenario.prompt}</h2>

      <AnimatePresence>
        <div className="space-y-2">
          {scenario.choices.map((choice, i) => (
            <motion.button
              key={choice.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              type="button"
              disabled={Boolean(selectedId) || busy}
              onClick={() => void handleChoose(choice.id)}
              className="w-full text-left rounded-2xl border border-white/[0.08] bg-[#13141a] px-4 py-4 text-sm font-semibold text-white/85 hover:border-cyan-500/30 hover:bg-cyan-500/[0.04] transition active:scale-[0.99] disabled:opacity-60"
            >
              <span className="text-[10px] font-black text-white/30 mr-2">{String.fromCharCode(65 + i)}.</span>
              {choice.text}
            </motion.button>
          ))}
        </div>
      </AnimatePresence>

      <p className="mt-5 text-center text-[10px] text-white/30">
        Choose carefully. Points awarded for correct decisions (+{pts} pts)
      </p>
    </div>
  );
};
