import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../auth/authActions';
import { useAuth } from '../../auth/AuthProvider';
import { Settings, LogOut, User, Shield, Droplets, Activity, ShieldAlert } from 'lucide-react';
import { detectCrash, type SensorSample } from '../../features/sos/crashDetection';

export const SettingsPage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  // Crash detection monitor state
  const [sample, setSample] = useState<SensorSample>({
    lat: 28.6139, lon: 77.209, speedKmh: 42, accelerationG: 0.4, orientation: 'normal', vibration: 10,
  });
  const prevRef = useRef<SensorSample | null>(null);
  const detection = useMemo(() => detectCrash(prevRef.current, sample), [sample]);
  const setPrev = () => { prevRef.current = sample; };

  return (
    <div className="flex flex-col items-center max-w-lg mx-auto w-full pb-12 pt-4 space-y-4 px-4">
      {/* Profile Card */}
      <div className="w-full rounded-3xl border border-white/[0.06] bg-[#13141a] p-6 shadow-xl">
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
          <Settings className="h-3.5 w-3.5" /> Preferences
        </div>
        <div className="text-2xl font-black tracking-tight text-white mb-1">Settings</div>
        <p className="text-xs text-white/35">Manage your emergency profile</p>

        <div className="mt-5 space-y-2">
          <SettingItem icon={<User className="h-4 w-4" />} title="Profile Details" subtitle={user?.displayName || 'Guest User'} />
          <SettingItem icon={<Shield className="h-4 w-4" />} title="Emergency Contacts" subtitle="0 configured" alert />
          <SettingItem icon={<Droplets className="h-4 w-4 text-red-400" />} title="Blood Group & Allergies" subtitle="Not set" alert />
        </div>

        <div className="mt-5 pt-5 border-t border-white/[0.05]">
          <button
            type="button"
            disabled={busy || !user}
            onClick={async () => {
              setBusy(true);
              try { await logout(); nav('/'); } finally { setBusy(false); }
            }}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-4 text-xs font-black text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
          >
            {busy ? 'Signing out...' : <><LogOut className="h-4 w-4" /> Log out</>}
          </button>
        </div>
      </div>

      {/* ── Crash Detection Monitor ── */}
      <div className="w-full rounded-3xl border border-white/[0.06] bg-[#13141a] p-6 shadow-xl">
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
          <Activity className="h-3.5 w-3.5" /> Diagnostics
        </div>
        <div className="text-xl font-black text-white mb-1">Crash Detection Monitor</div>
        <p className="text-xs text-white/35">Adjust sliders to simulate sensor readings</p>

        {/* Sensor status badge */}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[10px] font-bold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sensors Active
        </div>

        {/* AI Confidence */}
        <div className="mt-4 rounded-2xl border border-white/[0.05] bg-black/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white/70">
              <ShieldAlert className="h-3.5 w-3.5 text-white/30" /> AI Crash Confidence
            </div>
            <div className={`text-lg font-black ${detection.crashed ? 'text-red-400' : 'text-emerald-400'}`}>
              {detection.crashed ? '84%' : '0%'}
            </div>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full transition-all ${detection.crashed ? 'bg-red-500 w-[84%]' : 'bg-emerald-400 w-1'}`} />
          </div>
          {detection.crashed && (
            <div className="mt-2 text-[10px] text-red-300">⚠ Crash indicators: {detection.reasons.join(', ')}</div>
          )}
        </div>

        {/* Sliders */}
        <div className="mt-3 space-y-3">
          <SensorSlider
            label="Speed" icon="speed" unit="km/h" min={0} max={120} value={sample.speedKmh}
            onChange={(v) => { setPrev(); setSample((s) => ({ ...s, speedKmh: v })); }}
          />
          <SensorSlider
            label="G-Force / Impact" icon="force" unit="G" min={0} max={4} step={0.1} value={sample.accelerationG}
            onChange={(v) => { setPrev(); setSample((s) => ({ ...s, accelerationG: v })); }}
          />
          <SensorSlider
            label="Tilt Angle" icon="tilt" unit="°" min={0} max={180}
            value={sample.orientation === 'flipped' ? 180 : sample.vibration}
            onChange={(v) => { setPrev(); setSample((s) => ({ ...s, vibration: v, orientation: v > 90 ? 'flipped' : 'normal' })); }}
          />
        </div>
      </div>

      <p className="text-center text-[10px] text-white/20">Arogya Raksha v1.0 • Demo mode</p>
    </div>
  );
};

const SettingItem = ({ icon, title, subtitle, alert }: { icon: React.ReactNode; title: string; subtitle: string; alert?: boolean }) => (
  <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 flex items-center justify-between hover:bg-white/[0.04] transition cursor-pointer">
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-white/85">{title}</div>
        <div className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${alert ? 'text-red-400' : 'text-white/30'}`}>{subtitle}</div>
      </div>
    </div>
  </div>
);

const SensorSlider = ({ label, icon, value, min, max, step, unit, onChange }: {
  label: string; icon: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void;
}) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const iconColors: Record<string, string> = { speed: '#3b82f6', force: '#f59e0b', tilt: '#a855f7' };
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-black/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white/70">
          <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: `${iconColors[icon]}18`, color: iconColors[icon] }}>
            {icon === 'speed' && <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22l10-4 10 4L12 2z"/></svg>}
            {icon === 'force' && <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
            {icon === 'tilt' && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          </div>
          {label}
        </div>
        <div className="text-base font-black text-emerald-400">
          {value.toFixed(step && step < 1 ? 1 : 0)} <span className="text-[10px] text-white/30">{unit}</span>
        </div>
      </div>
      <div className="relative h-2 flex items-center">
        <div className="absolute inset-0 bg-white/5 rounded-full" />
        <div className="absolute h-full bg-white/10 rounded-full" style={{ width: `${pct}%` }} />
        <div className="absolute h-4 w-4 bg-red-500 shadow-[0_0_10px_rgba(220,38,38,0.7)] rounded-full -translate-x-1/2" style={{ left: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step ?? 1} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
    </div>
  );
};
