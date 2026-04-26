import { Link } from 'react-router-dom';
import { ChevronRight, Heart, Users, Shield, FolderHeart, HandHeart } from 'lucide-react';

const rows = [
  { to: '/app/medical-id', title: 'Medical ID', desc: 'Blood group, allergies, conditions', icon: <Heart className="h-5 w-5 text-red-300" />, tint: 'from-red-500/20 to-red-600/5' },
  { to: '/app/safety-circle', title: 'Safety Circle', desc: 'Who we notify in an emergency', icon: <Users className="h-5 w-5 text-sky-300" />, tint: 'from-sky-500/20 to-sky-600/5' },
  { to: '/app/vault', title: 'Health Vault', desc: 'Reports & prescriptions', icon: <FolderHeart className="h-5 w-5 text-pink-300" />, tint: 'from-pink-500/20 to-pink-600/5' },
  { to: '/app/help', title: 'I Can Help', desc: 'Respond to nearby emergencies', icon: <HandHeart className="h-5 w-5 text-emerald-300" />, tint: 'from-emerald-500/20 to-emerald-600/5' },
];

export const SafetyHubPage = () => (
  <div className="min-h-full bg-[#0a0b0f] px-4 pt-10 pb-6 max-w-lg mx-auto w-full">
    <div className="flex items-center gap-3 mb-8">
      <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
        <Shield className="h-6 w-6 text-emerald-300" />
      </div>
      <div>
        <h1 className="text-xl font-black text-white">Safety</h1>
        <p className="text-xs text-white/40">Helmet One · your emergency toolkit</p>
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
            <div className="text-sm font-black text-white">{r.title}</div>
            <div className="text-[11px] text-white/45">{r.desc}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
        </Link>
      ))}
    </div>
  </div>
);
