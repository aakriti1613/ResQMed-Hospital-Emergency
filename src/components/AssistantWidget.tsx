import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Send, CalendarPlus, Pill, HelpCircle, Sparkles,
  Stethoscope, ChevronLeft, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import {
  askAssistant, ASSISTANT_NAME,
  type AssistantMessage, type AssistantContext,
} from '../data/assistant';
import {
  listAppointments, createAppointment, type Appointment,
} from '../data/appointments';
import {
  DEPARTMENTS, getDepartment, getShowcaseDoctorsForDept, generateSlots,
  SHOWCASE_HOSPITAL, type Doctor, type Slot,
} from '../data/hospitals';
import { getUserProfile, computeAgeFromDob } from '../data/user';

// Routes where the floating companion should NOT appear (full-screen / staff).
const HIDDEN_PREFIXES = ['/app/sos', '/hospital', '/doctor', '/admin'];

type ChatItem =
  | { id: string; kind: 'text'; role: 'user' | 'model'; text: string }
  | { id: string; kind: 'booking' }
  | { id: string; kind: 'prescriptions'; data: Appointment[] };

let idSeq = 0;
const uid = () => `m${Date.now()}_${idSeq++}`;

export const AssistantWidget = () => {
  const { user } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState<string | undefined>();
  const [prescriptions, setPrescriptions] = useState<Appointment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hidden = HIDDEN_PREFIXES.some((p) => loc.pathname.startsWith(p));
  const onApp = loc.pathname.startsWith('/app');

  // History (text-only) sent to the model.
  const history = useMemo<AssistantMessage[]>(
    () => items.filter((i): i is Extract<ChatItem, { kind: 'text' }> => i.kind === 'text')
      .map((i) => ({ role: i.role, text: i.text })),
    [items],
  );

  const ctx: AssistantContext = useMemo(
    () => ({ userName: profileName?.split(' ')[0], prescriptions }),
    [profileName, prescriptions],
  );

  // Load profile + prescriptions when the panel first opens (for context + cards).
  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    (async () => {
      try {
        const [profile, appts] = await Promise.all([
          getUserProfile(user.uid),
          listAppointments(user.uid),
        ]);
        if (!active) return;
        if (profile?.name) setProfileName(profile.name);
        setPrescriptions(appts.filter((a) => a.status === 'completed'));
      } catch { /* best-effort */ }
    })();
    return () => { active = false; };
  }, [open, user]);

  // Seed the greeting the first time the panel opens.
  useEffect(() => {
    if (open && items.length === 0) {
      setItems([{
        id: uid(), kind: 'text', role: 'model',
        text: `Hi${profileName ? ` ${profileName.split(' ')[0]}` : ''}! 🌸 I'm ${ASSISTANT_NAME}, your health companion. I can help you **book an appointment**, understand **your medicines & prescriptions**, or answer anything about the app. How are you feeling today?`,
      }]);
    }
  }, [open, items.length, profileName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, busy]);

  const push = (item: ChatItem) => setItems((prev) => [...prev, item]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    push({ id: uid(), kind: 'text', role: 'user', text });
    setBusy(true);
    try {
      const res = await askAssistant(history, text, ctx);
      push({ id: uid(), kind: 'text', role: 'model', text: res.text });
    } catch {
      push({ id: uid(), kind: 'text', role: 'model', text: 'Sorry, I had trouble responding just now. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const startBooking = (seedSymptom?: string) => {
    if (seedSymptom) push({ id: uid(), kind: 'text', role: 'user', text: seedSymptom });
    push({ id: uid(), kind: 'text', role: 'model', text: `Let's find you the right care. Pick a department below 👇` });
    push({ id: uid(), kind: 'booking' });
  };

  const showPrescriptions = () => {
    push({ id: uid(), kind: 'text', role: 'user', text: 'Show my prescriptions' });
    const withRx = prescriptions.filter((a) => a.prescription || a.diagnosis || a.advice);
    if (withRx.length === 0) {
      push({ id: uid(), kind: 'text', role: 'model', text: `You don't have a completed visit with a prescription yet. After a doctor completes your visit, the summary appears here and under **Appointments → Past**. 💙` });
    } else {
      push({ id: uid(), kind: 'text', role: 'model', text: `Here are your recent visit summaries. Tap a card and ask me to explain any medicine in simple words. 💊` });
      push({ id: uid(), kind: 'prescriptions', data: withRx });
    }
  };

  if (hidden) return null;

  return (
    <>
      {/* Floating companion button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            aria-label={`Open ${ASSISTANT_NAME}, your health companion`}
            className="fixed right-4 z-40 flex items-center gap-2 rounded-full pl-2 pr-4 py-2 text-white shadow-[0_8px_30px_rgba(16,185,129,0.45)] active:scale-95 transition"
            style={{
              bottom: onApp ? 'calc(5.5rem + env(safe-area-inset-bottom,0px))' : '1.25rem',
              background: 'linear-gradient(135deg,#10b981,#0891b2)',
            }}
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">
              🩺
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-300 border-2 border-emerald-600" />
            </span>
            <span className="text-sm font-black">Ask {ASSISTANT_NAME}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg h-[86dvh] flex flex-col rounded-t-3xl border border-white/10 bg-[#0c0d12] overflow-hidden"
            >
              {/* Header */}
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#12131a]">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>🩺</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-white flex items-center gap-1.5">{ASSISTANT_NAME} <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></div>
                  <div className="text-[10px] text-white/45 uppercase tracking-widest">Your health companion</div>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {items.map((it) => {
                  if (it.kind === 'text') return <Bubble key={it.id} role={it.role} text={it.text} />;
                  if (it.kind === 'booking') return <BookingCard key={it.id} user={user} profileName={profileName} onDone={(msg) => push({ id: uid(), kind: 'text', role: 'model', text: msg })} />;
                  if (it.kind === 'prescriptions') return <PrescriptionCards key={it.id} data={it.data} onAsk={(q) => send(q)} />;
                  return null;
                })}
                {busy && (
                  <div className="flex items-center gap-2 text-white/50 text-xs pl-1">
                    <span className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 rounded-full bg-emerald-400/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 rounded-full bg-emerald-400/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    {ASSISTANT_NAME} is typing…
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="shrink-0 px-3 pt-2 flex gap-2 overflow-x-auto no-scrollbar">
                <Chip icon={<CalendarPlus className="h-3.5 w-3.5" />} label="Book appointment" onClick={() => startBooking()} />
                <Chip icon={<Pill className="h-3.5 w-3.5" />} label="My prescriptions" onClick={showPrescriptions} />
                <Chip icon={<HelpCircle className="h-3.5 w-3.5" />} label="About the app" onClick={() => send('What can this app do?')} />
              </div>

              {/* Composer */}
              <div className="shrink-0 p-3 pt-2">
                <form
                  onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    rows={1}
                    placeholder={`Message ${ASSISTANT_NAME}…`}
                    className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/30 outline-none max-h-24"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || busy}
                    className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition"
                    style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                <p className="mt-1.5 text-center text-[9px] text-white/30">{ASSISTANT_NAME} gives general guidance, not a diagnosis. For emergencies use SOS or call 112.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ── Message bubble with light markdown (bold, bullets, line breaks) ──────────
const Bubble = ({ role, text }: { role: 'user' | 'model'; text: string }) => {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser ? 'bg-emerald-500/90 text-white rounded-br-md' : 'bg-white/[0.05] text-white/90 border border-white/[0.06] rounded-bl-md'
      }`}>
        {renderRich(text)}
      </div>
    </div>
  );
};

function renderRich(text: string) {
  return text.split('\n').map((line, i) => {
    const bullet = /^\s*[•\-]\s+/.test(line);
    const content = line.replace(/^\s*[•\-]\s+/, '');
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      /^\*\*[^*]+\*\*$/.test(seg)
        ? <strong key={j} className="font-black">{seg.slice(2, -2)}</strong>
        : <span key={j}>{seg}</span>,
    );
    return (
      <div key={i} className={bullet ? 'flex gap-1.5' : undefined}>
        {bullet && <span className="text-emerald-300 shrink-0">•</span>}
        <span>{parts}</span>
      </div>
    );
  });
}

const Chip = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/75 hover:bg-white/[0.08] transition">
    {icon}{label}
  </button>
);

// ── In-chat appointment booking ──────────────────────────────────────────────
const BookingCard = ({ user, profileName, onDone }: {
  user: ReturnType<typeof useAuth>['user'];
  profileName?: string;
  onDone: (msg: string) => void;
}) => {
  const [step, setStep] = useState<'dept' | 'doctor' | 'slot' | 'done'>('dept');
  const [dept, setDept] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slots = useMemo<Slot[]>(() => generateSlots({ days: 3, startHour: 9, endHour: 19, stepMinutes: 60 }).slice(0, 8), []);
  const doctors = dept ? getShowcaseDoctorsForDept(dept) : [];

  const confirm = async (slot: Slot) => {
    if (!user || !doctor || !dept) { setErr('Please log in to book.'); return; }
    setBusy(true); setErr(null);
    try {
      let patientName = profileName; let patientAge: number | undefined; let patientBloodGroup: string | undefined;
      try {
        const p = await getUserProfile(user.uid);
        if (p) { patientName = p.name || patientName; patientAge = computeAgeFromDob(p.dob); patientBloodGroup = p.bloodGroup || undefined; }
      } catch { /* snapshot best-effort */ }
      const d = getDepartment(dept);
      await createAppointment({
        patientId: user.uid, doctorId: doctor.id, hospitalId: SHOWCASE_HOSPITAL.id,
        startAt: slot.start, endAt: slot.end, reason: `Booked via ${ASSISTANT_NAME}`,
        status: 'scheduled', doctorName: doctor.name, doctorAvatar: doctor.avatarEmoji,
        department: d.id, departmentName: d.name, hospitalName: SHOWCASE_HOSPITAL.name,
        patientName, patientAge, patientBloodGroup,
        feeRupees: doctor.feeRupees, paymentStatus: 'unpaid', paymentMethod: 'cash',
      });
      setStep('done');
      onDone(`✅ Booked! **${doctor.name}** (${d.name}) on **${slot.dateLabel} at ${slot.label}**. You can pay at the hospital or from Appointments. Take care! 💙`);
    } catch (e: any) {
      setErr(e?.message || 'Could not book. Please try the Care tab.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 flex items-center gap-2 text-emerald-200 text-sm font-bold">
        <CheckCircle2 className="h-4 w-4" /> Appointment confirmed
        <Link to="/app/appointments" className="ml-auto text-[11px] underline underline-offset-2">View</Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-2.5">
      {step === 'dept' && (
        <>
          <Head icon={<Stethoscope className="h-3.5 w-3.5" />} title="Choose a department" />
          <div className="grid grid-cols-2 gap-2">
            {DEPARTMENTS.slice(0, 8).map((d) => (
              <button key={d.id} onClick={() => { setDept(d.id); setStep('doctor'); }}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left hover:bg-white/[0.06] transition">
                <span className="text-lg">{d.icon}</span>
                <span className="text-[11px] font-bold text-white/80 leading-tight">{d.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'doctor' && (
        <>
          <BackHead onBack={() => setStep('dept')} title={`${getDepartment(dept!).name} doctors`} />
          <div className="space-y-2">
            {doctors.map((doc) => (
              <button key={doc.id} onClick={() => { setDoctor(doc); setStep('slot'); }}
                className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left hover:bg-white/[0.06] transition">
                <span className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: `${doc.avatarTint}22` }}>{doc.avatarEmoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black text-white truncate">{doc.name}</span>
                  <span className="block text-[10px] text-white/50 truncate">{doc.title} · ⭐ {doc.rating} · ₹{doc.feeRupees}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-white/30 shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'slot' && doctor && (
        <>
          <BackHead onBack={() => setStep('doctor')} title={`Pick a time · ${doctor.name}`} />
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <button key={s.key} disabled={busy} onClick={() => confirm(s)}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2 text-center hover:bg-emerald-500/15 hover:border-emerald-500/30 disabled:opacity-40 transition">
                <span className="block text-[10px] text-white/45">{s.dateLabel}</span>
                <span className="block text-xs font-black text-white">{s.label}</span>
              </button>
            ))}
          </div>
          {busy && <p className="text-[11px] text-emerald-300 font-bold">Booking…</p>}
        </>
      )}

      {err && <p className="text-[11px] text-red-300">{err}</p>}
      {!user && <p className="text-[11px] text-amber-300">Please log in to book an appointment.</p>}
    </div>
  );
};

const PrescriptionCards = ({ data, onAsk }: { data: Appointment[]; onAsk: (q: string) => void }) => (
  <div className="space-y-2">
    {data.slice(0, 4).map((a) => (
      <div key={a.id} className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-black text-white">{a.doctorName ?? 'Doctor'} · {a.departmentName ?? ''}</div>
          <div className="text-[10px] text-white/40">{a.startAt instanceof Date ? a.startAt.toLocaleDateString() : ''}</div>
        </div>
        {a.diagnosis && <RxLine label="Diagnosis" value={a.diagnosis} />}
        {a.prescription && <RxLine label="Prescription" value={a.prescription} />}
        {a.advice && <RxLine label="Advice" value={a.advice} />}
        {a.prescription && (
          <button onClick={() => onAsk(`Explain my prescription in simple words: ${a.prescription}`)}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/25 px-2.5 py-1 text-[10px] font-black text-sky-200 hover:bg-sky-500/25 transition">
            <Sparkles className="h-3 w-3" /> Explain in simple words
          </button>
        )}
      </div>
    ))}
  </div>
);

const RxLine = ({ label, value }: { label: string; value: string }) => (
  <div>
    <span className="text-[9px] font-black uppercase tracking-wider text-sky-300/80">{label}</span>
    <div className="text-[11px] text-white/80 leading-relaxed">{value}</div>
  </div>
);

const Head = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/45">{icon}{title}</div>
);

const BackHead = ({ onBack, title }: { onBack: () => void; title: string }) => (
  <div className="flex items-center gap-1.5">
    <button onClick={onBack} className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><ChevronLeft className="h-3.5 w-3.5 text-white/70" /></button>
    <span className="text-[10px] font-black uppercase tracking-widest text-white/45 truncate">{title}</span>
  </div>
);
