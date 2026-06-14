import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, HardHat, MapPin, Clock, IndianRupee, ShieldCheck, CheckCircle2, BadgeCheck, Car,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type HelmetDay = {
  dayLabel: string;
  trips: { id: string; from: string; to: string; km: number; min: number; window: string }[];
};

const HELMET_DAYS: HelmetDay[] = [
  {
    dayLabel: 'Today',
    trips: [
      { id: 'h1', from: 'Home · Rohini', to: 'Cyber City', km: 18.4, min: 42, window: '7:10 – 7:52 AM' },
      { id: 'h2', from: 'Cyber City', to: 'Arogya Medicare', km: 6.2, min: 19, window: '12:03 – 12:22 PM' },
      { id: 'h3', from: 'Arogya Medicare', to: 'Home · Rohini', km: 21.0, min: 48, window: '6:40 – 7:28 PM' },
    ],
  },
  {
    dayLabel: 'Yesterday',
    trips: [
      { id: 'h4', from: 'Home · Rohini', to: 'NH-48 service road', km: 34.1, min: 55, window: '8:02 – 8:57 AM' },
      { id: 'h5', from: 'NH-48', to: 'Home · Rohini', km: 33.8, min: 52, window: '7:12 – 8:04 PM' },
    ],
  },
  {
    dayLabel: 'Apr 22',
    trips: [
      { id: 'h6', from: 'Home · Rohini', to: 'Connaught Place', km: 22.6, min: 61, window: '10:15 – 11:16 AM' },
    ],
  },
];

type HelpTripStatus = 'completed' | 'cancelled';
type HelpTrip = {
  id: string;
  title: string;
  area: string;
  when: string;
  distanceKm: number;
  durationMin: number;
  earnedPts: number;
  status: HelpTripStatus;
};

const HELPED_HISTORY: HelpTrip[] = [
  { id: 't1', title: 'Emergency pickup assist', area: 'Sector 18, City Centre', when: 'Today · 6:14 PM', distanceKm: 3.4, durationMin: 12, earnedPts: 200, status: 'completed' },
  { id: 't2', title: 'Roadside first-aid help', area: 'NH-24 Flyover', when: 'Yesterday · 9:02 PM', distanceKm: 5.9, durationMin: 18, earnedPts: 200, status: 'completed' },
  { id: 't3', title: 'SOS response (no show)', area: 'MG Road Metro', when: 'Apr 21 · 8:33 AM', distanceKm: 2.1, durationMin: 7, earnedPts: 0, status: 'cancelled' },
  { id: 't4', title: 'Hospital handover', area: 'Arogya Medicare', when: 'Apr 18 · 11:40 AM', distanceKm: 7.6, durationMin: 22, earnedPts: 200, status: 'completed' },
];

export const TripsPage = () => {
  const nav = useNavigate();
  const [tab, setTab] = useState<'rides' | 'helped' | 'earned'>('rides');

  const stats = useMemo(() => {
    const completed = HELPED_HISTORY.filter((t) => t.status === 'completed');
    const trips = completed.length;
    const km = completed.reduce((a, b) => a + b.distanceKm, 0);
    const mins = completed.reduce((a, b) => a + b.durationMin, 0);
    const pts = completed.reduce((a, b) => a + b.earnedPts, 0);
    return { trips, km, mins, pts };
  }, []);

  const helmetKm = useMemo(
    () => HELMET_DAYS.reduce((a, d) => a + d.trips.reduce((b, t) => b + t.km, 0), 0),
    [],
  );

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-28 max-w-lg mx-auto w-full space-y-4">
      <button
        type="button"
        onClick={() => nav(-1)}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="rounded-3xl border border-white/[0.08] bg-[#13141a] p-4 relative overflow-hidden">
        <div
          className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#6366f1)' }}
        />
        <div className="relative flex items-start gap-3">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}
          >
            <HardHat className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-violet-300">Trips</div>
            <div className="text-lg font-black text-white">Helmet rides · help history · rewards</div>
            <div className="text-[11px] text-white/45">Rides = where your helmet moved by day. Helped = SOS you accepted.</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Ride km" value={helmetKm.toFixed(1)} />
          <Stat label="Helped" value={`${stats.trips}`} />
          <Stat label="Points" value={`${stats.pts}`} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <TabChip active={tab === 'rides'} onClick={() => setTab('rides')} label="Rides" />
        <TabChip active={tab === 'helped'} onClick={() => setTab('helped')} label="Helped" />
        <TabChip active={tab === 'earned'} onClick={() => setTab('earned')} label="Earned" />
      </div>

      <AnimatePresence mode="wait">
        {tab === 'rides' ? (
          <motion.div key="rides" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {HELMET_DAYS.map((day) => (
              <div key={day.dayLabel} className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/35">{day.dayLabel}</span>
                  <span className="text-[10px] font-bold text-white/40">
                    {day.trips.length} trip{day.trips.length === 1 ? '' : 's'}
                  </span>
                </div>
                {day.trips.map((t, i) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-black text-amber-300/90 uppercase tracking-wider">
                      Trip {i + 1}
                    </div>
                    <div className="text-sm font-black text-white mt-1">{t.from} → {t.to}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/50 font-semibold">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{t.window}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{t.km.toFixed(1)} km</span>
                      <span>{t.min} min moving</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-[11px] text-white/35 text-center px-2">
              Demo ride segments. Connect a smart helmet to log real movement by day.
            </p>
          </motion.div>
        ) : tab === 'helped' ? (
          <motion.div key="helped" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
            {HELPED_HISTORY.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.25) }}
                className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-white/[0.05] flex items-center justify-center shrink-0">
                    {t.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-amber-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-black text-white">{t.title}</div>
                      <span className={[
                        'rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-wider',
                        t.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'bg-amber-500/10 text-amber-200 border border-amber-500/20',
                      ].join(' ')}>
                        {t.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/45">
                      <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{t.area}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-white/55 font-semibold">
                      <Mini icon={<Clock className="h-3 w-3 text-sky-300" />} text={t.when} />
                      <Mini icon={<BadgeCheck className="h-3 w-3 text-emerald-300" />} text={`${t.distanceKm.toFixed(1)} km`} />
                      <Mini icon={<Car className="h-3 w-3 text-amber-300" />} text={`${t.earnedPts} pts`} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="earned" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">This week</div>
              <div className="text-2xl font-black text-white mt-1">{stats.pts} points</div>
              <div className="text-[11px] text-white/55 mt-1">Earn 200 pts per completed help. Redeem in Profile → Rewards.</div>
              <Link to="/app/profile" className="inline-flex mt-3 text-[11px] font-black text-emerald-200 hover:text-emerald-100 underline underline-offset-2">
                Open rewards →
              </Link>
            </div>
            <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Lifetime</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/[0.03] py-2 border border-white/[0.05]">
                  <div className="text-lg font-black text-white">{stats.trips}</div>
                  <div className="text-[9px] text-white/40 font-bold">Helps</div>
                </div>
                <div className="rounded-xl bg-white/[0.03] py-2 border border-white/[0.05]">
                  <div className="text-lg font-black text-white">{stats.km.toFixed(0)}</div>
                  <div className="text-[9px] text-white/40 font-bold">Km</div>
                </div>
                <div className="rounded-xl bg-white/[0.03] py-2 border border-white/[0.05]">
                  <div className="text-lg font-black text-white flex items-center justify-center gap-0.5">
                    <IndianRupee className="h-3.5 w-3.5 text-amber-400" />
                    {stats.pts}
                  </div>
                  <div className="text-[9px] text-white/40 font-bold">Pts</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] py-2 text-center">
    <div className="text-sm font-black text-white">{value}</div>
    <div className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">{label}</div>
  </div>
);

const TabChip = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'h-9 px-3 rounded-full border text-[11px] font-black transition active:scale-95',
      active ? 'bg-white text-slate-950 border-white' : 'bg-white/[0.03] text-white/60 border-white/[0.08] hover:bg-white/[0.06]',
    ].join(' ')}
  >
    {label}
  </button>
);

const Mini = ({ icon, text }: { icon: ReactNode; text: string }) => (
  <div className="inline-flex items-center gap-1 rounded-xl bg-white/[0.03] border border-white/[0.05] px-2 py-1 truncate">
    {icon}
    <span className="truncate">{text}</span>
  </div>
);
