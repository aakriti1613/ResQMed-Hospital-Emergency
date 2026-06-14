import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ShieldCheck, Heart, Droplet, AlertTriangle, Pill, Phone, Maximize2, X,
  User, Cake, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthProvider';
import { listenUserProfile, type UserProfile } from '../../data/user';
import { useTranslation } from 'react-i18next';
import { appBackPath, appFromQuery, withFromContext, type ChallengeFrom } from '../../lib/challengeNav';

/**
 * Medical ID — a responder-facing summary of the user's vital health info.
 * Designed to be unlockable from the lock screen / home / SOS active screen
 * so first responders can see blood group, allergies, conditions, meds and
 * the primary emergency contact without unlocking the rest of the phone.
 *
 * The "Show Big" mode renders the same data as a full-screen card with very
 * large typography — meant to be presented to a paramedic at the scene.
 */
export const MedicalIdPage = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const from = appFromQuery(searchParams.get('from'));
  const backPath = appBackPath(from);
  const circleFrom: ChallengeFrom | null =
    from === 'safety' || from === 'home' || from === 'profile' ? from : null;
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bigMode, setBigMode] = useState(false);

  useEffect(() => {
    if (!user) {
      nav(`/login?redirect=${encodeURIComponent(`/app/medical-id${from ? `?from=${from}` : ''}`)}`);
      return;
    }
    return listenUserProfile(user.uid, setProfile);
  }, [user, nav, from]);

  const ageFromDob = (dob?: string): number | null => {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const age = ageFromDob(profile?.dob);
  const primaryContact = profile?.contacts?.[0];

  return (
    <div className="min-h-full bg-[#0a0b0f] max-w-lg mx-auto w-full pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0b0f]/95 backdrop-blur border-b border-white/[0.05] px-4 py-3 flex items-center gap-3">
        <button onClick={() => nav(backPath)} className="h-9 w-9 rounded-full bg-white/[0.05] hover:bg-white/[0.10] flex items-center justify-center transition">
          <ChevronLeft className="h-4 w-4 text-white/70" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-white truncate">{t('medicalId.title')}</h1>
          <p className="text-[11px] text-white/45 truncate">{t('medicalId.subtitle')}</p>
        </div>
        <button
          onClick={() => setBigMode(true)}
          className="h-9 px-3 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.10] flex items-center gap-1.5 text-[11px] font-black text-white/80 transition active:scale-95"
        >
          <Maximize2 className="h-3.5 w-3.5" /> {t('medicalId.showBig')}
        </button>
      </div>

      {/* Hero card */}
      <div className="mx-4 mt-4 rounded-3xl p-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#7f1d1d,#dc2626)' }}>
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/70">{t('medicalId.ice')}</div>
            <div className="text-lg font-black text-white truncate">{profile?.name || t('medicalId.addName')}</div>
            <div className="text-[12px] text-white/75 mt-0.5">
              {age !== null ? `${age} yrs` : 'Add date of birth'}
              {profile?.gender ? ` · ${profile.gender}` : ''}
              {profile?.bloodGroup ? ` · ${profile.bloodGroup}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Vitals row */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <VitalTile
          tint="#dc2626"
          icon={<Droplet className="h-4 w-4 text-white" />}
          label="Blood"
          value={profile?.bloodGroup || '—'}
        />
        <VitalTile
          tint="#10b981"
          icon={<Cake className="h-4 w-4 text-white" />}
          label="Age"
          value={age !== null ? String(age) : '—'}
        />
        <VitalTile
          tint="#3b82f6"
          icon={<User className="h-4 w-4 text-white" />}
          label="Gender"
          value={profile?.gender ? profile.gender[0]!.toUpperCase() + profile.gender.slice(1) : '—'}
        />
      </div>

      {/* Allergies */}
      <Section title="Allergies" icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />} color="text-amber-300">
        <ChipsOrEmpty value={profile?.allergies} placeholder="No allergies recorded" />
      </Section>

      {/* Medical conditions */}
      <Section title="Medical Conditions" icon={<Heart className="h-3.5 w-3.5 text-pink-300" />} color="text-pink-300">
        <ChipsOrEmpty value={profile?.medicalConditions} placeholder="None recorded" />
      </Section>

      {/* Medications */}
      <Section title="Medications" icon={<Pill className="h-3.5 w-3.5 text-violet-300" />} color="text-violet-300">
        <ChipsOrEmpty value={profile?.medications} placeholder="No regular medications" />
      </Section>

      {/* Primary emergency contact */}
      <Section title="Primary Emergency Contact" icon={<Phone className="h-3.5 w-3.5 text-emerald-300" />} color="text-emerald-300">
        {primaryContact ? (
          <a
            href={`tel:${primaryContact.phone}`}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 hover:bg-white/[0.06] transition active:scale-95"
          >
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-base font-black text-emerald-200 shrink-0">
              {primaryContact.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white truncate">{primaryContact.name}</div>
              <div className="text-[11px] text-white/50 truncate">{primaryContact.phone}</div>
            </div>
            <Phone className="h-4 w-4 text-emerald-300 shrink-0" />
          </a>
        ) : (
          <Link
            to={withFromContext('/app/safety-circle', circleFrom ?? 'safety')}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 hover:bg-white/[0.04] transition"
          >
            <div className="h-10 w-10 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
              <Phone className="h-4 w-4 text-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-black text-white">Add emergency contact</div>
              <div className="text-[10px] text-white/45">Tap to open Safety Circle</div>
            </div>
            <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
          </Link>
        )}
      </Section>

      {/* Privacy line */}
      <div className="mx-4 mt-4 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
        <span className="text-[10px] text-white/55 leading-snug">
          This data is encrypted and only released during an active emergency.
        </span>
      </div>

      <div className="mx-4 mt-4">
        <Link
          to="/app/profile"
          className="block w-full text-center text-[11px] font-bold text-sky-300 hover:text-sky-200 underline underline-offset-2"
        >
          Edit Medical ID in Profile →
        </Link>
      </div>

      {/* Big mode overlay */}
      <AnimatePresence>
        {bigMode && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#0a0b0f] flex flex-col"
          >
            <div className="px-5 pt-6 flex items-center justify-end">
              <button
                onClick={() => setBigMode(false)}
                className="h-11 w-11 rounded-full bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-center"
              >
                <X className="h-5 w-5 text-white/80" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-10">
              <div className="text-[12px] font-black uppercase tracking-widest text-red-300">Medical ID</div>
              <div className="mt-1 text-3xl font-black text-white leading-tight">{profile?.name || 'Unknown'}</div>
              <div className="mt-2 text-base text-white/65">
                {age !== null ? `${age} years` : '— years'}
                {profile?.gender ? ` · ${profile.gender}` : ''}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <BigField label="Blood Group" value={profile?.bloodGroup || '—'} tint="#dc2626" />
                <BigField label="Allergies" value={profile?.allergies || 'None'} tint="#f59e0b" />
                <BigField label="Conditions" value={profile?.medicalConditions || 'None'} tint="#ec4899" />
                <BigField label="Medications" value={profile?.medications || 'None'} tint="#8b5cf6" />
              </div>

              {primaryContact && (
                <div className="mt-8">
                  <div className="text-[12px] font-black uppercase tracking-widest text-emerald-300 mb-2">
                    Emergency Contact
                  </div>
                  <a
                    href={`tel:${primaryContact.phone}`}
                    className="flex items-center gap-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4"
                  >
                    <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-xl font-black text-emerald-200 shrink-0">
                      {primaryContact.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-black text-white truncate">{primaryContact.name}</div>
                      <div className="text-base text-emerald-200">{primaryContact.phone}</div>
                    </div>
                    <Phone className="h-6 w-6 text-emerald-300 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const VitalTile = ({
  tint, icon, label, value,
}: { tint: string; icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-2xl border border-white/[0.05] bg-[#13141a] p-3">
    <div className="h-8 w-8 rounded-xl flex items-center justify-center"
      style={{ background: tint }}>
      {icon}
    </div>
    <div className="mt-2 text-[9px] font-black uppercase tracking-wider text-white/40">{label}</div>
    <div className="text-sm font-black text-white truncate">{value}</div>
  </div>
);

const Section = ({
  title, icon, color, children,
}: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) => (
  <div className="mx-4 mt-4">
    <div className={`flex items-center gap-1.5 mb-1.5 text-[10px] font-black uppercase tracking-widest ${color}`}>
      {icon}
      {title}
    </div>
    {children}
  </div>
);

const ChipsOrEmpty = ({ value, placeholder }: { value?: string; placeholder: string }) => {
  const items = (value ?? '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/40">
        {placeholder}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-white/80">
          {it}
        </span>
      ))}
    </div>
  );
};

const BigField = ({ label, value, tint }: { label: string; value: string; tint: string }) => (
  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
    <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: tint }}>{label}</div>
    <div className="mt-1 text-lg font-black text-white leading-tight break-words">{value}</div>
  </div>
);
