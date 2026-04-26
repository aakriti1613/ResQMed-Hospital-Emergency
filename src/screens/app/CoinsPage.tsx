import { useEffect, useState } from 'react';
import { Award, TrendingUp, History, HeartPulse, Star } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
  listenUserPointsBalance,
  listenUserPointHistory,
  listenLeaderboard,
  type PointLedgerEntry,
  type UserPointsBalance,
} from '../../data/points';

const POINT_TIERS = [
  { label: 'Rookie',    min: 0,    max: 299,  color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',   glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',   icon: '🛡️' },
  { label: 'Protector', min: 300,  max: 699,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',   icon: '⚡' },
  { label: 'Guardian',  min: 700,  max: 1199, color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',  glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',   icon: '🔥' },
  { label: 'Hero',      min: 1200, max: Infinity, color: 'text-rose-400',bg: 'bg-rose-500/10',    border: 'border-rose-500/20',   glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',    icon: '🏆' },
];

const getTier = (pts: number) => POINT_TIERS.find(t => pts >= t.min && pts < t.max) ?? POINT_TIERS[0]!;

const MEDALS = ['🥇', '🥈', '🥉'];

export const CoinsPage = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<PointLedgerEntry[]>([]);
  const [leaders, setLeaders] = useState<UserPointsBalance[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubBal = listenUserPointsBalance(user.uid, setBalance);
    const unsubHist = listenUserPointHistory(user.uid, setHistory);
    return () => { unsubBal(); unsubHist(); };
  }, [user?.uid]);

  useEffect(() => {
    return listenLeaderboard(setLeaders);
  }, []);

  const tier = getTier(balance);
  const nextTier = POINT_TIERS[POINT_TIERS.findIndex(t => t.label === tier.label) + 1];
  const pctToNext = nextTier ? Math.min(100, ((balance - tier.min) / (nextTier.min - tier.min)) * 100) : 100;

  return (
    <div className="flex flex-col items-center max-w-lg mx-auto w-full pb-12 space-y-4">

      {/* Hero Balance Card */}
      <div className={`w-full rounded-3xl border ${tier.border} bg-[#13141a] p-6 text-center ${tier.glow} relative overflow-hidden`}>
        {/* Ambient glow blob */}
        <div className={`absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-20 ${tier.bg}`} />
        
        <div className={`inline-flex items-center gap-2 rounded-full border ${tier.border} ${tier.bg} px-3 py-1 text-[10px] font-bold ${tier.color} mb-5`}>
          <Star className="h-3 w-3" /> Arogya Points
        </div>
        
        <div className="relative text-6xl font-black tracking-tighter text-white">
          {balance.toLocaleString()}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border ${tier.border} ${tier.bg} px-3 py-1 text-xs font-black ${tier.color}`}>
            {tier.icon} {tier.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-400">
            <HeartPulse className="h-3 w-3" /> {Math.floor(balance / 50)} Rescues
          </span>
        </div>

        {nextTier && (
          <div className="mt-6 text-left">
            <div className="flex justify-between text-[10px] font-bold text-white/40 mb-2 uppercase tracking-widest">
              <span>Progress to {nextTier.label}</span>
              <span>{nextTier.min - balance} pts to go</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                style={{ width: `${pctToNext}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="w-full rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-black text-white/80 uppercase tracking-widest mb-4">
          <History className="h-3.5 w-3.5 text-emerald-400" /> Recent Activity
        </div>
        <div className="space-y-1">
          {history.length === 0 ? (
            <div className="text-xs text-white/30 text-center py-6">No recent points activity yet</div>
          ) : history.map((entry, i) => (
            <div key={entry.id || i} className="flex justify-between items-center rounded-2xl bg-white/3 px-4 py-3 hover:bg-white/5 transition">
              <div>
                <div className="text-sm font-semibold text-white/80">{entry.reason}</div>
                <div className="text-[10px] text-white/30 mt-0.5">
                  {entry.timestamp?.toDate
                    ? entry.timestamp.toDate().toLocaleString()
                    : new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="text-sm font-black text-emerald-400 shrink-0 ml-4">+{entry.points}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="w-full rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-black text-white/80 uppercase tracking-widest mb-4">
          <TrendingUp className="h-3.5 w-3.5 text-blue-400" /> Top Responders
        </div>

        {leaders.length === 0 ? (
          <div className="text-xs text-white/30 text-center py-6">No data yet</div>
        ) : (
          <div className="space-y-2">
            {leaders.map((leader, index) => {
              const lTier = getTier(leader.totalPoints);
              const isTop3 = index < 3;
              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                    isTop3 ? `border ${lTier.border} ${lTier.bg}` : 'bg-white/3 hover:bg-white/5'
                  }`}
                >
                  <div className="w-7 text-center text-base shrink-0">
                    {isTop3 ? MEDALS[index] : <span className="text-xs font-black text-white/30">#{index + 1}</span>}
                  </div>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${lTier.bg} ${lTier.color}`}>
                    {leader.userId.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold text-white/90">{leader.userId}</div>
                    <div className={`text-[10px] font-bold ${lTier.color}`}>{lTier.icon} {lTier.label}</div>
                  </div>
                  <div className="text-sm font-black text-amber-400 shrink-0">
                    {leader.totalPoints.toLocaleString()}
                    <span className="text-[9px] text-white/30 ml-0.5">pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Award info */}
      <div className="w-full rounded-3xl border border-white/5 bg-[#13141a] p-5">
        <div className="flex items-center gap-2 text-xs font-black text-white/80 uppercase tracking-widest mb-3">
          <Award className="h-3.5 w-3.5 text-amber-400" /> How to earn
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { action: 'Respond to SOS', pts: '+50 pts', color: 'text-rose-400' },
            { action: 'Navigate to victim', pts: '+3/step', color: 'text-blue-400' },
            { action: 'First responder', pts: '+20 pts', color: 'text-emerald-400' },
            { action: 'Book appointment', pts: '+10 pts', color: 'text-amber-400' },
          ].map((item) => (
            <div key={item.action} className="rounded-2xl bg-white/3 p-3">
              <div className="text-xs font-semibold text-white/60">{item.action}</div>
              <div className={`text-sm font-black mt-1 ${item.color}`}>{item.pts}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


