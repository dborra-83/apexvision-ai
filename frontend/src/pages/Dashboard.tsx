/**
 * ApexVision AI — Unified Dashboard
 * All panels visible in one screen, compact and informative
 */

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '../store/theme-store';
import { D3SpeedGauge } from '../components/D3SpeedGauge';
import { D3SpeedTrace } from '../components/D3SpeedTrace';
import { D3PedalInputs } from '../components/D3PedalInputs';
import { D3RPMGauge } from '../components/D3RPMGauge';
import { D3RadarChart } from '../components/D3RadarChart';

interface TelemetryPoint {
  timestamp: number; speed: number; rpm: number; gear: number;
  throttle: number; brake: number; steering: number; drs: boolean;
  tireWear: number; detections: number;
}

function getRivalData(d: TelemetryPoint): TelemetryPoint {
  return { ...d, speed: Math.max(0, d.speed - 3 + Math.random() * 6), throttle: Math.max(0, Math.min(100, d.throttle - 2 + Math.random() * 4)), brake: Math.max(0, Math.min(100, d.brake + Math.random() * 5)), rpm: d.rpm - 100 + Math.round(Math.random() * 200), tireWear: Math.min(100, d.tireWear + 3 + Math.random() * 2), steering: d.steering + (Math.random() - 0.5) * 10, drs: d.speed > 260, detections: d.detections, timestamp: d.timestamp, gear: d.gear };
}

function useSyncedTelemetry(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [current, setCurrent] = useState<TelemetryPoint | null>(null);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { fetch('/telemetry_output.json').then(r => r.json()).then(d => setTelemetry(d.telemetry || [])).catch(() => {}); }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || telemetry.length === 0) return;
    const sync = () => {
      const time = video.currentTime;
      let ci = 0, min = Infinity;
      for (let i = 0; i < telemetry.length; i++) { const diff = Math.abs(telemetry[i].timestamp - time); if (diff < min) { min = diff; ci = i; } }
      setCurrent(telemetry[ci]); setIdx(ci);
      setHistory(telemetry.slice(Math.max(0, ci - 50), ci + 1));
    };
    const interval = setInterval(sync, 120);
    return () => clearInterval(interval);
  }, [telemetry, videoRef]);
  return { current, history, idx, total: telemetry.length };
}

export function Bar({ value, max = 100, color, label, showValue = true }: { value: number; max?: number; color: string; label: string; showValue?: boolean }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {showValue && <span className="text-[10px] font-mono font-bold" style={{ color }}>{Math.round(value)}%</span>}
      </div>
      <div className="h-[6px] rounded-full w-full" style={{ background: 'var(--bg-tertiary)' }}>
        <motion.div animate={{ width: `${Math.min(100, (value / max) * 100)}%` }} transition={{ duration: 0.1 }}
          className="h-full rounded-full" style={{ background: color }} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { current, history, idx, total } = useSyncedTelemetry(videoRef);
  const [isPlaying, setIsPlaying] = useState(false);
  const { theme, toggle } = useThemeStore();
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const d = current || { speed: 0, rpm: 0, gear: 0, throttle: 0, brake: 0, steering: 0, drs: false, tireWear: 0, detections: 0, timestamp: 0 };
  const r = getRivalData(d);
  const speedData = history.map(p => ({ t: p.timestamp, ver: Math.round(p.speed), ham: Math.round(Math.max(0, p.speed - 3 + Math.random() * 6)) }));
  const inputData = history.map(p => ({ t: p.timestamp, throttle: p.throttle, brake: p.brake }));

  const drivers = [
    { pos: 1, name: 'VER', gap: 'Leader', color: '#3b82f6' },
    { pos: 2, name: 'HAM', gap: '+0.337', color: '#06b6d4' },
    { pos: 3, name: 'LEC', gap: '+0.778', color: '#ef4444' },
    { pos: 4, name: 'NOR', gap: '+0.955', color: '#f97316' },
    { pos: 5, name: 'SAI', gap: '+1.167', color: '#ef4444' },
  ];

  const insights = [
    { color: 'var(--accent)', text: d.brake > 30 ? 'Heavy braking zone — optimal trail brake detected' : d.speed > 250 ? 'High-speed section — DRS advantage active' : 'Mid-corner phase — analyzing line deviation' },
    { color: 'var(--warning)', text: 'Tire degradation +0.02%/lap — pit window Lap 42-44 recommended' },
    { color: 'var(--success)', text: 'Gap to HAM stable at +0.337s — undercut risk low' },
  ];

  return (
    <div className="min-h-screen p-3" style={{ background: 'var(--bg-primary)' }}>
      {/* Compact header */}
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--accent)' }}>AV</div>
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>ApexVision AI</span>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: isPlaying ? 'var(--success-soft)' : 'var(--bg-tertiary)', color: isPlaying ? 'var(--success)' : 'var(--text-muted)' }}>
            {isPlaying ? '● LIVE' : '⏸ PAUSED'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>Frame {idx}/{total} · {d.timestamp.toFixed(1)}s</span>
          <button onClick={toggle} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs cursor-pointer" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main grid - everything visible at once */}
      <div className="grid grid-cols-12 gap-2.5">

        {/* Col 1: Video + Timing */}
        <div className="col-span-12 lg:col-span-4 space-y-2.5">
          {/* Video */}
          <div className="card overflow-hidden relative cursor-pointer"
            onClick={() => { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause(); }}>
            <video ref={videoRef} src="/video/verstappen-bathurst.mp4" className="w-full" style={{ borderRadius: '14px' }}
              onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} playsInline />
            {!isPlaying && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm"><span className="text-white text-base ml-0.5">▶</span></div></div>}
          </div>

          {/* Timing tower */}
          <div className="card p-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Positions</div>
            {drivers.map(dr => (
              <div key={dr.pos} className="flex items-center gap-1.5 py-[3px]">
                <span className="w-4 text-[10px] font-bold text-center" style={{ color: 'var(--text-muted)' }}>{dr.pos}</span>
                <span className="w-[3px] h-3 rounded-full" style={{ background: dr.color }} />
                <span className="text-[11px] font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{dr.name}</span>
                <span className="text-[10px] font-mono" style={{ color: dr.pos === 1 ? 'var(--accent)' : 'var(--text-muted)' }}>{dr.gap}</span>
              </div>
            ))}
          </div>

          {/* AI Insights */}
          <div className="card p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-4 h-4 rounded-md flex items-center justify-center text-[9px]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>⚡</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>AI Insights</span>
            </div>
            <div className="space-y-1.5">
              {insights.map((ins, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  <span className="w-[3px] h-3 rounded-full mt-0.5 shrink-0" style={{ background: ins.color }} />
                  <span className="text-[10px] leading-tight" style={{ color: 'var(--text-secondary)' }}>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Col 2: Telemetry + Charts */}
        <div className="col-span-12 lg:col-span-5 space-y-2">
          {/* Speed + Gear row */}
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-3 card p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[8px] uppercase" style={{ color: 'var(--text-muted)' }}>Speed</div>
                  <div className="metric-value text-3xl leading-none" style={{ color: 'var(--accent)' }}>{d.speed.toFixed(0)}<span className="text-xs ml-0.5" style={{ color: 'var(--text-muted)' }}>km/h</span></div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] uppercase" style={{ color: 'var(--text-muted)' }}>Gear</div>
                  <div className="metric-value text-3xl leading-none" style={{ color: 'var(--purple)' }}>{d.gear}</div>
                </div>
              </div>
              <div className="mt-1.5"><D3SpeedGauge speed={d.speed} history={history.map(h => h.speed)} /></div>
              <div className="mt-1"><D3RPMGauge rpm={d.rpm} /></div>
              <div className="text-right text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>{d.rpm} rpm</div>
            </div>
            <div className="col-span-2 grid grid-rows-2 gap-2">
              <div className="card p-2 flex flex-col items-center justify-center">
                <div className="text-[8px] uppercase" style={{ color: 'var(--text-muted)' }}>Throttle</div>
                <div className="metric-value text-xl" style={{ color: 'var(--success)' }}>{d.throttle}%</div>
                <div className="w-full h-1 rounded-full mt-1" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.throttle}%`, background: 'var(--success)' }} />
                </div>
              </div>
              <div className="card p-2 flex flex-col items-center justify-center">
                <div className="text-[8px] uppercase" style={{ color: 'var(--text-muted)' }}>Brake</div>
                <div className="metric-value text-xl" style={{ color: 'var(--danger)' }}>{d.brake}%</div>
                <div className="w-full h-1 rounded-full mt-1" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.brake}%`, background: 'var(--danger)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Speed comparison trace (D3) */}
          <div className="card p-2">
            <div className="flex justify-between mb-0.5">
              <span className="text-[8px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Speed · VER vs HAM</span>
              <div className="flex gap-2">
                <span className="flex items-center gap-0.5 text-[7px]" style={{ color: '#3b82f6' }}>━ VER</span>
                <span className="flex items-center gap-0.5 text-[7px]" style={{ color: '#06b6d4' }}>╌ HAM</span>
              </div>
            </div>
            <D3SpeedTrace data={speedData} />
          </div>

          {/* Pedal inputs trace (D3) */}
          <div className="card p-2">
            <div className="flex justify-between mb-0.5">
              <span className="text-[8px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Inputs</span>
              <div className="flex gap-2">
                <span className="text-[7px]" style={{ color: '#10b981' }}>━ Throttle</span>
                <span className="text-[7px]" style={{ color: '#ef4444' }}>━ Brake</span>
              </div>
            </div>
            <D3PedalInputs data={inputData} />
          </div>

          {/* Extra metrics row */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="card p-1.5 text-center"><div className="text-[7px] uppercase" style={{ color: 'var(--text-muted)' }}>Steer</div><div className="metric-value text-sm" style={{ color: 'var(--purple)' }}>{d.steering.toFixed(0)}°</div></div>
            <div className="card p-1.5 text-center"><div className="text-[7px] uppercase" style={{ color: 'var(--text-muted)' }}>DRS</div><div className="text-sm font-bold" style={{ color: d.drs ? 'var(--success)' : 'var(--text-muted)' }}>{d.drs ? 'ON' : 'OFF'}</div></div>
            <div className="card p-1.5 text-center"><div className="text-[7px] uppercase" style={{ color: 'var(--text-muted)' }}>Tires</div><div className="metric-value text-sm" style={{ color: d.tireWear > 60 ? 'var(--warning)' : 'var(--accent)' }}>{d.tireWear.toFixed(0)}%</div></div>
            <div className="card p-1.5 text-center"><div className="text-[7px] uppercase" style={{ color: 'var(--text-muted)' }}>YOLO</div><div className="metric-value text-sm" style={{ color: 'var(--accent)' }}>{d.detections}</div></div>
          </div>
        </div>

        {/* Col 3: H2H + Strategy */}
        <div className="col-span-12 lg:col-span-3 space-y-2.5">
          {/* Head to Head with Radar */}
          <div className="card p-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Head to Head</div>
            <div className="flex justify-between text-[9px] mb-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }}/><b>VER</b></span>
              <span className="flex items-center gap-1"><b>HAM</b><span className="w-2 h-2 rounded-full" style={{ background: '#06b6d4' }}/></span>
            </div>
            <D3RadarChart
              driver={[d.speed / 320, d.throttle / 100, 1 - d.brake / 100, 1 - d.tireWear / 100, 0.85]}
              rival={[r.speed / 320, r.throttle / 100, 1 - r.brake / 100, 1 - r.tireWear / 100, 0.78]}
              labels={['SPD', 'THR', 'BRK', 'TIRE', 'CONS']}
            />
            <div className="text-center mt-1">
              <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent)' }}>Gap: +0.337s</span>
            </div>
          </div>

          {/* Strategy */}
          <div className="card p-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Strategy</div>
            <div className="h-3 rounded-full overflow-hidden flex mb-1" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="h-full" style={{ width: '35%', background: '#ef4444' }} />
              <div className="h-full" style={{ width: '40%', background: '#e2e8f0' }} />
              <div className="h-full opacity-40" style={{ width: '25%', background: '#e2e8f0' }} />
            </div>
            <div className="flex justify-between text-[8px]" style={{ color: 'var(--text-muted)' }}>
              <span>Soft</span><span>Hard</span><span>?</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <div className="p-1.5 rounded-lg text-center" style={{ background: 'var(--warning-soft)' }}>
                <div className="text-[8px] font-semibold" style={{ color: 'var(--warning)' }}>PIT WINDOW</div>
                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Lap 42-44</div>
              </div>
              <div className="p-1.5 rounded-lg text-center" style={{ background: 'var(--success-soft)' }}>
                <div className="text-[8px] font-semibold" style={{ color: 'var(--success)' }}>FINISH</div>
                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>P1 (+2.3s)</div>
              </div>
            </div>
          </div>

          {/* Lap info */}
          <div className="card p-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Session</div>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Lap</span><span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-primary)' }}>32 / 53</span></div>
              <div className="flex justify-between"><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Best Lap</span><span className="text-[10px] font-mono font-bold" style={{ color: 'var(--purple)' }}>1:58.234</span></div>
              <div className="flex justify-between"><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Last Lap</span><span className="text-[10px] font-mono" style={{ color: 'var(--text-primary)' }}>1:58.891</span></div>
              <div className="flex justify-between"><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Fuel</span><span className="text-[10px] font-mono" style={{ color: 'var(--text-primary)' }}>67%</span></div>
              <div className="flex justify-between"><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Track Temp</span><span className="text-[10px] font-mono" style={{ color: 'var(--text-primary)' }}>42°C</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
