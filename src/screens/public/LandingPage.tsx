import { useNavigate, Link } from 'react-router-dom';
import {
  Siren, HandHeart, Stethoscope, CalendarCheck2, FolderHeart, Trophy, ShieldCheck,
  Sparkles, MapPin, ChevronRight, Clock, Heart, Phone, Smartphone, Download,
} from 'lucide-react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';

const blockReveal = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const gridParent = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055 } },
};

const gridChild = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export const LandingPage = () => {
  const nav = useNavigate();
  const reduceMotion = useReducedMotion();
  const { scrollYProgress, scrollY } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 30, mass: 0.5 });
  const heroParallaxY = useTransform(scrollY, [0, 500], [0, -24]);

  return (
    <div className="min-h-dvh bg-[#0a0b0f] overflow-x-hidden text-white">
      {/* Scroll progress (subtle) */}
      <motion.div
        aria-hidden
        className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left"
        style={{
          scaleX: progress,
          background: 'linear-gradient(90deg, rgba(239,68,68,0.9), rgba(16,185,129,0.85), rgba(59,130,246,0.85))',
        }}
      />

      {/* Top bar */}
      <motion.header
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-30 bg-[#0a0b0f]/70 backdrop-blur-xl border-b border-white/[0.05]"
      >
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.06, rotate: -4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 16px rgba(220,38,38,0.4)' }}
            >
              <Siren className="h-4 w-4" />
            </motion.div>
            <span className="text-sm font-black tracking-tight group-hover:text-white/90 transition">Arogya Raksha</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <a
              href="#download-app"
              title="Download app — no login required"
              className="inline-flex h-9 shrink-0 px-2.5 sm:px-3 rounded-full text-[11px] sm:text-xs font-black text-sky-200/90 hover:text-white border border-sky-500/25 bg-sky-500/10 hover:bg-sky-500/15 items-center transition gap-1"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">Get app</span>
            </a>
            <Link to="/login" className="h-9 px-3 rounded-full text-xs font-black text-white/70 hover:text-white hover:bg-white/[0.06] flex items-center transition">
              Log in
            </Link>
            <Link to="/signup"
              className="h-9 px-3.5 rounded-full text-xs font-black text-white flex items-center transition active:scale-95"
              style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 16px rgba(220,38,38,0.35)' }}>
              Sign up →
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="relative px-5 pt-10 pb-14 max-w-5xl mx-auto overflow-hidden">
        {!reduceMotion && (
          <>
            <motion.div
              aria-hidden
              className="absolute -left-20 top-20 h-64 w-64 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.22) 0%, transparent 70%)' }}
              animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.08, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              aria-hidden
              className="absolute -right-24 top-40 h-72 w-72 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)' }}
              animate={{ opacity: [0.45, 0.8, 0.45], scale: [1.05, 1, 1.05] }}
              transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            />
          </>
        )}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.10) 0%, transparent 55%)' }} />
        <motion.div
          style={reduceMotion ? undefined : { y: heroParallaxY }}
          className="relative grid md:grid-cols-2 gap-8 md:gap-10 items-center"
        >
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, scale: 0.92 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.08, duration: 0.45 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 mb-4"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black tracking-widest text-emerald-300">LIVE IN YOUR CITY</span>
            </motion.div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[1.05] tracking-tight">
              One app for every <motion.span
                className="text-red-400 inline-block"
                initial={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.45 }}
              >health emergency</motion.span> and every
              <motion.span
                className="text-emerald-300 inline-block"
                initial={reduceMotion ? undefined : { opacity: 0, x: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                transition={{ delay: 0.22, duration: 0.45 }}
              > hospital visit</motion.span>.
            </h1>
            <p className="mt-4 text-sm md:text-base text-white/55 max-w-lg leading-relaxed">
              Arogya Raksha is an Uber-for-hospitals that also summons nearby helpers the instant you
              raise an SOS. Book doctors by department, store prescriptions in your Health Vault, and
              earn points every time you rescue a neighbour — all from one clean interface.
            </p>

            <motion.div
              className="mt-6 flex flex-wrap gap-2"
              initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.45 }}
            >
              <motion.button
                whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => nav('/app/sos')}
                className="h-12 px-5 rounded-full flex items-center gap-2 text-sm font-black transition"
                style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 24px rgba(220,38,38,0.45)' }}
              >
                <Siren className="h-4 w-4" /> I need help now
              </motion.button>
              <motion.button
                whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => nav('/login?redirect=/app/care')}
                className="h-12 px-5 rounded-full flex items-center gap-2 text-sm font-black transition"
                style={{ background: 'linear-gradient(135deg,#10b981,#047857)', boxShadow: '0 0 24px rgba(16,185,129,0.35)' }}
              >
                <Stethoscope className="h-4 w-4" /> Book a doctor
              </motion.button>
              <motion.button
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => nav('/login?redirect=/app/help')}
                className="h-12 px-5 rounded-full flex items-center gap-2 text-sm font-black bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] transition"
              >
                <HandHeart className="h-4 w-4" /> Volunteer as helper
              </motion.button>
              <motion.a
                href="#download-app"
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className="h-12 px-5 rounded-full inline-flex items-center gap-2 text-sm font-black bg-sky-500/15 border border-sky-400/30 text-sky-100 hover:bg-sky-500/25 transition"
              >
                <Download className="h-4 w-4" /> Get the app <span className="text-[10px] font-bold text-sky-200/70">(no login)</span>
              </motion.a>
            </motion.div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> &lt; 10 s SOS dispatch</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> End-to-end encrypted vault</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Live Google Maps tracking</span>
            </div>
          </motion.div>

          {/* Right-side SOS visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative hidden md:flex items-center justify-center h-80"
          >
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/[0.06] bg-[#13141a] overflow-hidden">
              <div className="absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at 30% 30%, rgba(220,38,38,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(29,78,216,0.12) 0%, transparent 50%)' }} />
              <div className="relative h-full flex flex-col items-center justify-center p-8">
                <div className="relative h-40 w-40 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 0 12px rgba(220,38,38,0.1), 0 0 60px rgba(220,38,38,0.45)' }}>
                  <span className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-ping" style={{ animationDuration: '2s' }} />
                  <Siren className="h-16 w-16" strokeWidth={1.4} />
                </div>
                <div className="mt-6 w-full max-w-xs space-y-2">
                  <MiniRow label="📍 3 helpers nearby" tint="#10b981" />
                  <MiniRow label="🚑 Ambulance ETA · 4 min" tint="#f59e0b" />
                  <MiniRow label="📞 Contacts being notified" tint="#3b82f6" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Platform pillars */}
      <motion.section
        className="px-5 pb-16 max-w-5xl mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={blockReveal}
      >
        <div className="text-center mb-8">
          <div className="text-[10px] font-black tracking-widest text-white/45 uppercase">Two apps. One platform.</div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Emergency response + Hospital care</h2>
          <p className="mt-2 text-sm text-white/45 max-w-xl mx-auto">
            Built for Indian users. Hospital booking and emergency SOS are first-class citizens — not
            hidden behind menus.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <PillarCard
            tint="#ef4444"
            title="Emergency Response"
            subtitle="Uber-style SOS with live helper tracking"
            bullets={[
              'Auto crash detection + manual SOS',
              'Popup alerts on every nearby helper',
              'Live Google Maps ETA for helpers & ambulance',
              'Emergency contacts notified in real time',
            ]}
            cta="Try the SOS flow →"
            onCta={() => nav('/app/sos')}
            icon={<Siren className="h-6 w-6" />}
          />
          <PillarCard
            tint="#10b981"
            title="Hospital &amp; Doctor Booking"
            subtitle="Find a doctor by department, book in seconds"
            bullets={[
              '12 departments — Cardiology to Dental',
              'Nearby hospitals on Google Maps',
              'Partner hospital with curated doctor roster',
              'Prescription & report vault, synced',
            ]}
            cta="Browse doctors →"
            onCta={() => nav('/login?redirect=/app/care')}
            icon={<Stethoscope className="h-6 w-6" />}
          />
        </div>
      </motion.section>

      {/* Feature grid */}
      <motion.section
        className="px-5 pb-16 max-w-5xl mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.08 }}
        variants={blockReveal}
      >
        <div className="mb-6">
          <div className="text-[10px] font-black tracking-widest text-white/45 uppercase">What's inside</div>
          <h2 className="mt-1 text-2xl font-black">Everything you need, in one place</h2>
        </div>
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2"
          variants={gridParent}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <FeatureCard icon={<Siren className="h-5 w-5" />} title="Instant SOS" desc="One tap raises an alert to nearby volunteers + ambulances + emergency contacts." tint="#ef4444" />
          <FeatureCard icon={<HandHeart className="h-5 w-5" />} title="I-Can-Help popup" desc="Nearby helpers get a Rapido-style request popup, with distance, ETA and one-tap accept." tint="#3b82f6" />
          <FeatureCard icon={<Stethoscope className="h-5 w-5" />} title="Department finder" desc="Browse Cardio, Ortho, Derma and 9 more. See doctor credentials and fees upfront." tint="#10b981" />
          <FeatureCard icon={<CalendarCheck2 className="h-5 w-5" />} title="Real slots, real doctors" desc="Pick a day, a time, describe your symptoms and get a confirmed booking." tint="#f59e0b" />
          <FeatureCard icon={<FolderHeart className="h-5 w-5" />} title="Health Vault" desc="Upload prescriptions, lab reports and imaging. Access them anywhere, anytime." tint="#ec4899" />
          <FeatureCard icon={<Trophy className="h-5 w-5" />} title="Arogya points" desc="Earn 200 points per rescue. Unlock free appointments, discounts and community badges." tint="#8b5cf6" />
          <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="Built on Firebase" desc="Realtime Firestore, phone OTP auth and Google Maps — fast, secure, scalable." tint="#14b8a6" />
          <FeatureCard icon={<MapPin className="h-5 w-5" />} title="Live tracking" desc="Victims see their helper's marker approach on a live map — just like Uber / Rapido." tint="#6366f1" />
          <FeatureCard icon={<Heart className="h-5 w-5" />} title="Community-first" desc="Leaderboards celebrate the top rescuers in your city every month." tint="#d946ef" />
        </motion.div>
      </motion.section>

      {/* How it works */}
      <motion.section
        className="px-5 pb-16 max-w-5xl mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
        variants={blockReveal}
      >
        <div className="mb-6">
          <div className="text-[10px] font-black tracking-widest text-white/45 uppercase">How it works</div>
          <h2 className="mt-1 text-2xl font-black">From tap to care in 3 steps</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Step n="01" title="Sign up with your mobile"
            desc="One-time phone OTP. Add your emergency contacts and blood group."
          />
          <Step n="02" title="Pick your service"
            desc="Raise an SOS, book a doctor in any department, or upload a report."
          />
          <Step n="03" title="We handle the rest"
            desc="Helpers are notified. Bookings land in your appointments. Rewards stack up."
          />
        </div>
      </motion.section>

      {/* Download app */}
      <section id="download-app" className="px-5 pb-16 max-w-5xl mx-auto scroll-mt-24">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-[2rem] overflow-hidden border border-white/[0.08] bg-[#13141a] p-6 md:p-8"
        >
          <div className="absolute inset-0 pointer-events-none opacity-90"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(16,185,129,0.1) 45%, rgba(220,38,38,0.08) 100%)' }} />
          <div className="absolute -top-20 right-0 h-56 w-56 rounded-full blur-3xl pointer-events-none bg-emerald-500/20" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 mb-3">
                <Smartphone className="h-3.5 w-3.5 text-sky-300" />
                <span className="text-[10px] font-black tracking-widest text-white/70 uppercase">Get the app</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black leading-tight">Download Arogya Raksha</h2>
              <p className="mt-2 text-sm text-white/55 max-w-lg leading-relaxed">
                Install on your phone for faster SOS, offline-friendly shortcuts, and optional home-screen alerts.
                Store builds ship soon — for now use the web app as a <strong className="text-white/80">Progressive Web App</strong>.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full md:w-auto">
              <a
                href="/manifest.webmanifest"
                download="arogya-raksha.webmanifest"
                className="h-12 px-5 rounded-2xl flex items-center justify-center gap-2 text-sm font-black bg-white text-slate-950 hover:bg-white/95 transition active:scale-[0.98]"
              >
                <Download className="h-4 w-4" /> Web manifest
              </a>
              <button
                type="button"
                onClick={() => nav('/signup')}
                className="h-12 px-5 rounded-2xl flex items-center justify-center gap-2 text-sm font-black border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition active:scale-[0.98]"
              >
                Open in browser <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="relative mt-4 text-[11px] text-white/40">
            <strong className="text-white/55">Android / Chrome:</strong> Menu → Install app / Add to Home screen.
            <span className="mx-2 text-white/25">·</span>
            <strong className="text-white/55">iOS / Safari:</strong> Share → Add to Home Screen.
          </p>
        </motion.div>
      </section>

      {/* CTA */}
      <motion.section
        className="px-5 pb-20 max-w-5xl mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={blockReveal}
      >
        <div className="relative rounded-3xl overflow-hidden p-6 md:p-10 border border-white/[0.06] bg-[#13141a]">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 20% 30%, rgba(220,38,38,0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(16,185,129,0.18) 0%, transparent 55%)' }} />
          <div className="relative grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="text-[10px] font-black tracking-widest text-white/50 uppercase">Join Arogya Raksha</div>
              <h3 className="mt-1 text-2xl md:text-3xl font-black leading-tight">
                Your neighbourhood's safety net — and your doctor's waiting room — in the same app.
              </h3>
              <p className="mt-2 text-sm text-white/50 max-w-md">
                Whether you need instant emergency help or a routine check-up tomorrow morning, Arogya
                Raksha makes it effortless.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => nav('/signup')}
                className="h-12 rounded-full text-sm font-black transition active:scale-95"
                style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 24px rgba(220,38,38,0.45)' }}
              >
                Create free account
              </button>
              <Link
                to="/login"
                className="h-12 rounded-full flex items-center justify-center text-sm font-black bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] transition active:scale-95"
              >
                I already have an account
              </Link>
              <div className="mt-2 text-center text-[11px] text-white/35">
                In a real emergency, call <a href="tel:112" className="text-white/80 underline underline-offset-2">112</a>
                {' '}(Emergency) ·
                <a href="tel:108" className="text-white/80 underline underline-offset-2 ml-1">108</a> (Ambulance).
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6">
        <div className="max-w-5xl mx-auto px-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-white/35">© {new Date().getFullYear()} Arogya Raksha · Built with care</div>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[11px] text-white/35">
            <a href="/#download-app" className="inline-flex items-center gap-1 hover:text-sky-300 font-semibold text-white/50">
              <Download className="h-3 w-3" /> App
            </a>
            <a href="tel:112" className="inline-flex items-center gap-1 hover:text-white/60"><Phone className="h-3 w-3" /> 112</a>
            <a href="tel:108" className="inline-flex items-center gap-1 hover:text-white/60"><Phone className="h-3 w-3" /> 108</a>
            <Link to="/signup" className="hover:text-white/60">Get started →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────
const MiniRow = ({ label, tint }: { label: string; tint: string }) => (
  <div className="flex items-center gap-2 rounded-2xl bg-black/40 border border-white/[0.07] px-3 py-2 text-[11px] font-semibold">
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: tint }} />
    <span className="text-white/80">{label}</span>
  </div>
);

const PillarCard = ({
  tint, title, subtitle, bullets, cta, onCta, icon,
}: {
  tint: string; title: string; subtitle: string; bullets: string[];
  cta: string; onCta: () => void; icon: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 22 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.12 }}
    transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
    className="relative rounded-3xl border border-white/[0.07] bg-[#13141a] p-5 overflow-hidden"
  >
    <div className="absolute -top-14 -right-14 h-40 w-40 rounded-full opacity-25 blur-3xl pointer-events-none"
      style={{ background: tint }} />
    <div className="relative flex items-start gap-3 mb-3">
      <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: `linear-gradient(135deg, ${tint}, ${tint}80)`, boxShadow: `0 0 24px ${tint}55` }}>
        {icon}
      </div>
      <div>
        <div className="text-base font-black text-white">{title}</div>
        <div className="text-[11px] text-white/50 mt-0.5">{subtitle}</div>
      </div>
    </div>
    <ul className="space-y-1.5 text-[12px] text-white/65">
      {bullets.map((b) => (
        <li key={b} className="flex items-start gap-2">
          <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: tint }} />
          <span>{b}</span>
        </li>
      ))}
    </ul>
    <button
      onClick={onCta}
      className="relative mt-4 w-full h-10 rounded-full text-xs font-black text-white flex items-center justify-center gap-1 transition active:scale-95"
      style={{ background: `linear-gradient(135deg, ${tint}, ${tint}99)` }}
    >
      {cta}
    </button>
  </motion.div>
);

const FeatureCard = ({
  icon, title, desc, tint,
}: { icon: React.ReactNode; title: string; desc: string; tint: string }) => (
  <motion.div
    variants={gridChild}
    className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 hover:border-white/10 hover:bg-white/[0.035] transition"
    whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.14)' }}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center"
        style={{ background: `${tint}20`, color: tint }}>
        {icon}
      </div>
      <div className="text-sm font-black text-white">{title}</div>
    </div>
    <p className="text-[12px] text-white/55 leading-relaxed">{desc}</p>
  </motion.div>
);

const Step = ({ n, title, desc }: { n: string; title: string; desc: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-5 relative overflow-hidden"
  >
    <div className="text-[60px] font-black text-white/[0.05] absolute -top-4 -right-3 leading-none select-none">
      {n}
    </div>
    <div className="relative">
      <div className="text-[10px] font-black tracking-widest text-white/45 uppercase">Step {n}</div>
      <div className="mt-1 text-base font-black text-white">{title}</div>
      <p className="mt-1 text-[12px] text-white/55 leading-relaxed">{desc}</p>
      <Sparkles className="h-4 w-4 text-white/20 mt-3" />
    </div>
  </motion.div>
);
