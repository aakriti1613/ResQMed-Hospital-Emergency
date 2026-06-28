import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck2, Clock, MapPin, Building2, IndianRupee, Trash2, Plus,
  Stethoscope, AlertCircle, ShieldCheck, Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../auth/AuthProvider';
import { listenAppointments, removeAppointment, type Appointment } from '../../data/appointments';
import { getDepartment } from '../../data/hospitals';

type Tab = 'upcoming' | 'past';

export const AppointmentsPage = () => {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    if (!ready) return;
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const unsub = listenAppointments(user.uid, (data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user, ready]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now() - 15 * 60 * 1000; // include ones that just started
    const up: Appointment[] = [];
    const ps: Appointment[] = [];
    for (const a of items) {
      if (a.status === 'scheduled' && a.startAt.getTime() >= now) up.push(a);
      else ps.push(a);
    }
    up.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    ps.sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    return { upcoming: up, past: ps };
  }, [items]);

  const visible = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-8 pb-6 max-w-lg mx-auto w-full space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-4 w-4 text-emerald-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300/80">Appointments</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white">Your visits</h1>
          <p className="mt-1 text-xs text-white/40">Upcoming and past consultations. All in one place.</p>
        </div>
        <Link
          to="/app/care"
          className="h-10 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-black text-white transition active:scale-95"
          style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)', boxShadow: '0 0 20px rgba(16,185,129,0.35)' }}
        >
          <Plus className="h-3.5 w-3.5" /> Book
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl border border-white/[0.05] bg-[#13141a] p-1 gap-1">
        <TabBtn active={tab === 'upcoming'} onClick={() => setTab('upcoming')} label={`Upcoming${upcoming.length ? ` · ${upcoming.length}` : ''}`} />
        <TabBtn active={tab === 'past'}     onClick={() => setTab('past')}     label={`Past${past.length ? ` · ${past.length}` : ''}`} />
      </div>

      {/* Not logged in */}
      {!user && ready && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.05] p-5 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-100/80">
            Please log in to see your appointments.
            <div className="mt-2"><Link to="/login" className="font-black underline underline-offset-2">Log in →</Link></div>
          </div>
        </div>
      )}

      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">{err}</div>
      )}

      {/* List */}
      {loading ? (
        <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 text-center text-sm text-white/40">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-2.5">
          {visible.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.035, 0.25) }}
            >
              <AppointmentCard
                appt={a}
                onRemove={async () => {
                  try {
                    await removeAppointment(a.id);
                    setItems((prev) => prev.filter((x) => x.id !== a.id));
                  } catch (e: any) {
                    setErr(e?.message || 'Failed to remove appointment.');
                  }
                }}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button
    onClick={onClick}
    className={[
      'flex-1 py-2.5 rounded-xl text-xs font-black transition',
      active
        ? 'bg-emerald-500/20 text-emerald-200'
        : 'text-white/35 hover:text-white/60',
    ].join(' ')}
  >
    {label}
  </button>
);

const EmptyState = ({ tab }: { tab: Tab }) => (
  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
    <CalendarCheck2 className="h-8 w-8 text-white/20 mx-auto mb-2" />
    <p className="text-sm font-bold text-white/50">
      {tab === 'upcoming' ? 'No upcoming visits' : 'No past visits'}
    </p>
    <p className="text-[11px] text-white/30 mt-0.5">
      {tab === 'upcoming' ? 'Book a doctor to see them here.' : 'Completed consultations will appear here.'}
    </p>
    {tab === 'upcoming' && (
      <Link
        to="/app/care"
        className="mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-xs font-black text-white"
        style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}
      >
        <Stethoscope className="h-3.5 w-3.5" /> Find a doctor
      </Link>
    )}
  </div>
);

const AppointmentCard = ({ appt, onRemove }: { appt: Appointment; onRemove: () => void }) => {
  const dept = getDepartment(appt.department);
  const isPast = appt.startAt.getTime() < Date.now() - 15 * 60 * 1000 || appt.status !== 'scheduled';

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: dept.gradient }} />
      <div className="relative flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
          style={{ background: dept.gradient }}>
          {appt.doctorAvatar || dept.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[9px] font-black text-white uppercase tracking-wider"
              style={{ background: dept.gradient }}
            >
              {dept.icon} {appt.departmentName || dept.name}
            </span>
            <span className={[
              'rounded-full px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wider',
              appt.status === 'scheduled' ? 'bg-emerald-500/15 text-emerald-300' :
              appt.status === 'completed' ? 'bg-sky-500/15 text-sky-300' :
              'bg-white/[0.06] text-white/40',
            ].join(' ')}>
              {appt.status}
            </span>
          </div>
          <div className="mt-0.5 text-sm font-black text-white truncate">
            {appt.doctorName || 'Doctor consultation'}
          </div>
          {(appt.hospitalName || true) && (
            <div className="text-[11px] text-white/55 flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{appt.hospitalName || appt.hospitalId}</span>
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-white/55">
            <Clock className="h-3 w-3" />
            {appt.startAt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            <span className="h-1 w-1 rounded-full bg-white/15" />
            {appt.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {appt.feeRupees !== undefined && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/15" />
                <span className="inline-flex items-center text-amber-300">
                  <IndianRupee className="h-3 w-3" />{appt.feeRupees}
                </span>
              </>
            )}
          </div>
          {appt.reason && (
            <div className="mt-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/65 leading-relaxed">
              <MapPin className="inline-block h-3 w-3 mr-1 text-white/40" />
              {appt.reason}
            </div>
          )}
          <PaymentBadge appt={appt} />
          <VisitSummary appt={appt} />
        </div>
        {!isPast && (
          <button
            onClick={onRemove}
            className="h-8 w-8 rounded-full bg-white/[0.05] hover:bg-red-500/20 text-white/40 hover:text-red-300 transition flex items-center justify-center shrink-0"
            title="Cancel appointment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

const VisitSummary = ({ appt }: { appt: Appointment }) => {
  if (appt.status !== 'completed') return null;
  if (!appt.diagnosis && !appt.prescription && !appt.advice) return null;
  const Line = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div>
        <div className="text-[9px] font-black uppercase tracking-wider text-sky-300/80">{label}</div>
        <div className="text-[11px] text-white/75 leading-relaxed whitespace-pre-wrap">{value}</div>
      </div>
    ) : null;
  return (
    <div className="mt-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-300">
        <Stethoscope className="h-3 w-3" /> Doctor's summary
      </div>
      <Line label="Diagnosis" value={appt.diagnosis} />
      <Line label="Prescription" value={appt.prescription} />
      <Line label="Advice" value={appt.advice} />
    </div>
  );
};

const PaymentBadge = ({ appt }: { appt: Appointment }) => {
  if (!appt.paymentStatus && !appt.paymentMethod) return null;

  if (appt.paymentStatus === 'paid') {
    const method = appt.paymentMethod === 'gpay' ? 'Google Pay' : (appt.paymentMethod || 'Online').toUpperCase();
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] bg-emerald-500/10 border border-emerald-500/25">
        <ShieldCheck className="h-3 w-3 text-emerald-300" />
        <span className="text-[10px] font-black text-emerald-200">
          Paid · {method}
          {appt.paymentCardLabel ? ` · ${appt.paymentCardLabel}` : ''}
        </span>
      </div>
    );
  }

  if (appt.paymentStatus === 'unpaid' || appt.paymentMethod === 'cash') {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] bg-amber-500/10 border border-amber-500/25">
        <Wallet className="h-3 w-3 text-amber-300" />
        <span className="text-[10px] font-black text-amber-200">Pay at hospital</span>
      </div>
    );
  }

  return null;
};
