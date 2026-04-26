import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Siren, Phone, AlertCircle, ArrowLeft, Plus, X, CheckCircle2, Stethoscope, FolderHeart, HandHeart, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signupWithPhone } from '../../auth/authActions';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth } from '../../firebase/client';
import { isDemoMode } from '../../app/env';
import { useLocation } from 'react-router-dom';
import { updateUserProfile, registerPhoneIndex } from '../../data/user';

type Step = 'phone' | 'otp' | 'profile';

interface EmergencyContact {
  name: string;
  phone: string;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const SignupPage = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const preVerifiedUid = loc.state?.uid as string | undefined;
  const preVerifiedPhone = loc.state?.phone as string | undefined;
  const redirectPath = loc.state?.redirect as string | undefined;
  const fromLogin = Boolean(loc.state?.fromLogin);

  const [step, setStep] = useState<Step>(preVerifiedUid ? 'profile' : 'phone');
  const [phone, setPhone] = useState(preVerifiedPhone || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: '', phone: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [finalUid, setFinalUid] = useState<string | null>(preVerifiedUid || null);

  const handleSendOtp = async () => {
    const d = phone.replace(/\D/g, '');
    if (d.length !== 10) { setError('Phone must be exactly 10 digits.'); return; }
    if (!/^[6-9]/.test(d)) { setError('Number must start with 6, 7, 8, or 9.'); return; }
    setError(null);
    setBusy(true);

    if (isDemoMode) {
      setStep('otp');
      setBusy(false);
      return;
    }

    try {
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'signup-recaptcha-container', {
          size: 'invisible',
        });
      }
      const confirmation = await signInWithPhoneNumber(auth, '+91' + d, (window as any).recaptchaVerifier);
      setConfirmationResult(confirmation);
      setStep('otp');
    } catch (e: any) {
      setError(e?.message || 'Failed to send OTP.');
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
    if (val && idx < 5) document.getElementById(`sotp-${idx + 1}`)?.focus();
  };

  const handleVerifyOtp = async () => {
    if (otp.join('').length < 6) { setError('Enter the full OTP.'); return; }
    setError(null);
    setBusy(true);

    try {
      if (isDemoMode) {
        setFinalUid('demo-signup-uid');
        setStep('profile');
        return;
      }

      if (!confirmationResult) throw new Error('No OTP session found.');
      const result = await confirmationResult.confirm(otp.join(''));
      setFinalUid(result.user.uid);
      setStep('profile');
    } catch (e: any) {
      setError(e?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const addContact = () => setContacts([...contacts, { name: '', phone: '' }]);
  const removeContact = (i: number) => setContacts(contacts.filter((_, idx) => idx !== i));
  const updateContact = (i: number, field: keyof EmergencyContact, val: string) => {
    const next = [...contacts]; next[i] = { ...next[i], [field]: val } as EmergencyContact; setContacts(next);
  };

  const handleSignup = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    const validContacts = contacts.filter(c => c.name.trim() && c.phone.replace(/\D/g, '').length >= 10);
    if (validContacts.length === 0) { setError('Add at least one valid emergency contact.'); return; }
    if (!finalUid) { setError('Missing authenticated user ID.'); return; }
    setError(null);
    setBusy(true);
    try {
      if (isDemoMode) {
        await signupWithPhone({ phone, name: name.trim(), bloodGroup, emergencyContacts: validContacts });
      } else {
        // Just write the profile to the database directly since they are perfectly authenticated!
        await updateUserProfile(finalUid, {
          uid: finalUid,
          name: name.trim(),
          phone: phone,
          bloodGroup: bloodGroup,
          contacts: validContacts,
        });
        await registerPhoneIndex(phone, finalUid);
      }
      setSuccess(true);
      setTimeout(() => nav(redirectPath || '/app'), 2000);
    } catch (e: any) {
      setError(e?.message || 'Signup failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const stepLabel = step === 'phone' ? 1 : step === 'otp' ? 2 : 3;

  return (
    <div className="min-h-dvh bg-[#0a0b0f] relative flex items-center justify-center overflow-hidden px-6 py-10">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(29,78,216,0.07) 0%, transparent 65%)' }} />

      <a
        href="/#download-app"
        className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] font-black text-sky-100 hover:bg-sky-500/20 transition active:scale-95"
      >
        <Download className="h-3.5 w-3.5" /> Get app
      </a>

      <div className="relative z-10 w-full max-w-xs">
        {/* Logo */}
        <div className="flex flex-col items-center mb-4">
          <Link to="/" className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 flex items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', boxShadow: '0 0 25px rgba(220,38,38,0.35)' }}>
              <Siren className="h-6 w-6 text-white" />
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-white tracking-tight">Arogya Raksha</div>
              <div className="text-[11px] text-white/40">Emergency SOS · Doctors · Health Vault</div>
            </div>
          </Link>
        </div>

        {/* Value-props strip */}
        <div className="mb-5 grid grid-cols-4 gap-1.5">
          <ValueChip icon={<Siren className="h-3 w-3 text-red-400" />}            label="SOS" />
          <ValueChip icon={<HandHeart className="h-3 w-3 text-blue-400" />}       label="Help" />
          <ValueChip icon={<Stethoscope className="h-3 w-3 text-emerald-300" />} label="Care" />
          <ValueChip icon={<FolderHeart className="h-3 w-3 text-pink-300" />}    label="Vault" />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${s === stepLabel ? 'w-8 bg-red-500' : s < stepLabel ? 'w-4 bg-red-500/50' : 'w-4 bg-white/10'}`} />
          ))}
        </div>

        <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-6 shadow-2xl">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Phone ── */}
            {step === 'phone' && (
              <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="text-xl font-black text-white">Create account</div>
                <p className="mt-1 text-xs text-white/35">Emergency response, always ready</p>

                {fromLogin && (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-amber-200">
                      This number isn't registered yet. Let's set up your account.
                    </span>
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-red-300">{error}</span>
                  </div>
                )}

                <div className="mt-5 space-y-1">
                  <label className="text-[10px] font-bold text-white/35 uppercase tracking-widest">Mobile Number</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                      <Phone className="h-3.5 w-3.5 text-white/30" />
                      <span className="text-sm text-white/40 font-medium">+91</span>
                      <span className="text-white/15 ml-0.5">|</span>
                    </div>
                    <input
                      id="signup-phone"
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                      placeholder="98765 43210"
                      className={[
                        'w-full h-12 rounded-2xl border bg-white/[0.04] pl-[90px] pr-4 text-sm text-white placeholder:text-white/20 outline-none transition',
                        phone.length > 0 && (phone.length !== 10 || !/^[6-9]/.test(phone))
                          ? 'border-red-500/40 focus:ring-2 focus:ring-red-500/20'
                          : 'border-white/[0.07] focus:border-red-500/30 focus:ring-2 focus:ring-red-500/15',
                      ].join(' ')}
                    />
                  </div>
                  {phone.length > 0 && phone.length !== 10 && (
                    <p className="text-[10px] text-red-400 font-medium">Must be exactly 10 digits</p>
                  )}
                  {phone.length === 10 && !/^[6-9]/.test(phone) && (
                    <p className="text-[10px] text-red-400 font-medium">Must start with 6, 7, 8, or 9</p>
                  )}
                  {phone.length === 10 && /^[6-9]/.test(phone) && (
                    <p className="text-[10px] text-emerald-400 font-medium">✓ Valid number</p>
                  )}
                </div>

                <button id="signup-send-otp" type="button" onClick={handleSendOtp}
                  disabled={phone.length !== 10 || !/^[6-9]/.test(phone) || busy}
                  className="mt-5 w-full h-12 rounded-full text-sm font-black text-white transition active:scale-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
                  {busy ? 'Sending...' : 'Send OTP →'}
                </button>
                <div id="signup-recaptcha-container" className="mt-4"></div>
              </motion.div>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); setError(null); }}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-4">
                  <ArrowLeft className="h-3.5 w-3.5" /> Change number
                </button>
                <div className="text-xl font-black text-white">Verify OTP</div>
                <p className="mt-1 text-xs text-white/35">Sent to <span className="text-white/70">+91 {phone}</span></p>
                <p className="mt-0.5 text-[10px] text-white/25">(Demo: use any 6 digits)</p>

                {error && (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-red-300">{error}</span>
                  </div>
                )}

                <div className="mt-5 flex gap-2 sm:gap-3 justify-center">
                  {otp.map((d, i) => (
                    <input key={i} id={`sotp-${i}`} type="text" inputMode="numeric" maxLength={1} value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`sotp-${i - 1}`)?.focus();
                        if (e.key === 'Enter' && otp.join('').length === 6) handleVerifyOtp();
                      }}
                      className="w-10 sm:w-12 h-14 rounded-xl border border-white/[0.07] bg-white/[0.05] text-center text-xl font-black text-white outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition"
                    />
                  ))}
                </div>

                <button id="signup-verify-otp" type="button" onClick={handleVerifyOtp} disabled={otp.join('').length < 6 || busy}
                  className="mt-5 w-full h-12 rounded-full text-sm font-black text-white transition active:scale-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
                  {busy ? 'Verifying...' : 'Next →'}
                </button>
              </motion.div>
            )}

            {/* ── Step 3: Profile ── */}
            {step === 'profile' && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {success ? (
                  <div className="py-6 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                    <div className="text-lg font-black text-white">Account created!</div>
                    <p className="mt-1 text-xs text-white/40">Emergency contacts notified. Redirecting…</p>
                  </div>
                ) : (
                  <>
                    <div className="text-xl font-black text-white">Your Profile</div>
                    <p className="mt-1 text-xs text-white/35">Help us help you faster in an emergency</p>

                    {error && (
                      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                        <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-red-300">{error}</span>
                      </div>
                    )}

                    <div className="mt-5 space-y-4">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/35 uppercase tracking-widest">Full Name <span className="text-red-500">*</span></label>
                        <input id="signup-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                          placeholder="Rahul Sharma"
                          className="w-full h-11 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/40 focus:ring-2 focus:ring-red-500/15 transition" />
                      </div>

                      {/* Blood Group */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-white/35 uppercase tracking-widest">Blood Group <span className="text-white/20">(optional)</span></label>
                        <div className="flex flex-wrap gap-1.5">
                          {BLOOD_GROUPS.map(bg => (
                            <button key={bg} type="button" onClick={() => setBloodGroup(bg === bloodGroup ? '' : bg)}
                              className={`h-8 px-3 rounded-full text-xs font-bold transition ${bloodGroup === bg ? 'bg-red-500 text-white' : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'}`}>
                              {bg}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Emergency Contacts */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/35 uppercase tracking-widest">Emergency Contacts <span className="text-red-500">*</span></label>
                        {contacts.map((c, i) => (
                          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Contact {i + 1}</span>
                              {contacts.length > 1 && (
                                <button type="button" onClick={() => removeContact(i)}
                                  className="h-5 w-5 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <input type="text" value={c.name} onChange={(e) => updateContact(i, 'name', e.target.value)}
                              placeholder="Contact name"
                              className="w-full h-9 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
                            <input type="tel" value={c.phone} onChange={(e) => updateContact(i, 'phone', e.target.value)}
                              placeholder="Phone number"
                              className="w-full h-9 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
                          </div>
                        ))}
                        <button type="button" onClick={addContact}
                          className="w-full h-9 flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 text-xs font-semibold text-white/40 hover:border-white/30 hover:text-white/60 transition">
                          <Plus className="h-3.5 w-3.5" /> Add another contact
                        </button>
                      </div>
                    </div>

                    <button id="signup-complete" type="button" onClick={handleSignup} disabled={busy}
                      className="mt-5 w-full h-12 rounded-full text-sm font-black text-white transition active:scale-95 disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
                      {busy ? 'Creating account…' : 'Complete Sign Up →'}
                    </button>
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>

          <div className="mt-5 pt-4 border-t border-white/5 text-center text-xs text-white/25 space-y-2">
            {step === 'phone' && (
              <div>
                Already have an account?{' '}
                <Link to="/login" className="font-bold text-white/60 hover:text-white transition">Sign in</Link>
              </div>
            )}
            <a href="/#download-app" className="inline-flex items-center justify-center gap-1 font-bold text-sky-300/80 hover:text-sky-200 transition">
              <Download className="h-3 w-3" /> Download app (no login)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const ValueChip = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center justify-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] py-1.5 text-[10px] font-black text-white/60">
    {icon} {label}
  </div>
);
