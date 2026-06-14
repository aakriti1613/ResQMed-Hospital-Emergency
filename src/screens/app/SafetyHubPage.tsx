import { Link } from 'react-router-dom';
import { ChevronRight, Heart, Users, Shield, FolderHeart, HandHeart, Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const SafetyHubPage = () => {
  const { t } = useTranslation();

  const rows = [
    { to: '/app/challenges', titleKey: 'safety.healthChallenges', descKey: 'safety.healthChallengesDesc', icon: <Gamepad2 className="h-5 w-5 text-violet-300" />, tint: 'from-violet-500/20 to-violet-600/5' },
    { to: '/app/medical-id', titleKey: 'safety.medicalId', descKey: 'safety.medicalIdDesc', icon: <Heart className="h-5 w-5 text-red-300" />, tint: 'from-red-500/20 to-red-600/5' },
    { to: '/app/safety-circle', titleKey: 'safety.safetyCircle', descKey: 'safety.safetyCircleDesc', icon: <Users className="h-5 w-5 text-sky-300" />, tint: 'from-sky-500/20 to-sky-600/5' },
    { to: '/app/vault', titleKey: 'safety.healthVault', descKey: 'safety.healthVaultDesc', icon: <FolderHeart className="h-5 w-5 text-pink-300" />, tint: 'from-pink-500/20 to-pink-600/5' },
    { to: '/app/help', titleKey: 'safety.iCanHelp', descKey: 'safety.iCanHelpDesc', icon: <HandHeart className="h-5 w-5 text-emerald-300" />, tint: 'from-emerald-500/20 to-emerald-600/5' },
  ];

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-10 pb-6 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
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
    </div>
  );
};
