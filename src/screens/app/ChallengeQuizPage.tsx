import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEventById, isEventActive } from '../../data/healthAwareness';
import { completeQuiz, isQuizCompleted } from '../../data/challengeProgress';
import { useAuth } from '../../auth/AuthProvider';
import { getChallengeUserId } from '../../lib/challengeUserId';
import { challengeFromQuery, challengesHref, challengeEventHref } from '../../lib/challengeNav';

export const ChallengeQuizPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const from = challengeFromQuery(searchParams.get('from'));
  const event = eventId ? getEventById(eventId) : undefined;

  const [index, setIndex] = useState(0);
  const scoreRef = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [finished, setFinished] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [alreadyEarned, setAlreadyEarned] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!event) return <Navigate to={challengesHref(from)} replace />;

  const q = event.quiz[index];
  const isLast = index >= event.quiz.length - 1;
  const live = isEventActive(event);
  const basePoints = Math.round(event.quizPoints * (live ? 1.25 : 1));
  const challengeUid = getChallengeUserId(user?.uid);

  if (!q) return <Navigate to={challengeEventHref(event.id, from)} replace />;

  const handleSelect = (optIdx: number) => {
    if (selected !== null) return;
    setSelected(optIdx);
    if (optIdx === q.correctIndex) {
      scoreRef.current += 1;
      setDisplayScore(scoreRef.current);
    }
    setShowResult(true);
  };

  const handleNext = async () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
      return;
    }

    setBusy(true);
    const finalScore = scoreRef.current;
    const wasDone = isQuizCompleted(challengeUid, event.id);
    const { points, alreadyDone } = await completeQuiz(
      challengeUid,
      event.id,
      finalScore,
      event.quiz.length,
      event.name,
      basePoints,
      user?.uid
    );
    setPointsEarned(points);
    setAlreadyEarned(alreadyDone || wasDone);
    setFinished(true);
    setBusy(false);
  };

  if (finished) {
    return (
      <div className="min-h-full bg-[#0a0b0f] px-4 pt-12 pb-8 max-w-lg mx-auto w-full flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="h-20 w-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: event.gradient }}
        >
          <Trophy className="h-10 w-10 text-white" />
        </motion.div>
        <h1 className="text-2xl font-black text-white">Quiz Complete!</h1>
        <p className="mt-2 text-sm text-white/50">
          You scored <span className="text-white font-black">{displayScore}/{event.quiz.length}</span>
        </p>
        {pointsEarned > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-amber-200 font-black">
            +{pointsEarned} Aarogya Points earned!
          </div>
        ) : alreadyEarned ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-white/60 text-sm">
            Points already earned for this quiz. Great practice run!
          </div>
        ) : !user ? (
          <div className="mt-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-3 text-sky-200 text-sm">
            <Link to={`/login?redirect=${encodeURIComponent(challengeEventHref(event.id, from))}`} className="font-black underline">
              Log in
            </Link>{' '}
            to save Aarogya Points to your account.
          </div>
        ) : null}
        <p className="mt-3 text-xs text-white/40">Your Emergency Readiness Score has been updated.</p>
        <div className="mt-8 flex flex-col gap-3 w-full">
          <Link
            to={challengeEventHref(event.id, from)}
            className="w-full rounded-2xl py-3.5 text-sm font-black text-white text-center"
            style={{ background: event.gradient }}
          >
            Try Interactive Scenarios →
          </Link>
          <Link to={challengesHref(from)} className="text-xs font-bold text-white/40 hover:text-white/60">
            Back to all challenges
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-8 pb-8 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => nav(challengeEventHref(event.id, from))}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/60"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40">{event.name} Quiz</div>
          <div className="text-sm font-black text-white">Question {index + 1} of {event.quiz.length}</div>
        </div>
        <div className="text-xs font-black text-emerald-300">{displayScore} correct</div>
      </div>

      <div className="h-1.5 rounded-full bg-white/10 mb-6 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / event.quiz.length) * 100}%`, background: event.color }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <h2 className="text-lg font-black text-white leading-snug mb-5">{q.question}</h2>
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              let style = 'border-white/[0.08] bg-[#13141a] hover:border-white/15';
              if (showResult && selected === i) {
                style = i === q.correctIndex
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-red-500/40 bg-red-500/10';
              } else if (showResult && i === q.correctIndex) {
                style = 'border-emerald-500/30 bg-emerald-500/[0.06]';
              }
              return (
                <button
                  key={i}
                  type="button"
                  disabled={selected !== null}
                  onClick={() => handleSelect(i)}
                  className={`w-full text-left rounded-2xl border px-4 py-3.5 text-sm font-semibold text-white/85 transition ${style}`}
                >
                  <span className="flex items-center gap-2">
                    {showResult && i === q.correctIndex && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                    {showResult && selected === i && i !== q.correctIndex && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Explanation</div>
              <p className="text-xs text-white/70 leading-relaxed">{q.explanation}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {showResult && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleNext()}
          className="mt-6 w-full rounded-2xl py-4 text-sm font-black text-white active:scale-[0.98] transition disabled:opacity-50"
          style={{ background: event.gradient }}
        >
          {busy ? 'Saving…' : isLast ? 'Finish Quiz' : 'Next Question →'}
        </button>
      )}
    </div>
  );
};
