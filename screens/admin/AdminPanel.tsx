import { useEffect, useState } from 'react';
import { type HardwareSensorDoc, setHardwareSensor, startBackendSimulator } from '../../data/backendAdmin';
import { useAuth } from '../../auth/AuthProvider';
import { Cpu, Power, Car } from 'lucide-react';
import { createSosRequest } from '../../data/sos';
import { detectCrash } from '../../features/sos/crashDetection';

export const AdminPanel = () => {
  const { user } = useAuth();
  const [engineOn, setEngineOn] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [impact, setImpact] = useState(0.2);
  const [tilt, setTilt] = useState(2);
  const [lat, setLat] = useState(28.6139);
  const [lon, setLon] = useState(77.2090);

  const uid = user?.uid || 'guest';

  // Run the global countdown engine
  useEffect(() => {
    if (!engineOn) return;
    const unsub = startBackendSimulator();
    return () => unsub();
  }, [engineOn]);

  // The Backend Simulator Loop (Hardware Sync & Crash Detection)
  useEffect(() => {
    if (!engineOn) return;
    
    // Simulate updating hardware sensors every second
    const interval = setInterval(async () => {
      const data: HardwareSensorDoc = {
        uid,
        speedKmh: speed,
        impactG: impact,
        tiltRatio: tilt,
        location: { lat, lon },
        isOnline: true
      };
      
      await setHardwareSensor(uid, data);

      // Backend Crash Detection Logic
      // In a real system, the server processes the stream. Here, we do it in this interval.
      const sample = { speedKmh: speed, accelerationG: impact, orientation: tilt > 90 ? 'flipped' : 'normal', vibration: tilt, lat, lon };
      const prev = { speedKmh: speed + 2, accelerationG: 0.1, orientation: 'normal', vibration: 1, lat, lon }; // Dummy prev
      
      const res = detectCrash(prev as any, sample as any);
      if (res.crashed) {
        // Backend detected a crash! Trigger SOS if no active countdown exists (handled by listener in SosPage, but here we just trigger)
        // Note: In real life, backend checks if an SOS already exists to avoid duplicates. We assume it does.
        await createSosRequest({
          victimId: uid,
          status: 'countdown',
          severity: 'critical',
          source: 'hardware',
          countdown: 8,
          location: { lat, lon },
          radiusKm: 2,
        });

        // Turn off engine temporarily to avoid spam
        setEngineOn(false);
        alert('Backend Simulator: Crash Detected! SOS Triggered and Engine Paused.');
      }

    }, 2000);

    return () => clearInterval(interval);
  }, [engineOn, speed, impact, tilt, lat, lon, uid]);

  return (
    <div className="min-h-dvh bg-slate-950 p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Cpu className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Hardware Simulator</h1>
            <p className="text-xs text-white/40">Backend Emergency Engine</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white/70">Simulation Engine</span>
            <button
              onClick={() => setEngineOn(!engineOn)}
              className={`h-9 px-4 rounded-full text-xs font-black flex items-center gap-2 transition ${
                engineOn ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'
              }`}
            >
              <Power className="h-3 w-3" />
              {engineOn ? 'Engine Running' : 'Engine Off'}
            </button>
          </div>
          <p className="text-[10px] text-white/30 leading-relaxed">
            When ON, this acts as the cloud backend. It listens to the simulated hardware sensors below, detects crashes, writes to Firestore, and natively triggers the SOS requests for the active user.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">Hardware Inputs</h2>
          
          <div className="space-y-3">
            <Slider label="Speed (km/h)" min={0} max={180} value={speed} onChange={setSpeed} />
            <Slider label="Impact (G)" min={0} max={5} step={0.1} value={impact} onChange={setImpact} color="#f59e0b" />
            <Slider label="Tilt (°)" min={0} max={180} value={tilt} onChange={setTilt} color="#a855f7" />
            
            <div className="flex gap-2">
              <input type="number" placeholder="Lat" value={lat} onChange={e => setLat(Number(e.target.value))} className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white" />
              <input type="number" placeholder="Lon" value={lon} onChange={e => setLon(Number(e.target.value))} className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white" />
            </div>
            
            {/* Quick Crash Button inside inputs */}
            <button
              onClick={() => {
                setSpeed(120);
                setImpact(3.5);
                setTilt(110);
                if (!engineOn) setEngineOn(true);
              }}
              className="w-full h-12 rounded-xl flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm active:scale-95 transition"
            >
              <Car className="h-4 w-4" /> Simulate High-Impact Crash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Slider = ({ label, min, max, step = 1, value, onChange, color = '#3b82f6' }: any) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-[#13141a] p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-white/60">{label}</span>
        <span className="text-base font-black" style={{ color }}>{value}</span>
      </div>
      <div className="relative h-2 flex items-center">
        <div className="absolute inset-0 bg-white/5 rounded-full" />
        <div className="absolute h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
    </div>
  );
};
