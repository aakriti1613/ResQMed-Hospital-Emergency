import { Link } from 'react-router-dom';
import { ChevronRight, Heart, Users, Shield, FolderHeart, HandHeart, Gamepad2, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const SafetyHubPage = () => {
  const { t } = useTranslation();

  const rows = [
    { to: '/app/challenges?from=safety', titleKey: 'safety.healthChallenges', descKey: 'safety.healthChallengesDesc', icon: <Gamepad2 className="h-5 w-5 text-violet-300" />, tint: 'from-violet-500/20 to-violet-600/5' },
    { to: '/app/medical-id?from=safety', titleKey: 'safety.medicalId', descKey: 'safety.medicalIdDesc', icon: <Heart className="h-5 w-5 text-red-300" />, tint: 'from-red-500/20 to-red-600/5' },
    { to: '/app/safety-circle?from=safety', titleKey: 'safety.safetyCircle', descKey: 'safety.safetyCircleDesc', icon: <Users className="h-5 w-5 text-sky-300" />, tint: 'from-sky-500/20 to-sky-600/5' },
    { to: '/app/vault?from=safety', titleKey: 'safety.healthVault', descKey: 'safety.healthVaultDesc', icon: <FolderHeart className="h-5 w-5 text-pink-300" />, tint: 'from-pink-500/20 to-pink-600/5' },
    { to: '/app/help?from=safety', titleKey: 'safety.iCanHelp', descKey: 'safety.iCanHelpDesc', icon: <HandHeart className="h-5 w-5 text-emerald-300" />, tint: 'from-emerald-500/20 to-emerald-600/5' },
  ];

  const helplines = [
    { num: '112', label: t('dashboard.helplineEmergency'), color: '#dc2626' },
    { num: '108', label: t('dashboard.helplineAmbulance'), color: '#10b981' },
    { num: '100', label: t('dashboard.helplinePolice'), color: '#3b82f6' },
    { num: '1091', label: t('dashboard.helplineWomen'), color: '#a855f7' },
  ];

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-10 pb-6 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <Shield className="h-6 w-6 text-emerald-300" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">{t('safety.title')}</h1>
          <p className="text-xs text-white/40">{t('safety.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className={`flex items-center gap-4 rounded-3xl border border-white/[0.06] bg-gradient-to-r ${r.tint} p-4 hover:border-white/12 transition active:scale-[0.99]`}
          >
            <div className="h-11 w-11 rounded-2xl bg-black/30 flex items-center justify-center shrink-0">{r.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white">{t(r.titleKey)}</div>
              <div className="text-[11px] text-white/45">{t(r.descKey)}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-white/[0.06] bg-[#13141a] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="h-4 w-4 text-red-300" />
          <span className="text-xs font-black text-white">{t('safety.emergencyHelplines')}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {helplines.map((h) => (
            <a
              key={h.num}
              href={`tel:${h.num}`}
              className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.05] bg-white/[0.02] py-2.5 active:scale-95 transition"
            >
              <span className="text-sm font-black" style={{ color: h.color }}>{h.num}</span>
              <span className="text-[8px] text-white/35 font-semibold text-center leading-tight px-0.5">{h.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
