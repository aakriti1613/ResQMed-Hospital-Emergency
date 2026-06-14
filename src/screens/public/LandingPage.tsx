import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
  Siren, HandHeart, Stethoscope, CalendarCheck2, FolderHeart, Trophy, ShieldCheck,
  Sparkles, MapPin, ChevronRight, Clock, Heart, Phone, Smartphone, Download, X,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

// Public Google Drive folder containing the Android APK build.
// Update this in one place when a newer build is uploaded.
const APK_DOWNLOAD_URL =
  'https://drive.google.com/drive/folders/1lcX9y4pkPlJKCTaNreWLOFRCKlNniMSS?usp=drive_link';

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

const FEATURE_ICONS = [
  { icon: Siren, tint: '#ef4444' },
  { icon: HandHeart, tint: '#3b82f6' },
  { icon: Stethoscope, tint: '#10b981' },
  { icon: CalendarCheck2, tint: '#f59e0b' },
  { icon: FolderHeart, tint: '#ec4899' },
  { icon: Trophy, tint: '#8b5cf6' },
  { icon: ShieldCheck, tint: '#14b8a6' },
  { icon: MapPin, tint: '#6366f1' },
  { icon: Heart, tint: '#d946ef' },
] as const;

const STEP_NUMS = ['01', '02', '03'] as const;

export const LandingPage = () => {
  const nav = useNavigate();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { scrollYProgress, scrollY } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 30, mass: 0.5 });
  const heroParallaxY = useTransform(scrollY, [0, 500], [0, -24]);

  const featureList = t('landing.featureList', { returnObjects: true }) as { title: string; desc: string }[];
  const steps = t('landing.steps', { returnObjects: true }) as { title: string; desc: string }[];
  const emergencyBullets = t('landing.emergencyBullets', { returnObjects: true }) as string[];
  const careBullets = t('landing.careBullets', { returnObjects: true }) as string[];

  const sosRedirect = '/login?redirect=' + encodeURIComponent('/app/sos?from=landing');

  // Origin-story modal. Also opens on /#/safety/why-we-built-this hash
  const [originOpen, setOriginOpen] = useState(false);
  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash.includes('why-we-built-this')) setOriginOpen(true);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  useEffect(() => {
    if (!originOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOriginOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [originOpen]);

  return (
    <div className="min-h-dvh bg-[#0a0b0f] overflow-x-hidden text-white">
      <motion.div
        aria-hidden
        className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left"
        style={{
          scaleX: progress,
          background: 'linear-gradient(90deg, rgba(239,68,68,0.9), rgba(16,185,129,0.85), rgba(59,130,246,0.85))',
        }}
      />

      <motion.header
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-30 bg-[#0a0b0f]/70 backdrop-blur-xl border-b border-white/[0.05]"
      >
        <div className="max-w-lg mx-auto px-4 py-2 min-h-14 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.06, rotate: -4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 16px rgba(220,38,38,0.4)' }}
            >
              <Siren className="h-4 w-4" />
            </motion.div>
            <span className="text-sm font-black tracking-tight group-hover:text-white/90 transition">Aarogya Raksha</span>
          </Link>
          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageSwitcher compact />
            <a
              href={APK_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={t('landing.getAppTitle')}
              className="inline-flex h-8 shrink-0 px-2.5 rounded-full text-[10px] font-black text-sky-200/90 hover:text-white border border-sky-500/25 bg-sky-500/10 hover:bg-sky-500/15 items-center transition gap-1"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{t('landing.getApp')}</span>
            </a>
            <Link to="/login" className="h-8 px-2.5 rounded-full text-[10px] font-black text-white/70 hover:text-white hover:bg-white/[0.06] flex items-center transition">
              {t('landing.login')}
            </Link>
            <Link to="/signup"
              className="h-8 px-2.5 rounded-full text-[10px] font-black text-white flex items-center transition active:scale-95"
              style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 16px rgba(220,38,38,0.35)' }}>
              {t('landing.signup')}
            </Link>
          </div>
        </div>
      </motion.header>

      <section className="relative px-4 pt-8 pb-12 max-w-lg mx-auto overflow-hidden">
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.10) 0%, transparent 55%)' }} />
        <motion.div
          style={reduceMotion ? undefined : { y: heroParallaxY }}
          className="relative grid grid-cols-1 gap-6 items-center"
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
              <span className="text-[10px] font-black tracking-widest text-emerald-300">{t('landing.liveBadge')}</span>
            </motion.div>
            <h1 className="text-[2.1rem] sm:text-[2.3rem] font-black leading-[1.08] tracking-tight">
              <Trans
                i18nKey="landing.heroTitle"
                components={{
                  1: (
                    <motion.span
                      className="text-red-400 inline-block"
                      initial={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                      transition={{ delay: 0.15, duration: 0.45 }}
                    />
                  ),
                  2: (
                    <motion.span
                      className="text-emerald-300 inline-block"
                      initial={reduceMotion ? undefined : { opacity: 0, x: 8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                      transition={{ delay: 0.22, duration: 0.45 }}
                    />
                  ),
                  3: <br />,
                }}
              />
            </h1>
            <p className="mt-4 text-sm text-white/55 max-w-lg leading-relaxed">
              {t('landing.heroDesc')}
            </p>

            {/* Helmet hero. Compact, framed, captioned. The "this is the thing
                we built" anchor for the page. */}
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative mt-5 rounded-3xl overflow-hidden border border-white/[0.08] bg-black/40 aspect-video"
            >
              <img
                src="/helmet.png"
                alt="Aarogya Helmet One. ESP32-based smart helmet with MPU6050 crash detection, GPS and GSM"
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-white">Working Prototype</span>
              </div>
              <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/65">Aarogya Helmet One</div>
                  <div className="text-[13px] font-black text-white truncate">ESP32 · MPU6050 · GPS · GSM</div>
                </div>
                <div className="shrink-0 text-[10px] font-black text-white/75 rounded-full bg-white/10 border border-white/15 px-2 py-0.5">
                  Auto crash detect
                </div>
              </div>
            </motion.div>

            <motion.div
              className="mt-5 grid grid-cols-1 gap-2"
              initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.45 }}
            >
              <motion.button
                whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => nav(sosRedirect)}
                className="h-12 w-full px-5 rounded-full flex items-center justify-center gap-2 text-sm font-black transition"
                style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 24px rgba(220,38,38,0.45)' }}
              >
                <Siren className="h-4 w-4" /> {t('landing.needHelp')}
              </motion.button>
              <motion.button
                whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => nav('/login?redirect=/app/care')}
                className="h-12 w-full px-5 rounded-full flex items-center justify-center gap-2 text-sm font-black transition"
                style={{ background: 'linear-gradient(135deg,#10b981,#047857)', boxShadow: '0 0 24px rgba(16,185,129,0.35)' }}
              >
                <Stethoscope className="h-4 w-4" /> {t('landing.bookDoctor')}
              </motion.button>
              <motion.button
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => nav('/login?redirect=/app/help')}
                className="h-12 w-full px-5 rounded-full flex items-center justify-center gap-2 text-sm font-black bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] transition"
              >
                <HandHeart className="h-4 w-4" /> {t('landing.icanHelp')}
              </motion.button>
              <motion.a
                href={APK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className="h-12 w-full px-5 rounded-full inline-flex items-center justify-center gap-2 text-sm font-black bg-sky-500/15 border border-sky-400/30 text-sky-100 hover:bg-sky-500/25 transition"
              >
                <Download className="h-4 w-4" /> {t('landing.getTheApp')}{' '}
                <span className="text-[10px] font-bold text-sky-200/70">{t('landing.noLogin')}</span>
              </motion.a>
            </motion.div>

            <div className="mt-6 grid grid-cols-1 gap-2 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {t('landing.trustSos')}</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {t('landing.trustVault')}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {t('landing.trustMaps')}</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <motion.section
        className="px-4 pb-12 max-w-lg mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={blockReveal}
      >
        <div className="text-center mb-8">
          <div className="text-[10px] font-black tracking-widest text-white/45 uppercase">{t('landing.pillarsEyebrow')}</div>
          <h2 className="mt-1 text-2xl font-black">{t('landing.pillarsTitle')}</h2>
          <p className="mt-2 text-sm text-white/45 max-w-xl mx-auto">{t('landing.pillarsDesc')}</p>
        </div>

        <div className="grid gap-3">
          <PillarCard
            tint="#ef4444"
            title={t('landing.emergencyTitle')}
            subtitle={t('landing.emergencySubtitle')}
            bullets={emergencyBullets}
            cta={t('landing.emergencyCta')}
            onCta={() => nav(sosRedirect)}
            icon={<Siren className="h-6 w-6" />}
          />
          <PillarCard
            tint="#10b981"
            title={t('landing.careTitle')}
            subtitle={t('landing.careSubtitle')}
            bullets={careBullets}
            cta={t('landing.careCta')}
            onCta={() => nav('/login?redirect=/app/care')}
            icon={<Stethoscope className="h-6 w-6" />}
          />
        </div>
      </motion.section>

      <motion.section
        className="px-4 pb-12 max-w-lg mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.08 }}
        variants={blockReveal}
      >
        <div className="mb-6">
          <div className="text-[10px] font-black tracking-widest text-white/45 uppercase">{t('landing.featuresEyebrow')}</div>
          <h2 className="mt-1 text-2xl font-black">{t('landing.featuresTitle')}</h2>
        </div>
        <motion.div
          className="grid grid-cols-1 gap-2"
          variants={gridParent}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {FEATURE_ICONS.map((f, i) => (
            <FeatureCard
              key={i}
              icon={<f.icon className="h-5 w-5" />}
              title={featureList[i]?.title ?? ''}
              desc={featureList[i]?.desc ?? ''}
              tint={f.tint}
            />
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        className="px-4 pb-12 max-w-lg mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
        variants={blockReveal}
      >
        <div className="mb-6">
          <div className="text-[10px] font-black tracking-widest text-white/45 uppercase">{t('landing.howEyebrow')}</div>
          <h2 className="mt-1 text-2xl font-black">{t('landing.howTitle')}</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {STEP_NUMS.map((n, i) => (
            <Step
              key={n}
              n={n}
              stepLabel={t('landing.stepLabel', { n })}
              title={steps[i]?.title ?? ''}
              desc={steps[i]?.desc ?? ''}
            />
          ))}
        </div>
      </motion.section>

      <section id="download-app" className="px-4 pb-12 max-w-lg mx-auto scroll-mt-24">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-[2rem] overflow-hidden border border-white/[0.08] bg-[#13141a] p-5"
        >
          <div className="absolute inset-0 pointer-events-none opacity-90"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(16,185,129,0.1) 45%, rgba(220,38,38,0.08) 100%)' }} />
          <div className="absolute -top-20 right-0 h-56 w-56 rounded-full blur-3xl pointer-events-none bg-emerald-500/20" />
          <div className="relative flex flex-col gap-5">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 mb-3">
                <Smartphone className="h-3.5 w-3.5 text-sky-300" />
                <span className="text-[10px] font-black tracking-widest text-white/70 uppercase">{t('landing.downloadBadge')}</span>
              </div>
              <h2 className="text-2xl font-black leading-tight">{t('landing.downloadTitle')}</h2>
              <p className="mt-2 text-sm text-white/55 max-w-lg leading-relaxed">
                {t('landing.downloadDesc')}{' '}
                <strong className="text-white/80">{t('landing.downloadPwa')}</strong>.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full">
              <a
                href={APK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 w-full px-5 rounded-2xl flex items-center justify-center gap-2 text-sm font-black bg-white text-slate-950 hover:bg-white/95 transition active:scale-[0.98]"
              >
                <Download className="h-4 w-4" /> {t('landing.webManifest')}
              </a>
              <button
                type="button"
                onClick={() => nav('/signup')}
                className="h-12 w-full px-5 rounded-2xl flex items-center justify-center gap-2 text-sm font-black border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition active:scale-[0.98]"
              >
                {t('landing.openInBrowser')} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="relative mt-4 text-[11px] text-white/40">
            <strong className="text-white/55">{t('landing.installAndroid')}</strong> {t('landing.installAndroidSteps')}
            <span className="mx-2 text-white/25">·</span>
            <strong className="text-white/55">{t('landing.installIos')}</strong> {t('landing.installIosSteps')}
          </p>
        </motion.div>
      </section>

      <motion.section
        className="px-4 pb-14 max-w-lg mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={blockReveal}
      >
        <div className="relative rounded-3xl overflow-hidden p-5 border border-white/[0.06] bg-[#13141a]">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 20% 30%, rgba(220,38,38,0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(16,185,129,0.18) 0%, transparent 55%)' }} />
          <div className="relative grid grid-cols-1 gap-5 items-center">
            <div>
              <div className="text-[10px] font-black tracking-widest text-white/50 uppercase">{t('landing.joinEyebrow')}</div>
              <h3 className="mt-1 text-2xl font-black leading-tight">{t('landing.joinTitle')}</h3>
              <p className="mt-2 text-sm text-white/50 max-w-md">{t('landing.joinDesc')}</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => nav('/signup')}
                className="h-12 rounded-full text-sm font-black transition active:scale-95"
                style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 24px rgba(220,38,38,0.45)' }}
              >
                {t('landing.createFreeAccount')}
              </button>
              <Link
                to="/login"
                className="h-12 rounded-full flex items-center justify-center text-sm font-black bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] transition active:scale-95"
              >
                {t('landing.haveAccount')}
              </Link>
              <div className="mt-2 text-center text-[11px] text-white/35">
                {t('landing.emergencyCall')}{' '}
                <a href="tel:112" className="text-white/80 underline underline-offset-2">112</a>
                {' '}({t('landing.emergency')}) ·
                <a href="tel:108" className="text-white/80 underline underline-offset-2 ml-1">108</a> ({t('landing.ambulance')}).
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <footer className="border-t border-white/[0.06] py-6">
        <div className="max-w-lg mx-auto px-4 flex flex-col items-center text-center gap-3">
          <div className="text-[11px] text-white/35">© {new Date().getFullYear()} Aarogya Raksha · {t('landing.footerBuilt')}</div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-white/35">
            <a href={APK_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-sky-300 font-semibold text-white/50">
              <Download className="h-3 w-3" /> {t('landing.footerApp')}
            </a>
            <button
              type="button"
              onClick={() => setOriginOpen(true)}
              className="inline-flex items-center gap-1 hover:text-rose-300 font-semibold text-white/50"
            >
              <Heart className="h-3 w-3" /> {t('landing.originLink')}
            </button>
            <a href="tel:112" className="inline-flex items-center gap-1 hover:text-white/60"><Phone className="h-3 w-3" /> 112</a>
            <a href="tel:108" className="inline-flex items-center gap-1 hover:text-white/60"><Phone className="h-3 w-3" /> 108</a>
            <Link to="/signup" className="hover:text-white/60">{t('landing.footerGetStarted')}</Link>
          </div>
        </div>
      </footer>

      {/* Origin-story modal. The slide-2 hook on demand. */}
      <AnimatePresence>
        {originOpen && (
          <motion.div
            key="origin-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-4"
            onClick={() => setOriginOpen(false)}
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6 sm:p-7 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="origin-quote"
            >
              <button
                type="button"
                onClick={() => setOriginOpen(false)}
                aria-label={t('landing.originClose')}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center transition active:scale-95"
              >
                <X className="h-4 w-4 text-white/70" />
              </button>

              <div className="text-[14px] font-black tracking-widest text-red-400">
                {t('landing.originBadgeYear')}
              </div>
              <div className="mt-1 text-[10px] font-black tracking-[0.25em] text-white/45">
                {t('landing.originEyebrow')}
              </div>

              <p
                id="origin-quote"
                className="mt-5 text-[20px] sm:text-[22px] leading-[1.35] italic font-serif text-white"
                style={{ fontFamily: 'Cambria, Georgia, "Times New Roman", serif' }}
              >
                “{t('landing.originQuote')}”
              </p>

              <div className="mt-5 text-[12px] text-white/55">
                {t('landing.originAuthor')}
              </div>
              <div className="mt-5 pt-4 border-t border-white/[0.08] text-[13px] font-black text-white">
                {t('landing.originClosing')}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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

const Step = ({ n, stepLabel, title, desc }: { n: string; stepLabel: string; title: string; desc: string }) => (
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
      <div className="text-[10px] font-black tracking-widest text-white/45 uppercase">{stepLabel}</div>
      <div className="mt-1 text-base font-black text-white">{title}</div>
      <p className="mt-1 text-[12px] text-white/55 leading-relaxed">{desc}</p>
      <Sparkles className="h-4 w-4 text-white/20 mt-3" />
    </div>
  </motion.div>
);
