import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Route, Shield, User, Siren } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { listenCurrentSosRequest, type SosRequestDoc } from '../data/sos';
import { useLiveLocationTracking } from '../hooks/useLiveLocationTracking';

export const AppShell = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [request, setRequest] = useState<SosRequestDoc | null>(null);

  useEffect(() => {
    if (!user) return;
    return listenCurrentSosRequest(user.uid, setRequest);
  }, [user]);

  const isSosCompleted = request?.status === 'resolved' || request?.status === 'cancelled';
  const shouldTrack = !isSosCompleted;

  useLiveLocationTracking(shouldTrack);

  const handleSos = () => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    nav('/app/sos');
  };

  return (
    <div className="min-h-dvh bg-[#0a0b0f] dark:bg-[#0a0b0f] light:bg-gray-50 flex flex-col">
      <main className="flex-1 overflow-y-auto pb-[88px]">
        <Outlet />
      </main>

      {/* Bottom Nav — 4 side tabs + center SOS FAB ─────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 h-[78px] border-t border-white/[0.06] dark:bg-[#0e0f14]/95 bg-white/95 backdrop-blur-xl">
        <div className="relative grid grid-cols-5 h-full max-w-lg mx-auto">
          <BottomTab to="/app" label="Home" icon={<Home className="h-5 w-5" />} tint="emerald" end />
          <BottomTab to="/app/trips" label="Trips" icon={<Route className="h-5 w-5" />} tint="cyan" />

          {/* Center SOS FAB column — empty placeholder so the grid keeps 5 cols */}
          <div aria-hidden className="relative" />

          <BottomTab to="/app/safety" label="Safety" icon={<Shield className="h-5 w-5" />} tint="amber" />
          <BottomTab to="/app/profile" label="Profile" icon={<User className="h-5 w-5" />} tint="violet" />

          {/* Floating SOS button — visually pinned in the center */}
          <button
            id="btn-sos-fab"
            type="button"
            onClick={handleSos}
            aria-label="Trigger SOS"
            className="absolute left-1/2 -translate-x-1/2 -top-7 h-16 w-16 rounded-full flex flex-col items-center justify-center text-white shadow-[0_10px_30px_rgba(220,38,38,0.55)] active:scale-95 transition"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #ef4444 0%, #dc2626 55%, #991b1b 100%)',
              border: '4px solid #0e0f14',
            }}
          >
            <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30 -z-10" />
            <Siren className="h-6 w-6" />
            <span className="text-[9px] font-black tracking-widest leading-none mt-0.5">SOS</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

const TINT: Record<string, { text: string; bg: string }> = {
  red: { text: 'text-red-400', bg: 'bg-red-500/12' },
  cyan: { text: 'text-cyan-300', bg: 'bg-cyan-500/12' },
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/12' },
  amber: { text: 'text-amber-300', bg: 'bg-amber-500/12' },
  violet: { text: 'text-violet-300', bg: 'bg-violet-500/12' },
};

const BottomTab = ({
  to, label, icon, end, tint = 'red',
}: { to: string; label: string; icon: React.ReactNode; end?: boolean; tint?: string }) => {
  const t = TINT[tint] ?? TINT.red!;
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex flex-col items-center justify-center gap-1 transition-all',
          isActive
            ? t.text
            : 'text-white/35 hover:text-white/70',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span className={['p-1.5 rounded-xl transition-all', isActive ? t.bg : ''].join(' ')}>
            {icon}
          </span>
          <span className="text-[10px] font-bold tracking-wide">{label}</span>
        </>
      )}
    </NavLink>
  );
};
