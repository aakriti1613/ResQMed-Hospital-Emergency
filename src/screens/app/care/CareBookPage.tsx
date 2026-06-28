import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Star, Clock, CheckCircle2, Globe, Phone, MapPin, Sparkles, AlertCircle, IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../../auth/AuthProvider';
import { createAppointment } from '../../../data/appointments';
import { getUserProfile, computeAgeFromDob } from '../../../data/user';
import {
  SHOWCASE_HOSPITAL, SHOWCASE_HOSPITAL_ID, getDepartment, getHospitalById,
  getShowcaseDoctorById, generateSlots, type Slot,
} from '../../../data/hospitals';
import { GooglePayButton } from '../../../components/GooglePayButton';
import { buildMockGpaySuccess, payWithGooglePay, type GpaySuccess } from '../../../lib/googlePay';

export const CareBookPage = () => {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const doctorId = params.get('doctor') || '';
  const hospitalId = params.get('hospital') || SHOWCASE_HOSPITAL_ID;
  const deptId = params.get('dept') || 'general';

  const doctor = getShowcaseDoctorById(doctorId);
  const dept = getDepartment(doctor?.department || deptId);
  const hospital = getHospitalById(hospitalId) ?? SHOWCASE_HOSPITAL;

  // Slots grouped by date label
  const slots = useMemo<Slot[]>(() => generateSlots({ days: 5, startHour: 9, endHour: 20, stepMinutes: 30 }), []);
  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    slots.forEach((s) => {
      const list = map.get(s.dateLabel) ?? [];
      list.push(s);
      map.set(s.dateLabel, list);
    });
    return Array.from(map.entries());
  }, [slots]);

  const [selectedDay, setSelectedDay] = useState<string>(() => slotsByDay[0]?.[0] ?? 'Today');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const daySlots = slotsByDay.find(([d]) => d === selectedDay)?.[1] ?? [];
  const selectedSlot = slots.find((s) => s.key === selectedKey);

  // No doctor was resolvable → redirect back with a helpful message.
  if (!doctor) {
    return (
      <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-8 max-w-lg mx-auto w-full space-y-4">
        <button onClick={() => nav('/app/care')}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to departments
        </button>
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-300 shrink-0" />
            <div>
              <div className="text-sm font-black text-amber-200">Doctor not found</div>
              <p className="mt-1 text-xs text-amber-100/70 leading-relaxed">
                That doctor isn't available any more. Pick a specialty below to start again.
              </p>
            </div>
          </div>
          <Link to="/app/care"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-amber-100/90 hover:text-amber-100">
            Choose department →
          </Link>
        </div>
      </div>
    );
  }

  const validate = (): string | null => {
    if (!selectedSlot) return 'Please pick a time slot.';
    if (!reason.trim()) return 'Please add a short reason (symptoms or purpose).';
    if (!user) return 'Please log in (or enable demo mode) to confirm.';
    return null;
  };

  const bookAppointment = async (payment?: GpaySuccess) => {
    if (!selectedSlot || !user) return;
    setBusy(true); setErr(null); setOk(null);
    try {
      // Snapshot the patient's name/age/blood group so the hospital portal can
      // show who's booked without needing access to the patient's profile.
      let patientName: string | undefined = user.displayName ?? undefined;
      let patientAge: number | undefined;
      let patientBloodGroup: string | undefined;
      try {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          patientName = profile.name || patientName;
          patientAge = computeAgeFromDob(profile.dob);
          patientBloodGroup = profile.bloodGroup || undefined;
        }
      } catch { /* snapshot is best-effort */ }

      await createAppointment({
        patientId: user.uid,
        doctorId: doctor.id,
        hospitalId: hospital.id,
        startAt: selectedSlot.start,
        endAt: selectedSlot.end,
        reason: reason.trim(),
        status: 'scheduled',
        doctorName: doctor.name,
        doctorAvatar: doctor.avatarEmoji,
        department: dept.id,
        departmentName: dept.name,
        hospitalName: hospital.name,
        patientName,
        patientAge,
        patientBloodGroup,
        feeRupees: doctor.feeRupees,
        paymentStatus: payment ? 'paid' : 'unpaid',
        paymentMethod: payment ? 'gpay' : 'cash',
        paymentRef: payment?.ref,
        paymentCardLabel: payment?.cardLabel,
        paidAt: payment ? new Date() : undefined,
      });
      setOk(payment ? 'Payment received · Appointment confirmed ✅' : 'Appointment confirmed ✅');
      setTimeout(() => nav('/app/appointments'), 900);
    } catch (e: any) {
      setErr(e?.message || 'Failed to book appointment.');
    } finally {
      setBusy(false);
    }
  };

  const onGpaySuccess = async (result: GpaySuccess) => {
    const v = validate();
    if (v) { setErr(v); return; }
    await bookAppointment(result);
  };

  const onPayLater = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    await bookAppointment();
  };

  const onMockGooglePay = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr(null);
    await bookAppointment(buildMockGpaySuccess());
  };

  const onPayWithGooglePay = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      const result = await payWithGooglePay({
        amountRupees: doctor.feeRupees,
        label: `${doctor.name} · ${dept.name} consultation`,
      });
      await bookAppointment(result);
    } catch (e: any) {
      const code = e?.statusCode || e?.code;
      setErr(code ? `Google Pay error (${code}). Try Demo pay or Pay at hospital.` : (e?.message || 'Google Pay failed.'));
    } finally {
      setBusy(false);
    }
  };

  const beforePay = (): boolean => {
    const v = validate();
    if (v) { setErr(v); return false; }
    setErr(null);
    return true;
  };

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 max-w-lg mx-auto w-full space-y-4 pb-[min(36rem,calc(100dvh-5rem))]">
      <button onClick={() => nav(-1)}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition">
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* Doctor hero */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: dept.gradient }} />
        <div className="relative flex gap-3">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: `linear-gradient(135deg, ${doctor.avatarTint}35, ${doctor.avatarTint}12)` }}
          >
            <span>{doctor.avatarEmoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px] font-black text-white uppercase tracking-wider"
                style={{ background: dept.gradient }}
              >
                {dept.icon} {dept.name}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white/70">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                {doctor.rating.toFixed(1)}
                <span className="text-white/30 font-medium"> · {doctor.reviewsCount.toLocaleString()}</span>
              </span>
            </div>
            <div className="text-base font-black text-white leading-tight">{doctor.name}</div>
            <div className="text-[11px] text-white/55">{doctor.title}</div>
            <div className="text-[10px] text-white/35 mt-0.5">{doctor.qualifications}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric icon={<Clock className="h-3.5 w-3.5 text-sky-300" />}    label="Experience" value={`${doctor.experienceYears} yrs`} />
          <Metric icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />} label="Booked" value={doctor.bookingsCount.toLocaleString()} />
          <Metric icon={<IndianRupee className="h-3.5 w-3.5 text-amber-300" />}   label="Fee" value={`₹${doctor.feeRupees}`} />
        </div>
      </div>

      {/* About doctor */}
      <Panel title="About the doctor">
        <p className="text-[12px] text-white/65 leading-relaxed">{doctor.bio}</p>
        <div className="mt-3 grid gap-1.5 text-[11px] text-white/55">
          <Row icon={<Clock className="h-3.5 w-3.5 text-sky-300" />} text={doctor.consultingHours} />
          <Row icon={<Globe className="h-3.5 w-3.5 text-emerald-300" />} text={doctor.languages.join(' · ')} />
        </div>
      </Panel>

      {/* Hospital */}
      <Panel title="Hospital">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black text-white truncate">{hospital.name}</div>
            <div className="text-[10px] text-white/45 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{hospital.address}</span>
            </div>
          </div>
          {hospital.phone && (
            <a
              href={`tel:${hospital.phone.replace(/\s+/g, '')}`}
              className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-full bg-white/[0.06] text-[10px] font-bold text-white/70 hover:bg-white/[0.1]"
            >
              <Phone className="h-3 w-3" /> Call
            </a>
          )}
        </div>
      </Panel>

      {/* Chief complaint first. Stays above the fixed pay bar when scrolling */}
      <Panel title="Tell the doctor">
        <p className="text-[11px] text-white/45 mb-2 leading-relaxed">
          Symptoms, how long it&apos;s been going on, and anything urgent. This is shared with the doctor before your visit.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. tight chest since morning, mild fever 2 days, knee pain after a fall…"
          className="w-full min-h-[6.5rem] rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/15 transition resize-y"
        />
      </Panel>

      {/* Slot picker */}
      <Panel title="Pick a slot">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
          {slotsByDay.map(([day]) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={[
                'shrink-0 h-9 rounded-full px-3 text-[11px] font-black transition border',
                day === selectedDay
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-white/[0.03] text-white/60 border-white/[0.08] hover:bg-white/[0.06]',
              ].join(' ')}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {daySlots.length === 0 && (
            <div className="w-full text-center rounded-2xl border border-dashed border-white/10 py-5 text-[11px] text-white/35">
              No more slots on this day
            </div>
          )}
          {daySlots.map((s) => {
            const active = s.key === selectedKey;
            return (
              <button
                key={s.key}
                onClick={() => setSelectedKey(s.key)}
                className={[
                  'h-9 rounded-full px-3 text-[11px] font-bold transition',
                  active
                    ? 'bg-emerald-500 text-black shadow-[0_0_18px_rgba(16,185,129,0.4)]'
                    : 'bg-white/[0.04] text-white/65 border border-white/[0.06] hover:bg-white/[0.08]',
                ].join(' ')}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Errors / success */}
      {err && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <span className="text-xs text-red-200">{err}</span>
        </motion.div>
      )}
      {ok && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-200 font-bold">{ok}</span>
        </motion.div>
      )}

      {/* Sticky confirm bar. Max-height + scroll so small screens / tall docks never cover the form */}
      <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-white/[0.06] bg-[#0a0b0f]/95 backdrop-blur-md shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
        <div className="max-w-lg mx-auto px-4 py-2.5 max-h-[min(52vh,22rem)] overflow-y-auto overscroll-contain space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {selectedSlot ? (
                <>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Selected</div>
                  <div className="text-xs text-white truncate">
                    <span className="font-black">{selectedSlot.label}</span>
                    <span className="text-white/40"> · {selectedSlot.dateLabel}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Step 3 of 3</div>
                  <div className="text-xs text-white/50">Select a slot to continue</div>
                </>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Total</div>
              <div className="text-base font-black text-white">₹{doctor.feeRupees}</div>
            </div>
          </div>

          <div onClickCapture={(e) => { if (!beforePay()) { e.preventDefault(); e.stopPropagation(); } }}>
            <GooglePayButton
              amountRupees={doctor.feeRupees}
              label={`${doctor.name} · ${dept.name} consultation`}
              disabled={busy || !selectedSlot || !reason.trim()}
              onSuccess={onGpaySuccess}
              onError={(e) => setErr(e.message)}
              onCancel={() => setErr('Payment cancelled. You can try again or pay at the hospital.')}
              fallbackLabel={busy ? 'Booking…' : `Pay ₹${doctor.feeRupees}`}
              onFallback={onPayLater}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] text-white/45">
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
              Secured by Google Pay
            </span>
            <button
              type="button"
              onClick={onPayLater}
              disabled={busy || !selectedSlot || !reason.trim()}
              className="text-[10px] font-black text-white/55 hover:text-white/80 disabled:opacity-30 underline underline-offset-2 shrink-0"
            >
              Pay at hospital
            </button>
          </div>

          <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 group">
            <summary className="text-[10px] font-black text-white/50 cursor-pointer list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>More payment options (testing)</span>
              <span className="text-white/30 group-open:rotate-180 transition text-xs">▼</span>
            </summary>
            <div className="mt-2 space-y-2 pb-1">
              <button
                type="button"
                onClick={onPayWithGooglePay}
                disabled={busy || !selectedSlot || !reason.trim()}
                className="w-full h-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-black text-emerald-200 hover:bg-emerald-500/15 transition active:scale-[0.99] disabled:opacity-35"
              >
                Pay with Google Pay (API flow)
              </button>
              <button
                type="button"
                onClick={onMockGooglePay}
                disabled={busy || !selectedSlot || !reason.trim()}
                className="w-full h-10 rounded-2xl border border-sky-500/35 bg-sky-500/10 text-[11px] font-black text-sky-200 hover:bg-sky-500/15 transition active:scale-[0.99] disabled:opacity-35"
              >
                Demo: simulate Google Pay (no real charge)
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4">
    <div className="text-[10px] font-black uppercase tracking-widest text-white/45 mb-2.5">{title}</div>
    {children}
  </section>
);

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-center">
    <div className="flex items-center justify-center mb-0.5">{icon}</div>
    <div className="text-xs font-black text-white">{value}</div>
    <div className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">{label}</div>
  </div>
);

const Row = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-start gap-2">
    <span className="mt-0.5 shrink-0">{icon}</span>
    <span>{text}</span>
  </div>
);
