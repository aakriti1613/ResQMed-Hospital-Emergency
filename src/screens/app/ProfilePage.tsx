import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { logout } from '../../auth/authActions';
import { useTheme } from '../../app/ThemeContext';
import { detectCrash, analyzeSeverityWithML, type SensorSample } from '../../features/sos/crashDetection';
import {
  User, Phone, Droplets, Plus, Trash2, ShieldCheck,
  Activity, ShieldAlert, MapPin, Bell, Moon, Sun, LogOut, ChevronRight,
  Pencil, Check, Home, Briefcase, Tag, CalendarDays, HeartPulse, Pill as PillIcon, Search,
  Trophy, Sparkles, Lock, Gift, Star, Award, Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  listenUserProfile,
  updateUserProfile,
  type Gender,
  type SavedAddress,
} from '../../data/user';
import { REWARD_TIERS, tierProgress, type RewardTier } from '../../data/rewards';
import { LocationSearchModal } from '../../components/LocationSearchModal';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

interface Contact { name: string; phone: string }
type Section = 'main' | 'contacts' | 'sensors' | 'personal' | 'health' | 'addresses' | 'rewards';

// ── Helpers ─────────────────────────────────────────────────────────────────
function calcAge(dob: string | undefined | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

function makeId() {
  return `a_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function genderLabel(g: Gender | undefined): string {
  if (!g) return '—';
  return g.charAt(0).toUpperCase() + g.slice(1);
}

// ── Main component ──────────────────────────────────────────────────────────
export const ProfilePage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>('main');
  const [toast, setToast] = useState<string | null>(null);

  // ── Profile editable state ────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSaved, setContactSaved] = useState(false);
  const [points, setPoints] = useState(0);
  const [helpedCount, setHelpedCount] = useState(0);
  const [trustScore, setTrustScore] = useState(98);
  const [badges, setBadges] = useState<string[]>([]);

  // ── Hydrate from Firestore (realtime) ─────────────────────────────────────
  // Live listener keeps points/tier in sync the moment a helper reward lands.
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenUserProfile(user.uid, (p) => {
      if (!p) {
        setName(user.displayName || '');
        return;
      }
      setName(p.name || user.displayName || '');
      setPhone(p.phone || '');
      setDob(p.dob || '');
      setGender((p.gender as Gender) || '');
      setBloodGroup(p.bloodGroup || '');
      setAllergies(p.allergies || '');
      setMedications(p.medications || '');
      setAddresses(p.addresses || []);
      if (p.contacts?.length) setContacts(p.contacts);
      setPoints(typeof p.points === 'number' ? p.points : 0);
      setHelpedCount(typeof p.helpedCount === 'number' ? p.helpedCount : 0);
      setTrustScore(typeof p.trustScore === 'number' ? p.trustScore : 98);
      setBadges(Array.isArray(p.badges) ? p.badges : ['Verified Helper', 'CPR Certified']);
    });
    return () => unsub();
  }, [user?.uid, user?.displayName]);

  // ── Sensor state (existing) ───────────────────────────────────────────────
  const [sample, setSample] = useState<SensorSample>({
    lat: 28.6139, lon: 77.209, speedKmh: 42, accelerationG: 0.4, orientation: 'normal', vibration: 10,
  });
  const prevRef = useRef<SensorSample | null>(null);
  const detection = useMemo(() => detectCrash(prevRef.current, sample), [sample]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  // ── Persistence helpers ───────────────────────────────────────────────────
  const savePersonal = async (patch: { name: string; phone: string; dob: string; gender: Gender }) => {
    setName(patch.name); setPhone(patch.phone); setDob(patch.dob); setGender(patch.gender);
    if (user?.uid) await updateUserProfile(user.uid, patch);
    showToast('Profile updated');
  };

  const saveHealth = async (patch: { allergies: string; medications: string }) => {
    setAllergies(patch.allergies); setMedications(patch.medications);
    if (user?.uid) await updateUserProfile(user.uid, patch);
    showToast('Health info updated');
  };

  const saveAddresses = async (next: SavedAddress[]) => {
    setAddresses(next);
    if (user?.uid) await updateUserProfile(user.uid, { addresses: next });
  };

  const saveContacts = async () => {
    const clean = contacts.filter((c) => c.name || c.phone);
    setContacts(clean);
    if (user?.uid) await updateUserProfile(user.uid, { contacts: clean });
    setContactSaved(true);
    setTimeout(() => setContactSaved(false), 2500);
  };

  const handleBloodGroupSelect = (bg: string) => {
    const next = bg === bloodGroup ? '' : bg;
    setBloodGroup(next);
    if (user?.uid) updateUserProfile(user.uid, { bloodGroup: next });
  };

  const handleLogout = async () => {
    setBusy(true);
    try { await logout(); nav('/'); } finally { setBusy(false); }
  };

  // ── Sub-screen routing ────────────────────────────────────────────────────
  if (section === 'contacts') return (
    <ContactsEditor
      contacts={contacts}
      setContacts={setContacts}
      saved={contactSaved}
      onSave={saveContacts}
      onBack={() => setSection('main')}
    />
  );

  if (section === 'personal') return (
    <PersonalEditor
      initial={{ name, phone, dob, gender }}
      onSave={async (p) => { await savePersonal(p); setSection('main'); }}
      onBack={() => setSection('main')}
    />
  );

  if (section === 'health') return (
    <HealthEditor
      initial={{ allergies, medications }}
      onSave={async (p) => { await saveHealth(p); setSection('main'); }}
      onBack={() => setSection('main')}
    />
  );

  if (section === 'addresses') return (
    <AddressesEditor
      addresses={addresses}
      onChange={saveAddresses}
      onBack={() => setSection('main')}
    />
  );

  if (section === 'sensors') return (
    <SensorDashboard
      sample={sample}
      setSample={(fn) => { prevRef.current = sample; setSample(fn); }}
      detection={detection}
      onBack={() => setSection('main')}
    />
  );

  if (section === 'rewards') return (
    <RewardsScreen
      points={points}
      helpedCount={helpedCount}
      onBack={() => setSection('main')}
    />
  );

  // ── MAIN ──────────────────────────────────────────────────────────────────
  const age = calcAge(dob);
  const displayName = name || user?.displayName || 'Guest';
  const displayPhone = phone || '—';

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-10 pb-4 max-w-lg mx-auto w-full space-y-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full border border-white/10 bg-[#1a1b22] px-5 py-2.5 text-xs font-semibold text-white shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Profile card ── */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
            <User className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-black text-white truncate">{displayName}</div>
            <div className="text-xs text-white/45 flex items-center gap-1 mt-0.5 truncate">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{displayPhone}</span>
            </div>
          </div>
          <button
            onClick={() => setSection('personal')}
            className="shrink-0 h-9 w-9 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] transition flex items-center justify-center"
            aria-label="Edit profile"
          >
            <Pencil className="h-3.5 w-3.5 text-white/70" />
          </button>
        </div>

        {/* Identity pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Pill icon={<CalendarDays className="h-3 w-3 text-blue-300" />}
            label={age !== null ? `${age} yrs` : 'Age —'} />
          <Pill icon={<User className="h-3 w-3 text-purple-300" />}
            label={genderLabel(gender)} />
          <Pill icon={<Droplets className="h-3 w-3 text-red-300" />}
            label={bloodGroup || 'Blood —'} />
        </div>

        {/* Volunteer Trust Score & Badges */}
        {(helpedCount > 0 || badges.length > 0) && (
          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> Trust Score
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-amber-400">{trustScore}</span>
                <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">/ 100</span>
              </div>
            </div>
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-[#1d1e26] border border-amber-500/20 text-amber-200/90 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                    <Award className="h-3 w-3 text-amber-400" />
                    {b}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blood group selector */}
        <div className="mt-5">
          <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1 mb-2">
            <Droplets className="h-3 w-3 text-red-400" /> Blood Group
          </label>
          <div className="flex flex-wrap gap-1.5">
            {BLOOD_GROUPS.map(bg => (
              <button key={bg} onClick={() => handleBloodGroupSelect(bg)}
                className={`h-8 px-3 rounded-full text-xs font-black transition active:scale-95 ${
                  bloodGroup === bg
                    ? 'bg-red-500 text-white'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/25'
                }`}>{bg}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Rewards / Arogya Points ── */}
      <PointsCard
        points={points}
        helpedCount={helpedCount}
        onOpen={() => setSection('rewards')}
      />

      {/* ── Settings rows ── */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] overflow-hidden divide-y divide-white/[0.04]">
        <SettingRow
          icon={<User className="h-4 w-4 text-sky-300" />}
          label={t('settings.personalDetails')}
          sub={
            [
              age !== null ? `${age} yrs` : null,
              gender ? genderLabel(gender) : null,
              dob ? new Date(dob).toLocaleDateString() : null,
            ].filter(Boolean).join(' • ') || t('settings.personalDetailsSubFallback')
          }
          onClick={() => setSection('personal')}
          arrow
        />
        <SettingRow
          icon={<Home className="h-4 w-4 text-emerald-300" />}
          label={t('settings.savedAddresses')}
          sub={addresses.length > 0 ? `${addresses.length} saved` : t('settings.savedAddressesSub')}
          onClick={() => setSection('addresses')}
          arrow
        />
        <SettingRow
          icon={<HeartPulse className="h-4 w-4 text-pink-400" />}
          label={t('settings.healthInfo')}
          sub={
            [allergies && 'Allergies', medications && 'Medications']
              .filter(Boolean)
              .join(' • ') || t('settings.healthInfoSub')
          }
          onClick={() => setSection('health')}
          arrow
        />
        <SettingRow
          icon={<ShieldCheck className="h-4 w-4 text-blue-400" />}
          label={t('settings.emergencyContacts')}
          sub={contacts.filter(c => c.name).length > 0 ? t('settings.emergencyContactsSub', { count: contacts.filter(c => c.name).length }) : t('settings.emergencyContactsNone')}
          onClick={() => setSection('contacts')}
          arrow
        />
        <SettingRow
          icon={<Activity className="h-4 w-4 text-emerald-400" />}
          label={t('settings.crashMonitor')}
          sub={t('settings.crashMonitorSub')}
          onClick={() => setSection('sensors')}
          arrow
        />
        <SettingRow
          icon={<MapPin className="h-4 w-4 text-amber-400" />}
          label={t('settings.location')}
          sub={t('settings.locationSub')}
        />
        <SettingRow
          icon={<Bell className="h-4 w-4 text-purple-400" />}
          label={t('settings.notifications')}
          sub={t('settings.notificationsSub')}
        />
        {/* Dark mode toggle */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
              {theme === 'dark' ? <Moon className="h-4 w-4 text-indigo-300" /> : <Sun className="h-4 w-4 text-amber-400" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-white/85">{t('settings.darkMode')}</div>
              <div className="text-[10px] text-white/30 font-medium">{theme === 'dark' ? t('settings.currentlyDark') : t('settings.currentlyLight')}</div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={[
              'relative h-7 w-12 rounded-full transition-all duration-300',
              theme === 'dark' ? 'bg-indigo-600' : 'bg-white/20',
            ].join(' ')}
          >
            <span className={[
              'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300',
              theme === 'dark' ? 'left-6' : 'left-1',
            ].join(' ')} />
          </button>
        </div>
        
        {/* Language switch */}
        <div className="flex items-center justify-between px-4 py-3.5 border-t border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
              <Languages className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white/85">{t('settings.language')}</div>
              <div className="text-[10px] text-white/30 font-medium">{t(`settings.${i18n.language}`) || t('settings.en')}</div>
            </div>
          </div>
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-white/80 px-2 py-1 outline-none focus:border-emerald-500/50 transition appearance-none"
          >
            <option value="en" className="bg-[#1a1b23]">{t('settings.en')}</option>
            <option value="hi" className="bg-[#1a1b23]">{t('settings.hi')}</option>
            <option value="te" className="bg-[#1a1b23]">{t('settings.te')}</option>
          </select>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={busy}
        className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 text-xs font-black text-red-400 hover:bg-red-500/10 transition active:scale-95 disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" /> {busy ? t('settings.signingOut') : t('settings.logOut')}
      </button>

      <p className="text-center text-[10px] text-white/15 pb-2">Arogya Raksha v1.0</p>
    </div>
  );
};

// ── Points / Rewards card on the main profile screen ───────────────────────
const PointsCard = ({
  points, helpedCount, onOpen,
}: { points: number; helpedCount: number; onOpen: () => void }) => {
  const { current, next, pct, remaining } = tierProgress(points);
  const atMax = next === null;

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-3xl border border-white/[0.06] bg-[#13141a] p-5 overflow-hidden relative hover:border-white/[0.12] transition"
    >
      {/* Glow backdrop matching the tier accent */}
      <div
        className="absolute -top-12 -right-16 h-40 w-40 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: current.gradient }}
      />

      <div className="relative flex items-start gap-4">
        {/* Badge disc */}
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl shadow-lg"
          style={{ background: current.gradient }}
        >
          <span>{current.emoji}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" style={{ color: current.accent }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: current.accent }}>
              {current.name}
            </span>
          </div>
          <div className="mt-0.5 text-2xl font-black text-white tabular-nums">
            {points.toLocaleString()} <span className="text-xs font-bold text-white/40">pts</span>
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {helpedCount > 0
              ? `${helpedCount} ${helpedCount === 1 ? 'rescue' : 'rescues'} completed`
              : 'Respond to your first SOS to earn points'}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-white/25 shrink-0 mt-1.5" />
      </div>

      {/* Progress bar */}
      <div className="relative mt-4">
        <div className="h-2 w-full rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: current.gradient }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px]">
          {atMax ? (
            <span className="font-black text-white/70 flex items-center gap-1">
              <Sparkles className="h-3 w-3" style={{ color: current.accent }} /> Max tier unlocked
            </span>
          ) : (
            <>
              <span className="text-white/40 font-semibold">
                <span className="text-white/80 font-black">{remaining.toLocaleString()}</span> pts to{' '}
                <span style={{ color: next!.accent }}>{next!.name}</span>
              </span>
              <span className="text-white/30 tabular-nums">{Math.round(pct)}%</span>
            </>
          )}
        </div>
      </div>

      {/* Headline perk */}
      <div className="relative mt-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 flex items-center gap-2.5">
        <Gift className="h-4 w-4 shrink-0" style={{ color: current.accent }} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">
            {atMax ? 'Active perk' : 'Next unlock'}
          </div>
          <div className="text-xs font-black text-white/90 truncate">
            {atMax ? current.headlinePerk : next!.headlinePerk}
          </div>
        </div>
      </div>
    </button>
  );
};

// ── Full rewards center (sub-screen) ───────────────────────────────────────
const RewardsScreen = ({
  points, helpedCount, onBack,
}: { points: number; helpedCount: number; onBack: () => void }) => {
  const { current, next, pct, remaining, earnedInTier, tierSpan } = tierProgress(points);
  const atMax = next === null;

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-8 max-w-lg mx-auto w-full space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
        ← Back
      </button>

      {/* Hero */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-6 relative overflow-hidden">
        <div
          className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: current.gradient }}
        />
        <div className="relative flex items-center gap-4">
          <div
            className="h-20 w-20 rounded-3xl flex items-center justify-center shrink-0 text-4xl shadow-2xl"
            style={{ background: current.gradient }}
          >
            <span>{current.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: current.accent }}>
              Current Tier
            </div>
            <h2 className="text-2xl font-black text-white leading-tight">{current.name}</h2>
            <div className="text-xs text-white/50 mt-0.5">{current.tagline}</div>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <Stat label="Arogya Points" value={points.toLocaleString()} accent={current.accent} />
          <Stat label="Rescues" value={helpedCount.toString()} accent={current.accent} />
        </div>

        {/* Progress bar */}
        <div className="relative mt-5">
          <div className="h-2.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: current.gradient }}
            />
          </div>
          <div className="mt-2 text-[11px] font-semibold text-white/50">
            {atMax ? (
              <span className="flex items-center gap-1 text-white/70 font-black">
                <Sparkles className="h-3.5 w-3.5" style={{ color: current.accent }} /> You've reached the highest tier. Thank you.
              </span>
            ) : (
              <span>
                <span className="tabular-nums text-white/80 font-black">{earnedInTier}</span>
                <span className="text-white/35"> / {tierSpan} pts · </span>
                <span className="tabular-nums text-white font-black">{remaining}</span>
                <span className="text-white/35"> to </span>
                <span className="font-black" style={{ color: next!.accent }}>{next!.name}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* "How to earn" helper */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4">
        <div className="flex items-center gap-2 text-xs font-black text-white/80">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> How to earn points
        </div>
        <ul className="mt-3 space-y-2 text-[11px] text-white/55">
          <EarnRow emoji="🚑" label="Accept & reach an SOS first" pts="+50" />
          <EarnRow emoji="🤝" label="Assist as a secondary helper" pts="+20" />
          <EarnRow emoji="📝" label="Complete post-rescue report" pts="+10" />
          <EarnRow emoji="🎯" label="Keep your profile complete" pts="+5" />
        </ul>
      </div>

      {/* Tier ladder */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-2 px-1">All tiers</div>
        <div className="space-y-2.5">
          {REWARD_TIERS.map((t) => (
            <TierCard
              key={t.id}
              tier={t}
              points={points}
              isCurrent={t.id === current.id}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] text-white/20 pt-2">
        Rewards honour the community. Benefits reset annually.
      </p>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
    <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</div>
    <div className="mt-0.5 text-xl font-black tabular-nums" style={{ color: accent }}>{value}</div>
  </div>
);

const EarnRow = ({ emoji, label, pts }: { emoji: string; label: string; pts: string }) => (
  <li className="flex items-center gap-2.5">
    <span className="h-7 w-7 rounded-full bg-white/[0.04] flex items-center justify-center text-sm shrink-0">{emoji}</span>
    <span className="flex-1">{label}</span>
    <span className="text-[10px] font-black text-emerald-300 tabular-nums">{pts}</span>
  </li>
);

const TierCard = ({
  tier, points, isCurrent,
}: { tier: RewardTier; points: number; isCurrent: boolean }) => {
  const unlocked = points >= tier.points;
  const [expanded, setExpanded] = useState(isCurrent);

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition ${
        isCurrent
          ? 'bg-[#13141a]'
          : unlocked
            ? 'bg-[#13141a] border-white/[0.06]'
            : 'bg-[#0f1015] border-white/[0.04]'
      }`}
      style={isCurrent ? { borderColor: `${tier.accent}55` } : undefined}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3"
      >
        <div
          className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 text-xl ${
            unlocked ? '' : 'grayscale opacity-40'
          }`}
          style={{ background: tier.gradient }}
        >
          <span>{tier.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-black truncate ${unlocked ? 'text-white' : 'text-white/40'}`}
            >
              {tier.name}
            </span>
            {isCurrent && (
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${tier.accent}22`, color: tier.accent }}
              >
                Current
              </span>
            )}
            {!unlocked && <Lock className="h-3 w-3 text-white/25 shrink-0" />}
          </div>
          <div className="text-[11px] text-white/45 mt-0.5 truncate">
            {tier.points === 0 ? 'Starting tier' : `${tier.points.toLocaleString()} points`}
            {' · '}
            <span className={unlocked ? 'text-white/65 font-semibold' : 'text-white/35'}>
              {tier.headlinePerk}
            </span>
          </div>
        </div>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-white/25 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 -mt-1"
          >
            <ul className="space-y-1.5 pl-14">
              {tier.perks.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[11px]">
                  <span
                    className="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: unlocked ? tier.accent : 'rgba(255,255,255,0.2)' }}
                  />
                  <span className={unlocked ? 'text-white/70' : 'text-white/35'}>{p}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Tiny pill chip ──────────────────────────────────────────────────────────
const Pill = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/70">
    {icon}
    {label}
  </span>
);

// ── Personal details editor ────────────────────────────────────────────────
const PersonalEditor = ({
  initial, onSave, onBack,
}: {
  initial: { name: string; phone: string; dob: string; gender: Gender };
  onSave: (p: { name: string; phone: string; dob: string; gender: Gender }) => Promise<void> | void;
  onBack: () => void;
}) => {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [dob, setDob] = useState(initial.dob);
  const [gender, setGender] = useState<Gender>(initial.gender);
  const [saving, setSaving] = useState(false);
  const age = calcAge(dob);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.replace(/\s+/g, ''),
        dob,
        gender,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-6 max-w-lg mx-auto w-full space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
        ← Back
      </button>
      <h2 className="text-xl font-black text-white">Personal Details</h2>
      <p className="text-xs text-white/35">These help responders identify you in an emergency.</p>

      <Field label="Full name">
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Priya Sharma"
          className="w-full h-11 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
      </Field>

      <Field label="Phone number">
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210" type="tel" inputMode="tel"
            className="w-full h-11 rounded-xl border border-white/[0.06] bg-white/[0.04] pl-9 pr-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
        </div>
      </Field>

      <Field label={age !== null ? `Date of birth · ${age} years old` : 'Date of birth'}>
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input value={dob} onChange={(e) => setDob(e.target.value)}
            type="date" max={new Date().toISOString().slice(0, 10)}
            className="w-full h-11 rounded-xl border border-white/[0.06] bg-white/[0.04] pl-9 pr-3 text-sm text-white outline-none focus:border-red-500/30 transition" />
        </div>
      </Field>

      <Field label="Gender">
        <div className="grid grid-cols-3 gap-1.5">
          {(['male', 'female', 'other'] as const).map((g) => (
            <button key={g} onClick={() => setGender(g)}
              className={`h-11 rounded-xl text-xs font-black transition active:scale-95 border ${
                gender === g
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white/5 text-white/50 border-white/10 hover:border-white/25'
              }`}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </Field>

      <button onClick={handleSave} disabled={saving}
        className="w-full h-12 rounded-2xl text-sm font-black text-white transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
        <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
};

// ── Health editor ───────────────────────────────────────────────────────────
const HealthEditor = ({
  initial, onSave, onBack,
}: {
  initial: { allergies: string; medications: string };
  onSave: (p: { allergies: string; medications: string }) => Promise<void> | void;
  onBack: () => void;
}) => {
  const [allergies, setAllergies] = useState(initial.allergies);
  const [medications, setMedications] = useState(initial.medications);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ allergies: allergies.trim(), medications: medications.trim() }); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-6 max-w-lg mx-auto w-full space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
        ← Back
      </button>
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-pink-400" />
        <h2 className="text-xl font-black text-white">Health Info</h2>
      </div>
      <p className="text-xs text-white/35">
        Shown to the responding helper or ambulance so they know how to treat you.
      </p>

      <Field label="Allergies" sub="Separate multiple with commas">
        <textarea value={allergies} onChange={(e) => setAllergies(e.target.value)}
          placeholder="e.g. Penicillin, peanuts, latex"
          rows={3}
          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition resize-none" />
      </Field>

      <Field label="Current medications" sub="Drugs you take regularly">
        <div className="relative">
          <PillIcon className="absolute left-3 top-3 h-3.5 w-3.5 text-white/30" />
          <textarea value={medications} onChange={(e) => setMedications(e.target.value)}
            placeholder="e.g. Metformin 500mg, Atenolol 50mg"
            rows={3}
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition resize-none" />
        </div>
      </Field>

      <button onClick={handleSave} disabled={saving}
        className="w-full h-12 rounded-2xl text-sm font-black text-white transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
        <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
};

// ── Saved addresses editor ──────────────────────────────────────────────────
const AddressesEditor = ({
  addresses, onChange, onBack,
}: {
  addresses: SavedAddress[];
  onChange: (next: SavedAddress[]) => Promise<void> | void;
  onBack: () => void;
}) => {
  const [editing, setEditing] = useState<SavedAddress | null>(null);

  const upsert = async (a: SavedAddress) => {
    const exists = addresses.some((x) => x.id === a.id);
    const next = exists ? addresses.map((x) => (x.id === a.id ? a : x)) : [...addresses, a];
    await onChange(next);
    setEditing(null);
  };

  const remove = async (id: string) => {
    await onChange(addresses.filter((a) => a.id !== id));
  };

  if (editing) {
    return (
      <AddressFormEditor
        initial={editing}
        onSave={upsert}
        onCancel={() => setEditing(null)}
        onDelete={editing.id && addresses.some((a) => a.id === editing.id)
          ? () => { void remove(editing.id); setEditing(null); }
          : undefined}
      />
    );
  }

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-6 max-w-lg mx-auto w-full space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
        ← Back
      </button>
      <div className="flex items-center gap-2">
        <Home className="h-5 w-5 text-emerald-300" />
        <h2 className="text-xl font-black text-white">Saved Addresses</h2>
      </div>
      <p className="text-xs text-white/35">
        Pin Home &amp; Work so we can share them faster with responders in an emergency.
      </p>

      {addresses.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <MapPin className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm font-bold text-white/50">No saved addresses yet</p>
          <p className="text-xs text-white/30 mt-1">Add your home or work to get started</p>
        </div>
      )}

      <div className="space-y-2.5">
        {addresses.map((a) => (
          <button
            key={a.id}
            onClick={() => setEditing(a)}
            className="w-full text-left rounded-2xl border border-white/[0.06] bg-[#13141a] p-4 flex items-center gap-3 hover:bg-white/[0.03] transition"
          >
            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
              <AddressIcon label={a.label} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white truncate">
                {a.label === 'other' ? (a.name || 'Other') : a.label === 'home' ? 'Home' : 'Work'}
              </div>
              <div className="text-[11px] text-white/45 truncate mt-0.5">{a.line || 'No address set'}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
          </button>
        ))}
      </div>

      <button
        onClick={() =>
          setEditing({
            id: makeId(),
            label: addresses.some((a) => a.label === 'home') ? 'work' : 'home',
            line: '',
          })
        }
        className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-xs font-bold text-white/60 hover:border-white/30 hover:text-white/80 transition"
      >
        <Plus className="h-4 w-4" /> Add a new address
      </button>
    </div>
  );
};

const AddressIcon = ({ label }: { label: SavedAddress['label'] }) => {
  if (label === 'home') return <Home className="h-4 w-4 text-emerald-300" />;
  if (label === 'work') return <Briefcase className="h-4 w-4 text-sky-300" />;
  return <Tag className="h-4 w-4 text-amber-300" />;
};

// ── Single-address form ─────────────────────────────────────────────────────
const AddressFormEditor = ({
  initial, onSave, onCancel, onDelete,
}: {
  initial: SavedAddress;
  onSave: (a: SavedAddress) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => void;
}) => {
  const [label, setLabel] = useState<SavedAddress['label']>(initial.label);
  const [name, setName] = useState(initial.name || '');
  const [line, setLine] = useState(initial.line || '');
  const [lat, setLat] = useState<number | undefined>(initial.lat);
  const [lon, setLon] = useState<number | undefined>(initial.lon);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = line.trim().length > 0 && (label !== 'other' || name.trim().length > 0);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        id: initial.id,
        label,
        name: label === 'other' ? name.trim() : '',
        line: line.trim(),
        lat, lon,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-6 max-w-lg mx-auto w-full space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
        ← Back
      </button>
      <h2 className="text-xl font-black text-white">
        {initial.line ? 'Edit address' : 'New address'}
      </h2>

      <Field label="Label">
        <div className="grid grid-cols-3 gap-1.5">
          {(['home', 'work', 'other'] as const).map((l) => (
            <button key={l} onClick={() => setLabel(l)}
              className={`h-11 flex items-center justify-center gap-1.5 rounded-xl text-xs font-black transition active:scale-95 border ${
                label === l
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white/5 text-white/50 border-white/10 hover:border-white/25'
              }`}>
              {l === 'home' ? <Home className="h-3.5 w-3.5" /> : l === 'work' ? <Briefcase className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
      </Field>

      {label === 'other' && (
        <Field label="Nickname">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mom's place, Gym"
            className="w-full h-11 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
        </Field>
      )}

      <Field label="Address" sub={lat && lon ? `Pinned at ${lat.toFixed(4)}, ${lon.toFixed(4)}` : 'Type it or pick on the map'}>
        <textarea value={line} onChange={(e) => setLine(e.target.value)}
          placeholder="Flat 201, Sunshine Apts, MG Road, Bengaluru"
          rows={3}
          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition resize-none" />
        <button type="button" onClick={() => setShowPicker(true)}
          className="mt-2 w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-bold text-white/70 hover:bg-white/[0.07] transition">
          <Search className="h-3.5 w-3.5" /> Pick on Google Maps
        </button>
      </Field>

      <div className="flex gap-2 pt-1">
        {onDelete && (
          <button onClick={onDelete}
            className="h-12 w-12 rounded-2xl border border-red-500/25 bg-red-500/[0.06] flex items-center justify-center text-red-400 hover:bg-red-500/15 transition active:scale-95">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={handleSave} disabled={saving || !canSave}
          className="flex-1 h-12 rounded-2xl text-sm font-black text-white transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
          <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save address'}
        </button>
      </div>

      <AnimatePresence>
        {showPicker && (
          <LocationSearchModal
            onClose={() => setShowPicker(false)}
            onSelect={(r) => {
              setLine(r.displayName);
              setLat(r.lat);
              setLon(r.lon);
              setShowPicker(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Shared form field wrapper ───────────────────────────────────────────────
const Field = ({
  label, sub, children,
}: { label: string; sub?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold text-white/45 uppercase tracking-widest">{label}</label>
    {children}
    {sub && <p className="text-[10px] text-white/25">{sub}</p>}
  </div>
);

// ── Contacts editor sub-screen (existing) ───────────────────────────────────
const ContactsEditor = ({
  contacts, setContacts, saved, onSave, onBack,
}: {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  saved: boolean;
  onSave: () => void;
  onBack: () => void;
}) => (
  <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-4 max-w-lg mx-auto w-full space-y-4">
    <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
      ← Back
    </button>
    <h2 className="text-xl font-black text-white">Emergency Contacts</h2>
    <p className="text-xs text-white/35">At least 1 required. They will be notified when you trigger SOS.</p>

    {saved && (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
        ✅ Emergency contact added successfully
      </div>
    )}

    <div className="space-y-3">
      {contacts.map((c, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Contact {i + 1}</span>
            {contacts.length > 1 && (
              <button onClick={() => setContacts(cs => cs.filter((_, j) => j !== i))}
                className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <input value={c.name} onChange={e => setContacts(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            placeholder="Contact name"
            className="w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
          <input value={c.phone} onChange={e => setContacts(cs => cs.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))}
            placeholder="Phone number" type="tel"
            className="w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
        </div>
      ))}

      <button onClick={() => setContacts(cs => [...cs, { name: '', phone: '' }])}
        className="w-full h-10 flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 text-xs font-semibold text-white/40 hover:border-white/30 hover:text-white/60 transition">
        <Plus className="h-3.5 w-3.5" /> Add contact
      </button>
    </div>

    <button onClick={onSave}
      className="w-full h-12 rounded-2xl text-sm font-black text-white transition active:scale-95"
      style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
      Save Contacts
    </button>
  </div>
);

// ── Sensor dashboard sub-screen (existing) ──────────────────────────────────
const SensorDashboard = ({
  sample, setSample, detection, onBack,
}: {
  sample: SensorSample;
  setSample: (fn: (s: SensorSample) => SensorSample) => void;
  detection: ReturnType<typeof detectCrash>;
  onBack: () => void;
}) => {
  const navigate = useNavigate();
  const [mlResult, setMlResult] = React.useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  React.useEffect(() => {
    if (detection.crashed) {
      setIsAnalyzing(true);
      analyzeSeverityWithML(sample, 40).then(res => {
        setMlResult(res);
        setIsAnalyzing(false);
        
        if (res) {
          // Immediately navigate to the SOS Timer
          const sev = res.final_severity.toLowerCase();
          const urlParams = `crash=1&lat=${sample.lat}&lon=${sample.lon}&severity=${sev}&gforce=${sample.accelerationG.toFixed(2)}&from=${encodeURIComponent('/app/profile')}`;
          navigate(`/app/sos?${urlParams}`);
        }
      }).catch((err) => {
        console.error("ML Severity analysis failed:", err);
        setIsAnalyzing(false);
      });
    } else {
      setMlResult(null);
      setIsAnalyzing(false);
    }
  }, [detection.crashed, sample, navigate]);

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-4 max-w-lg mx-auto w-full space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
        ← Back
      </button>
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-emerald-400" />
        <h2 className="text-xl font-black text-white">Crash Detection Monitor</h2>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[10px] font-bold text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sensors Active
      </div>

      {/* AI Confidence */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#13141a] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white/60">
            <ShieldAlert className="h-3.5 w-3.5 text-white/25" /> AI Crash Confidence
          </div>
          <div className={`text-xl font-black ${detection.crashed ? 'text-red-400' : 'text-emerald-400'}`}>
            {detection.crashed ? '98%' : '0%'}
          </div>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${detection.crashed ? 'bg-red-500 w-[98%]' : 'bg-emerald-400 w-1'}`} />
        </div>
        
        {detection.crashed && isAnalyzing && (
          <div className="mt-4 flex items-center gap-2 text-[10px] text-white/60">
            <div className="h-3 w-3 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            Analyzing via Neural Engine...
          </div>
        )}

        {mlResult && !isAnalyzing && (
          <div className="mt-4 rounded-xl p-3" style={{ background: `${mlResult.triage_color}20`, border: `1px solid ${mlResult.triage_color}40` }}>
            <div className="flex justify-between items-start mb-2">
              <div className="text-xs font-black uppercase tracking-widest" style={{ color: mlResult.triage_color }}>
                {mlResult.final_severity} Severity
              </div>
              <div className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: mlResult.triage_color, color: '#fff' }}>
                {mlResult.triage_action}
              </div>
            </div>
            <ul className="space-y-1 mt-2">
              {mlResult.clinical_notes.map((note: string, i: number) => (
                <li key={i} className="text-[10px] text-white/80 flex items-start gap-1.5">
                  <span className="text-white/40 mt-0.5">•</span> {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

    {/* Sliders */}
    <div className="space-y-3">
      <SSlider label="Speed" unit="km/h" min={0} max={120} value={sample.speedKmh}
        onChange={v => setSample(s => ({ ...s, speedKmh: v }))} color="#3b82f6" />
      <SSlider label="G-Force" unit="G" min={0} max={4} step={0.1} value={sample.accelerationG}
        onChange={v => setSample(s => ({ ...s, accelerationG: v }))} color="#f59e0b" />
      <SSlider label="Tilt Angle" unit="°" min={0} max={180} value={sample.orientation === 'flipped' ? 180 : sample.vibration}
        onChange={v => setSample(s => ({ ...s, vibration: v, orientation: v > 90 ? 'flipped' : 'normal' }))} color="#a855f7" />
    </div>
  </div>
  );
};

const SSlider = ({ label, unit, min, max, step = 1, value, onChange, color }: {
  label: string; unit: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void; color: string;
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-[#13141a] p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-white/60">{label}</span>
        <span className="text-base font-black" style={{ color }}>
          {value.toFixed(step < 1 ? 1 : 0)} <span className="text-[10px] text-white/30">{unit}</span>
        </span>
      </div>
      <div className="relative h-2 flex items-center">
        <div className="absolute inset-0 bg-white/5 rounded-full" />
        <div className="absolute h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        <div className="absolute h-4 w-4 rounded-full bg-white shadow-lg -translate-x-1/2" style={{ left: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
    </div>
  );
};

const SettingRow = ({
  icon, label, sub, onClick, arrow,
}: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void; arrow?: boolean }) => (
  <div
    onClick={onClick}
    className={['flex items-center justify-between px-4 py-3.5', onClick ? 'cursor-pointer hover:bg-white/[0.03] active:bg-white/5' : ''].join(' ')}
  >
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-white/85">{label}</div>
        {sub && <div className="text-[10px] text-white/30 font-medium mt-0.5">{sub}</div>}
      </div>
    </div>
    {arrow && <ChevronRight className="h-4 w-4 text-white/20" />}
  </div>
);
