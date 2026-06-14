import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Siren, Phone, AlertCircle, ArrowLeft, Stethoscope, FolderHeart, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth } from '../../firebase/client';
import { isDemoMode } from '../../app/env';
import { getUserProfile, isPhoneRegistered, registerPhoneIndex } from '../../data/user';
import { expireStaleSosForUser } from '../../data/sos';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

type Step = 'phone' | 'otp';

function validatePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) return 'Phone must be exactly 10 digits';
  if (!/^[6-9]/.test(digits)) return 'Number must start with 6, 7, 8, or 9';
  return null;
}

export const LoginPage = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const { t } = useTranslation();
  const searchParams = new URLSearchParams(loc.search);
  const redirectPath = searchParams.get('redirect') || '/app';
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const digits = phone.replace(/\D/g, '');
  const phoneError = digits.length > 0 ? validatePhone(digits) : null;

  const handleSendOtp = async () => {
    const err = validatePhone(digits);
    if (err) { setError(err); return; }
    setError(null);
    setBusy(true);

    // Demo only: pre-check localStorage. Firebase skips this — uses OTP + profile lookup
    // (phoneIndex may be missing for accounts created before that index existed).
    if (isDemoMode) {
      try {
        const registered = await isPhoneRegistered(digits);
        if (!registered) {
          setBusy(false);
          nav('/signup', {
            state: { phone: digits, fromLogin: true, redirect: redirectPath },
            replace: true,
          });
          return;
        }
      } catch {
        // fall through to demo OTP
      }
    }

    if (isDemoMode) {
      setStep('otp');
      setBusy(false);
      return;
    }

    try {
      const containerId = 'login-recaptcha-' + Date.now();
      const wrapper = document.getElementById('login-recaptcha-wrapper');
      if (wrapper) {
        wrapper.innerHTML = `<div id="${containerId}"></div>`;
      }

      if ((window as any).recaptchaVerifier) {
        try { (window as any).recaptchaVerifier.clear(); } catch (e) {}
        (window as any).recaptchaVerifier = undefined;
      }

      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
      });
      const confirmation = await signInWithPhoneNumber(auth, '+91' + digits, (window as any).recaptchaVerifier);
      setConfirmationResult(confirmation);
      setStep('otp');
    } catch (e: any) {
      setError(e?.message || 'Failed to send OTP. Try again.');
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = undefined;
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[idx] = val; setOtp(next);
    if (val && idx < 5) document.getElementById(`otp-login-${idx + 1}`)?.focus();
  };

  const handleVerify = async () => {
    if (otp.join('').length < 6) { setError('Enter the full OTP.'); return; }
    setError(null); setBusy(true);
    try {
      if (isDemoMode) {
        const { loginWithPhone } = await import('../../auth/authActions');
        const uid = await loginWithPhone(digits, otp.join(''));
        const profile = await getUserProfile(uid);
        setBusy(false);
        if (profile) {
          await registerPhoneIndex(digits, uid).catch(console.warn);
          await expireStaleSosForUser(uid).catch(console.warn);
          return nav(redirectPath);
        }
        return nav('/signup', {
          state: { uid, phone: digits, fromLogin: true, redirect: redirectPath },
          replace: true,
        });
      }

      if (!confirmationResult) throw new Error('No OTP session found.');
      const result = await confirmationResult.confirm(otp.join(''));

      // Safety net: if pre-OTP check was skipped (e.g. rules denied it),
      // still route unregistered users to signup after OTP verify.
      const profile = await getUserProfile(result.user.uid);
      if (profile) {
        await registerPhoneIndex(digits, result.user.uid).catch(console.warn);
        await expireStaleSosForUser(result.user.uid).catch(console.warn);
        nav(redirectPath);
      } else {
        nav('/signup', {
          state: { uid: result.user.uid, phone: digits, fromLogin: true, redirect: redirectPath },
          replace: true,
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Verification failed. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-dvh bg-[#0a0b0f] relative">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(220,38,38,0.07) 0%, transparent 60%)' }} />

      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-4">
        <LanguageSwitcher compact menuAlign="left" />
        <a
          href="https://drive.google.com/drive/folders/1lcX9y4pkPlJKCTaNreWLOFRCKlNniMSS?usp=drive_link" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] font-black text-sky-100 hover:bg-sky-500/20 transition active:scale-95"
        >
          <Download className="h-3.5 w-3.5" /> {t('landing.getApp')}
        </a>
      </div>

      <div className="relative z-10 min-h-dvh flex items-center justify-center px-5 pt-16">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 gap-3">
          <Link to="/">
            <div className="h-14 w-14 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 0 30px rgba(220,38,38,0.4)' }}>
              <Siren className="h-7 w-7 text-white" />
            </div>
          </Link>
          <div className="text-center">
            <div className="text-lg font-black text-white">Arogya Raksha</div>
            <div className="text-xs text-white/40">{t('auth.tagline')}</div>
          </div>
        </div>

        {/* Value-props strip — reinforces that this isn't just an SOS app */}
        <div className="mb-5 grid grid-cols-3 gap-1.5">
          <ValueChip icon={<Siren className="h-3.5 w-3.5 text-red-400" />}        label={t('auth.sosChip')} />
          <ValueChip icon={<Stethoscope className="h-3.5 w-3.5 text-emerald-300" />} label={t('auth.doctorsChip')} />
          <ValueChip icon={<FolderHeart className="h-3.5 w-3.5 text-pink-300" />} label={t('auth.vaultChip')} />
        </div>

        <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-6 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 'phone' ? (
              <motion.div key="phone" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                <h2 className="text-lg font-black text-white">{t('auth.enterPhone')}</h2>
                <p className="mt-1 text-xs text-white/35">{t('auth.otpHint')}</p>

                {error && <ErrorBox msg={error} />}

                <div className="mt-5 space-y-1">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t('auth.mobileNumber')}</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                      <Phone className="h-3.5 w-3.5 text-white/30" />
                      <span className="text-sm text-white/40 font-medium">+91</span>
                      <span className="text-white/15">|</span>
                    </div>
                    <input
                      id="login-phone"
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                      placeholder="98765 43210"
                      className={[
                        'w-full h-12 rounded-2xl border bg-white/[0.04] pl-[90px] pr-4 text-sm text-white placeholder:text-white/20 outline-none transition',
                        phoneError ? 'border-red-500/40 focus:ring-2 focus:ring-red-500/20' : 'border-white/[0.07] focus:border-red-500/30 focus:ring-2 focus:ring-red-500/15',
                      ].join(' ')}
                    />
                  </div>
                  {phoneError && <p className="text-[10px] text-red-400 font-medium">{phoneError}</p>}
                  {digits.length === 10 && !phoneError && (
                    <p className="text-[10px] text-emerald-400 font-medium">{t('auth.validNumber')}</p>
                  )}
                </div>

                <button id="login-send-otp" onClick={handleSendOtp} disabled={digits.length !== 10 || !!phoneError || busy}
                  className="mt-4 w-full h-12 rounded-full text-sm font-black text-white transition active:scale-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
                  {busy ? <Spinner label={t('auth.verifying')} /> : t('auth.sendOtp')}
                </button>
                <div id="login-recaptcha-wrapper" className="mt-4">
                  <div id="login-recaptcha-container"></div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                <button onClick={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); setError(null); }}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-4">
                  <ArrowLeft className="h-3.5 w-3.5" /> {t('auth.changeNumber')}
                </button>
                <h2 className="text-lg font-black text-white">{t('auth.verifyOtp')}</h2>
                <p className="mt-1 text-xs text-white/35">{t('auth.sentTo')} <span className="text-white/65">+91 {digits}</span></p>
                <p className="mt-0.5 text-[10px] text-white/20">{t('auth.demoOtpHint')}</p>

                {error && <ErrorBox msg={error} />}

                <div className="mt-5 w-full max-w-[340px] mx-auto grid grid-cols-6 gap-2">
                  {otp.map((d, i) => (
                    <input key={i} id={`otp-login-${i}`}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      autoFocus={i === 0}
                      maxLength={1}
                      value={d}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-login-${i - 1}`)?.focus();
                        if (e.key === 'Enter' && otp.join('').length === 6) handleVerify();
                      }}
                      onPaste={i === 0 ? e => {
                        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        const next = ['', '', '', '', '', ''];
                        paste.split('').forEach((ch, j) => { next[j] = ch; });
                        setOtp(next);
                        document.getElementById(`otp-login-${Math.min(paste.length, 5)}`)?.focus();
                        e.preventDefault();
                      } : undefined}
                      className={[
                        'w-full h-14 sm:h-16 rounded-2xl border text-center text-2xl font-black text-white outline-none transition',
                        'bg-[#0f1118] border-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
                        'focus:border-red-500/60 focus:ring-2 focus:ring-red-500/25',
                      ].join(' ')}
                    />
                  ))}
                </div>

                <button id="login-verify" onClick={handleVerify}
                  disabled={busy || otp.join('').length < 6}
                  className="mt-4 w-full h-12 rounded-full text-sm font-black text-white transition active:scale-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
                  {busy ? <Spinner label={t('auth.verifying')} /> : t('auth.verifySignIn')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-5 pt-4 border-t border-white/[0.04] text-center text-xs text-white/25 space-y-2">
            <div>
              {t('auth.noAccount')}{' '}
              <Link to={`/signup?redirect=${encodeURIComponent(redirectPath)}`} className="font-bold text-white/55 hover:text-white transition">{t('auth.signUp')}</Link>
            </div>
            <a href="https://drive.google.com/drive/folders/1lcX9y4pkPlJKCTaNreWLOFRCKlNniMSS?usp=drive_link" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 font-bold text-sky-300/80 hover:text-sky-200 transition">
              <Download className="h-3 w-3" /> {t('auth.downloadApp')}
            </a>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

const ErrorBox = ({ msg }: { msg: string }) => (
  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
    <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
    <span className="text-xs text-red-300">{msg}</span>
  </div>
);

const ValueChip = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center justify-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] py-1.5 text-[10px] font-black text-white/60">
    {icon} {label}
  </div>
);

const Spinner = ({ label }: { label?: string }) => (
  <span className="flex items-center justify-center gap-2">
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    {label ?? '…'}
  </span>
);
