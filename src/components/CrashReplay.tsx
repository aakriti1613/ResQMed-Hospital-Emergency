/**
 * CrashReplay.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Flight recorder" — a 10-second pre-crash playback of helmet telemetry.
 *
 * Why it wins:
 *   - When a helmet writes a crashEvent to Firestore, the previous samples
 *     buffered in useHelmetHistory are essentially the last few seconds before
 *     impact.
 *   - This component freezes that buffer and lets the user / hospital / family
 *     scrub through it: HR, SpO₂, vibration spikes, accelerometer magnitude,
 *     and GPS trail just before the moment of impact.
 *
 * Implementation notes:
 *   - Pure UI. Reads the buffer prop; doesn't subscribe to Firestore itself.
 *   - Auto-plays once when opened, then user can scrub.
 *   - "Open in Maps" deep links to the precise crash coordinate.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, MapPin, Activity } from 'lucide-react';
import type { HelmetSample } from '../hooks/useHelmetHistory';
import { Sparkline } from './Sparkline';
import { googleMapsUrl } from '../features/sos/liveCrashPrediction';

export const CrashReplay = ({
  open, onClose, samples, crashAt,
}: {
  open: boolean;
  onClose: () => void;
  samples: HelmetSample[];
  crashAt?: Date | null;
}) => {
  // Keep the buffer at the moment we opened, so live new samples don't shift it.
  const [frozen, setFrozen] = useState<HelmetSample[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const cutoffMs = (crashAt?.getTime() ?? Date.now()) - 1000;
    const start = cutoffMs - 10_000;
    const window = samples.filter(s => s.t >= start && s.t <= cutoffMs);
    setFrozen(window.length >= 2 ? window : samples.slice(-30));
    setIdx(0);
    setPlaying(true);
  }, [open, crashAt, samples]);

  // Playback timer — step through samples at ~real time.
  useEffect(() => {
    if (!open || !playing || frozen.length < 2) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => {
        if (i >= frozen.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 200);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [open, playing, frozen.length]);

  const current = frozen[idx];
  const hrSeries  = useMemo(() => frozen.slice(0, idx + 1).map(s => s.heartRate ?? NaN).filter(Number.isFinite), [frozen, idx]);
  const vibSeries = useMemo(() => frozen.slice(0, idx + 1).map(s => s.vibration ?? NaN).filter(Number.isFinite), [frozen, idx]);
  const accelMag = (s?: HelmetSample) => {
    if (!s) return 0;
    const x = s.ax ?? 0, y = s.ay ?? 0, z = s.az ?? 0;
    return Math.sqrt(x * x + y * y + z * z);
  };
  const accelSeries = useMemo(
    () => frozen.slice(0, idx + 1).map(s => accelMag(s)),
    [frozen, idx],
  );

  const tElapsed = current && frozen[0] ? Math.max(0, (current.t - frozen[0].t) / 1000) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="crash-replay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-5 sm:p-6 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center transition active:scale-95"
            >
              <X className="h-4 w-4 text-white/70" />
            </button>

            <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-rose-300 uppercase">
              <Activity className="h-3.5 w-3.5" /> Crash Replay · 10-second flight recorder
            </div>
            <div className="mt-1 text-lg font-black text-white">
              {crashAt ? new Date(crashAt).toLocaleString() : 'Captured moments before impact'}
            </div>

            {frozen.length < 2 ? (
              <div className="mt-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-8 text-center text-sm text-white/55">
                Not enough data in the buffer yet. Keep the helmet bridge running so a longer window is captured.
              </div>
            ) : (
              <>
                {/* Three sparkline panels */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <ReplayPanel label="HR (BPM)" value={current?.heartRate} series={hrSeries} color="#fb7185" />
                  <ReplayPanel label="Accel (m/s²)" value={accelMag(current)} series={accelSeries} color="#f97316" decimals={1} />
                  <ReplayPanel label="Vibration" value={current?.vibration} series={vibSeries} color="#facc15" />
                </div>

                {/* Scrubber */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] font-bold text-white/55">
                    <span>t = {tElapsed.toFixed(1)}s</span>
                    <span>{idx + 1} / {frozen.length}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={frozen.length - 1}
                    value={idx}
                    onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
                    className="w-full accent-rose-500 h-1 mt-1"
                  />
                </div>

                {/* Controls + location */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (idx >= frozen.length - 1) setIdx(0);
                      setPlaying((p) => !p);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-950 px-3 py-1.5 text-[12px] font-black hover:bg-white/90 transition active:scale-95"
                  >
                    {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {playing ? 'Pause' : (idx >= frozen.length - 1 ? 'Replay' : 'Play')}
                  </button>

                  {current?.lat !== undefined && current?.lon !== undefined && (
                    <a
                      href={googleMapsUrl(current.lat, current.lon) || '#'}
                      target="_blank" rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-3 py-1.5 text-[11px] font-black text-sky-200 hover:bg-sky-500/25 transition"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {current.lat.toFixed(4)}, {current.lon.toFixed(4)} ↗
                    </a>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ReplayPanel = ({
  label, value, series, color, decimals = 0,
}: { label: string; value?: number; series: number[]; color: string; decimals?: number }) => {
  const display = value === undefined ? '—' : (Number.isFinite(value) ? (value as number).toFixed(decimals) : '—');
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5 text-center">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-black leading-none" style={{ color }}>{display}</div>
      <div className="mt-2">
        <Sparkline data={series} width={92} height={26} color={color} dot fill />
      </div>
    </div>
  );
};
