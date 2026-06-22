/**
 * ApexVision AI — Racing Dashboard DDU Style (v3)
 * Features: i18n (es/en), dark/light themes, session logging,
 * engine temps, detailed tires, fuel consumption, AI recommendations,
 * event history with track position.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useIRacingLive } from '../hooks/useIRacingLive';
import { useLangStore } from '../store/lang-store';
import { useThemeStore } from '../store/theme-store';
import { useSessionLogStore, SessionEvent } from '../store/session-log-store';
import { liveTranslations, LiveT } from './live-i18n';
import { playAlertSound, unlockAudio } from '../utils/sound-alerts';
import { findTrackInfo } from '../data/track-info';
import { TrackMapLinear, SectorTimes, InputTrace, InputSample, SectorTime } from '../components/LiveTelemetryPanels';
import { IconDriver, IconCar, IconTrack, IconFuel, IconEngine, IconTire, IconWeather, IconGForce, IconAI, IconClock, IconSpeed, IconLog, IconInfo } from '../components/RacingIcons';
import '../racing.css';

// --- Helpers ---
const fmt = (t: number) => t > 0 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}` : '--:--.---';

function useLiveT(): LiveT {
  const lang = useLangStore((s) => s.lang);
  return liveTranslations[lang] || liveTranslations.en;
}

// --- AI Recommendation Engine ---
interface AIRecommendation {
  id: string;
  type: 'warning' | 'tip' | 'strategy';
  message: string;
  priority: number;
}

function generateRecommendations(d: Record<string, unknown>, t: LiveT, sessionEvents: SessionEvent[]): AIRecommendation[] {
  const recs: AIRecommendation[] = [];
  const fuelPct = (d.fuelPercent as number) || 0;
  const lap = (d.lap as number) || 0;
  const fuelPerLap = lap > 1 ? (100 - fuelPct) / (lap - 1) : 0;
  const fuelLaps = fuelPerLap > 0 ? Math.floor(fuelPct / fuelPerLap) : 99;
  const maxWear = Math.max(
    (d.tireLF_wear as number) || 0, (d.tireRF_wear as number) || 0,
    (d.tireLR_wear as number) || 0, (d.tireRR_wear as number) || 0
  );
  const trackTemp = (d.trackTemp as number) || 0;
  const handling = (d.handling as string) || 'neutral';
  const delta = (d.deltaToSessionBest as number) || 0;
  const lapsRemaining = (d.sessionLapsRemaining as number) || 99;
  const incidentCount = (d.incidentCount as number) || 0;
  const windSpeed = (d.windSpeed as number) || 0;
  const oilTemp = (d.oilTemp as number) || 0;
  const waterTemp = (d.waterTemp as number) || 0;

  // Track off patterns - find repeated off-tracks at same position
  const recentOffs = sessionEvents.filter((e) => e.type === 'off_track').slice(-10);
  const trackPctClusters = new Map<number, number>();
  recentOffs.forEach((e) => {
    const zone = Math.round(e.trackPct / 5) * 5; // group by 5% zones
    trackPctClusters.set(zone, (trackPctClusters.get(zone) || 0) + 1);
  });

  // Fuel
  if (fuelLaps <= 2 && fuelLaps > 0) {
    recs.push({ id: 'fuel-crit', type: 'warning', priority: 1, message: `⛽ ${t.fuel}: ${fuelLaps} ${t.lapsLeft}. PIT NOW!` });
  } else if (fuelLaps <= 5) {
    recs.push({ id: 'fuel-low', type: 'strategy', priority: 2, message: `⛽ ${t.fuel}: ~${fuelLaps} ${t.lapsLeft}` });
  }

  // Tires
  if (maxWear > 80) {
    recs.push({ id: 'tire-crit', type: 'warning', priority: 1, message: `🛞 ${t.wear} ${maxWear.toFixed(0)}% — grip loss imminent` });
  } else if (maxWear > 55) {
    recs.push({ id: 'tire-high', type: 'strategy', priority: 3, message: `🛞 ${t.wear} ${maxWear.toFixed(0)}% — consider pit` });
  }

  // Handling
  if (handling === 'oversteer') {
    recs.push({ id: 'os', type: 'tip', priority: 3, message: `🔄 ${t.oversteer}: smooth throttle exit, reduce mid-corner speed` });
  } else if (handling === 'understeer') {
    recs.push({ id: 'us', type: 'tip', priority: 3, message: `🔄 ${t.understeer}: trail-brake deeper, earlier turn-in` });
  }

  // Engine temps
  if (oilTemp > 130) {
    recs.push({ id: 'oil-hot', type: 'warning', priority: 2, message: `🌡️ ${t.oilTemp}: ${oilTemp}°C — risk of damage` });
  }
  if (waterTemp > 110) {
    recs.push({ id: 'water-hot', type: 'warning', priority: 2, message: `💧 ${t.waterTemp}: ${waterTemp}°C — overheating!` });
  }

  // Track temp
  if (trackTemp > 45) {
    recs.push({ id: 'track-hot', type: 'tip', priority: 4, message: `🌡️ ${t.trackTemp}: ${trackTemp}°C — high degradation` });
  }

  // Wind
  if (windSpeed > 20) {
    recs.push({ id: 'wind', type: 'tip', priority: 4, message: `💨 ${t.wind}: ${windSpeed.toFixed(0)} km/h` });
  }

  // Repeated off-tracks at same corner
  trackPctClusters.forEach((count, zone) => {
    if (count >= 2) {
      recs.push({ id: `corner-${zone}`, type: 'strategy', priority: 2, message: `⚠️ ${count}x ${t.offTrack} @ ${zone}% — slow entry in that zone` });
    }
  });

  // Pace
  if (delta > 2.0 && lap > 3) {
    recs.push({ id: 'pace', type: 'strategy', priority: 3, message: `📊 +${delta.toFixed(1)}s vs best — push harder or check line` });
  }

  // Incidents
  if (incidentCount >= 8) {
    recs.push({ id: 'inc', type: 'warning', priority: 2, message: `⚠️ ${incidentCount}x ${t.incidents} — close to DQ limit` });
  }

  // End race
  if (lapsRemaining <= 3 && lapsRemaining > 0) {
    recs.push({ id: 'end', type: 'strategy', priority: 2, message: `🏁 ${lapsRemaining} ${t.lapsLeft} — push, manage risk` });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// --- Sub-components ---

function ConnectScreen({ onConnect }: { onConnect: (url: string) => void }) {
  const t = useLiveT();
  const [input, setInput] = useState(localStorage.getItem('iracing_ws_url') || '');
  return (
    <div className="racing-app flex items-center justify-center h-screen">
      <div className="rc-card p-8 w-80 text-center">
        <div className="text-2xl font-black mb-1" style={{ color: 'var(--rc-cyan)' }}>APEXVISION</div>
        <div className="rc-label mb-6">{t.telemetry}</div>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="192.168.1.49:8765"
          className="w-full px-4 py-3 rounded-lg text-sm font-mono bg-black border border-[#333] text-white mb-3 focus:border-[var(--rc-cyan)] focus:outline-none"
          onKeyDown={e => e.key === 'Enter' && onConnect(input)} />
        <button onClick={() => onConnect(input)}
          className="w-full py-3 rounded-lg text-sm font-bold text-black transition-transform hover:scale-[1.02]"
          style={{ background: 'var(--rc-cyan)' }}>
          {t.connect}
        </button>
      </div>
    </div>
  );
}

function RPMBar({ rpm, max = 8000, shift = 7200 }: { rpm: number; max?: number; shift?: number }) {
  const segs = 20;
  const active = Math.round((rpm / max) * segs);
  return (
    <div className="flex gap-[2px] h-4">
      {Array.from({ length: segs }, (_, i) => {
        const on = i < active;
        const isRed = i >= (shift / max) * segs;
        const isYellow = i >= segs * 0.7 && !isRed;
        const color = isRed ? 'var(--rc-red)' : isYellow ? 'var(--rc-yellow)' : 'var(--rc-green)';
        return (
          <div key={i} className="flex-1 rounded-sm rpm-segment"
            style={{ background: on ? color : '#1a1a1a', opacity: on ? 1 : 0.15, boxShadow: on && i === active - 1 ? `0 0 6px ${color}` : 'none' }} />
        );
      })}
    </div>
  );
}

function TempGauge({ value, max, label, icon, unit = '°C' }: { value: number; max: number; label: string; icon: string; unit?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 85 ? 'var(--rc-red)' : pct > 65 ? 'var(--rc-yellow)' : 'var(--rc-green)';
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 text-center">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>{label}</span>
          <span className="text-xs font-mono font-bold" style={{ color }}>{value > 0 ? `${value}${unit}` : '--'}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--rc-surface)' }}>
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

function FuelGauge({ value, max = 100, label, icon }: { value: number; max?: number; label: string; icon: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct < 15 ? 'var(--rc-red)' : pct < 30 ? 'var(--rc-yellow)' : 'var(--rc-green)';
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 text-center">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>{label}</span>
          <span className="text-xs font-mono font-bold" style={{ color }}>{value.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--rc-surface)' }}>
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export function Live() {
  const t = useLiveT();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const { events, addEvent, updateMaxSpeed, maxSpeedSession, lastProcessedLap, setLastProcessedLap, isOffTrackCooldown, setOffTrackCooldown, clearSession } = useSessionLogStore();

  const [wsUrl, setWsUrl] = useState(localStorage.getItem('iracing_ws_url') || '');
  const { data, connected, connect, disconnect } = useIRacingLive(wsUrl || undefined);
  const gHistRef = useRef<{ x: number; y: number }[]>([]);
  const [showDashboard, setShowDashboard] = useState(!!wsUrl);
  const [showEvents, setShowEvents] = useState(false);

  // Input trace history (throttle/brake over time)
  const inputSamplesRef = useRef<InputSample[]>([]);
  const [inputSamples, setInputSamples] = useState<InputSample[]>([]);
  // Sector times tracking
  const [currentSectors, setCurrentSectors] = useState<SectorTime[]>([]);
  const [previousSectors, setPreviousSectors] = useState<SectorTime[]>([]);
  const lastSectorRef = useRef(0);
  const sectorStartTimeRef = useRef(0);

  const handleConnect = useCallback((url: string) => {
    const full = url.startsWith('ws') ? url : `ws://${url}`;
    setWsUrl(full); localStorage.setItem('iracing_ws_url', full); connect(full);
    setShowDashboard(true);
    unlockAudio(); // Unlock Web Audio on user interaction
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect(); setShowDashboard(false); setWsUrl('');
    localStorage.removeItem('iracing_ws_url');
  }, [disconnect]);

  const lastValidData = useRef(data);
  if (data && data.speed !== undefined) lastValidData.current = data;

  const currentData = lastValidData.current || data;
  if (currentData && currentData.gLateral !== undefined) {
    gHistRef.current = [...gHistRef.current.slice(-25), { x: currentData.gLateral || 0, y: currentData.gLongitudinal || 0 }];
  }

  // Session event tracking
  useEffect(() => {
    if (!currentData) return;
    const d = currentData as unknown as Record<string, unknown>;
    const speed = (d.speed as number) || 0;
    const lap = (d.lap as number) || 0;
    const trackPct = (d.lapDistPct as number) || 0;
    const isOffTrack = (d.isOffTrack as boolean) || false;

    // Track max speed
    updateMaxSpeed(speed);

    // Off-track detection with cooldown
    if (isOffTrack && !isOffTrackCooldown && speed > 20) {
      addEvent({ lap, trackPct, type: 'off_track', message: `Off track @ ${trackPct.toFixed(0)}% (L${lap})` });
      setOffTrackCooldown(true);
      setTimeout(() => setOffTrackCooldown(false), 3000);
    }

    // New lap completed
    if (lap > 0 && lap !== lastProcessedLap && lastProcessedLap > 0) {
      const lastLapTime = (d.lastLapTime as number) || 0;
      const bestLapTime = (d.bestLapTime as number) || 0;
      if (lastLapTime > 0 && lastLapTime === bestLapTime) {
        addEvent({ lap: lap - 1, trackPct: 0, type: 'best_lap', message: `New best: ${fmt(lastLapTime)} (L${lap - 1})` });
      }
    }
    if (lap > 0 && lap !== lastProcessedLap) {
      setLastProcessedLap(lap);
    }

    // Input trace — record throttle/brake over time
    const thr = (d.throttle as number) || 0;
    const brk = (d.brake as number) || 0;
    const now = Date.now();
    inputSamplesRef.current.push({ t: now, throttle: thr, brake: brk });
    // Keep last 15 seconds
    const cutoff = now - 15000;
    inputSamplesRef.current = inputSamplesRef.current.filter((s) => s.t >= cutoff);
    // Update state at ~5Hz (every 2nd call at 10Hz input)
    if (inputSamplesRef.current.length % 2 === 0) {
      setInputSamples([...inputSamplesRef.current]);
    }

    // Sector tracking (3 sectors at 33%/66%/100%)
    const sector = trackPct < 33 ? 1 : trackPct < 66 ? 2 : 3;
    const currentLapTimeVal = (d.currentLapTime as number) || 0;
    if (sector !== lastSectorRef.current && currentLapTimeVal > 0) {
      // Sector changed
      if (lastSectorRef.current > 0 && sectorStartTimeRef.current > 0) {
        const sectorTime = currentLapTimeVal - sectorStartTimeRef.current;
        if (sectorTime > 0 && sectorTime < 120) { // sanity check
          setCurrentSectors((prev) => {
            const updated = [...prev];
            const idx = lastSectorRef.current - 1;
            updated[idx] = { sector: lastSectorRef.current, time: sectorTime };
            return updated;
          });
        }
      }
      // Reset for new sector
      sectorStartTimeRef.current = currentLapTimeVal;
      lastSectorRef.current = sector;

      // On new lap (sector goes from 3 to 1), save previous sectors
      if (sector === 1 && currentSectors.length > 0) {
        setPreviousSectors([...currentSectors]);
        setCurrentSectors([]);
      }
    }
    if (lastSectorRef.current === 0) {
      lastSectorRef.current = sector;
      sectorStartTimeRef.current = currentLapTimeVal;
    }
  }, [currentData, lastProcessedLap, isOffTrackCooldown, addEvent, updateMaxSpeed, setOffTrackCooldown, setLastProcessedLap, currentSectors]);

  if (!showDashboard) return <ConnectScreen onConnect={handleConnect} />;

  const d = (currentData || {}) as unknown as Record<string, unknown>;
  const speed = (d.speed as number) || 0;
  const rpm = (d.rpm as number) || 0;
  const gear = (d.gear as number) || 0;
  const throttle = (d.throttle as number) || 0;
  const brake = (d.brake as number) || 0;
  const clutch = (d.clutch as number) || 0;
  const steering = (d.steering as number) || 0;
  const lap = (d.lap as number) || 0;
  const position = (d.position as number) || 0;
  const lastLapTime = (d.lastLapTime as number) || 0;
  const bestLapTime = (d.bestLapTime as number) || 0;
  const currentLapTime = (d.currentLapTime as number) || 0;
  const delta = (d.deltaToSessionBest as number) || (d.deltaToBestLap as number) || (d.deltaToOptimal as number) || 0;
  const fuelPercent = (d.fuelPercent as number) || 0;
  const fuelLevelLiters = (d.fuelLevelLiters as number) || (d.fuelLevel as number) || 0;
  const fuelUsePerHour = (d.fuelUsePerHour as number) || 0;
  const gLateral = (d.gLateral as number) || 0;
  const gLongitudinal = (d.gLongitudinal as number) || 0;
  const onPitRoad = (d.onPitRoad as boolean) || false;
  const incidentCount = (d.incidentCount as number) || 0;
  const shiftIndicator = (d.shiftIndicator as number) || 0;
  const handling = (d.handling as string) || 'neutral';
  const absOn = (d.absActive as boolean) || false;
  // Tires
  const tireLF_temp = (d.tireLF_temp as number) || 0;
  const tireRF_temp = (d.tireRF_temp as number) || 0;
  const tireLR_temp = (d.tireLR_temp as number) || 0;
  const tireRR_temp = (d.tireRR_temp as number) || 0;
  const tireLF_wear = (d.tireLF_wear as number) || 0;
  const tireRF_wear = (d.tireRF_wear as number) || 0;
  const tireLR_wear = (d.tireLR_wear as number) || 0;
  const tireRR_wear = (d.tireRR_wear as number) || 0;
  const tireCompound = (d.tireCompound as string) || '---';
  // Engine
  const oilTemp = (d.oilTemp as number) || 0;
  const oilPress = (d.oilPress as number) || 0;
  const waterTemp = (d.waterTemp as number) || 0;
  const voltage = (d.voltage as number) || 0;
  // Weather
  const trackTemp = (d.trackTemp as number) || 0;
  const airTemp = (d.airTemp as number) || 0;
  const windSpeed = (d.windSpeed as number) || 0;
  const humidity = (d.humidity as number) || 0;
  const skies = (d.skies as string) || '';
  // Session
  const driverName = (d.driverName as string) || '---';
  const carName = (d.carName as string) || '---';
  const trackName = (d.trackName as string) || '---';
  const trackConfig = (d.trackConfig as string) || '';
  const iRating = (d.driverIRating as number) || 0;
  const sessionName = (d.sessionName as string) || '';

  const fuelPerLap = lap > 1 ? (100 - fuelPercent) / (lap - 1) : 0;
  const fuelLaps = fuelPerLap > 0 ? Math.floor(fuelPercent / fuelPerLap) : 99;

  const recommendations = useMemo(() => generateRecommendations(d, t, events), [
    fuelPercent, lap, handling, trackTemp, incidentCount, tireLF_wear, tireRF_wear, tireLR_wear, tireRR_wear, delta, oilTemp, waterTemp, events.length, t,
  ]);

  // Sound alerts + persist AI messages to event log
  const lastRecIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentIds = recommendations.map((r) => r.id);
    const newRecs = recommendations.filter((r) => !lastRecIdsRef.current.includes(r.id));
    if (newRecs.length > 0 && lastRecIdsRef.current.length > 0) {
      // New recommendation appeared — play sound and log it
      const highestPriority = newRecs.reduce((min, r) => Math.min(min, r.priority), 5);
      const soundType = highestPriority <= 1 ? 'warning' : highestPriority <= 2 ? 'strategy' : 'tip';
      playAlertSound(soundType);
      // Log to persistent history
      newRecs.forEach((rec) => {
        addEvent({
          lap, trackPct: (d.lapDistPct as number) || 0,
          type: 'ai_recommendation',
          message: `🤖 ${rec.message}`,
          data: { recType: rec.type, priority: rec.priority },
        });
      });
    }
    lastRecIdsRef.current = currentIds;
  }, [recommendations, lap, d, addEvent]);

  const typeColors: Record<string, string> = { warning: 'var(--rc-red)', tip: 'var(--rc-cyan)', strategy: 'var(--rc-yellow)' };
  const typeBg: Record<string, string> = { warning: '#1a0008', tip: '#001a22', strategy: '#1a1a00' };

  return (
    <div className={`racing-app h-screen flex flex-col overflow-hidden ${theme === 'light' ? 'racing-light' : ''}`}>
      {/* Top bar: Session info + controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--rc-border)' }}>
        <div className="flex items-center gap-5 text-sm">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--rc-cyan)' }}>
            <IconDriver size={15} color="var(--rc-cyan)" /> {driverName}
          </span>
          {iRating > 0 && <span className="px-2 py-1 rounded text-xs font-bold" style={{ background: '#001a33', color: 'var(--rc-cyan)' }}>{iRating} iR</span>}
          <span className="flex items-center gap-1.5" style={{ color: 'var(--rc-orange)' }}>
            <IconCar size={15} color="var(--rc-orange)" /> {carName}
          </span>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--rc-green)' }}>
            <IconTrack size={15} color="var(--rc-green)" /> {trackName}{trackConfig ? ` (${trackConfig})` : ''}
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--rc-text-dim)' }}>
            <IconClock size={13} color="var(--rc-text-dim)" /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {sessionName && <span className="px-2 py-1 rounded text-xs font-bold" style={{ background: '#1a1a00', color: 'var(--rc-yellow)' }}>{sessionName.toUpperCase()}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-mono" style={{ color: 'var(--rc-text-dim)' }}>
            <IconSpeed size={13} color="var(--rc-text-dim)" /> {maxSpeedSession.toFixed(0)} {t.kmh}
          </span>
          <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="text-xs px-2 py-1 rounded font-bold" style={{ background: 'var(--rc-surface)', color: 'var(--rc-text-dim)' }}>{lang.toUpperCase()}</button>
          <button onClick={toggleTheme} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--rc-surface)', color: 'var(--rc-text-dim)' }}>{theme === 'dark' ? '☀' : '☽'}</button>
          <button onClick={() => setShowEvents(!showEvents)} className="text-xs px-2 py-1 rounded" style={{ background: showEvents ? '#001a22' : 'var(--rc-surface)', color: showEvents ? 'var(--rc-cyan)' : 'var(--rc-text-dim)' }}>
            <IconLog size={13} color={showEvents ? 'var(--rc-cyan)' : 'var(--rc-text-dim)'} />
          </button>
          <button onClick={handleDisconnect} className="text-xs px-2 py-1 rounded" style={{ background: '#1a0008', color: 'var(--rc-red)' }}>✕</button>
          <Link to="/analysis" className="text-xs px-2 py-1 rounded font-medium no-underline" style={{ background: 'var(--rc-surface)', color: 'var(--rc-cyan)' }}>{t.analysis}</Link>
        </div>
      </div>

      {/* Delta bar + status */}
      <div className="flex items-center gap-3 px-3 py-1.5">
        <div className="flex-1 h-7 rounded-lg flex items-center px-3 relative" style={{ background: '#0a0a0a', border: '1px solid #222' }}>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#333]" />
          <motion.div animate={{ left: `${Math.max(5, Math.min(95, 50 + delta * 20))}%` }} transition={{ duration: 0.06 }}
            className="absolute top-1 bottom-1 w-3 rounded-sm"
            style={{ background: delta > 0 ? 'var(--rc-red)' : 'var(--rc-green)', boxShadow: `0 0 8px ${delta > 0 ? 'var(--rc-red)' : 'var(--rc-green)'}` }} />
          <span className="relative z-10 text-xs font-bold" style={{ color: delta > 0 ? 'var(--rc-red)' : 'var(--rc-green)' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(3)}
          </span>
          <span className="ml-auto relative z-10 text-xs" style={{ color: 'var(--rc-text-dim)' }}>{t.delta}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold px-2 py-1 rounded" style={{ background: '#001a0d', color: 'var(--rc-green)' }}>P{position}</span>
          <span className="text-sm px-2 py-1 rounded" style={{ background: '#111', color: 'var(--rc-text-dim)' }}>L{lap}</span>
          {onPitRoad && <span className="text-xs font-bold px-2 py-1 rounded blink" style={{ background: '#332200', color: 'var(--rc-yellow)' }}>{t.pit}</span>}
          {!connected && <span className="text-xs font-bold px-2 py-1 rounded pulse" style={{ background: '#1a0008', color: 'var(--rc-red)' }}>{t.reconnecting}</span>}
          {absOn && <span className="text-xs font-bold px-2 py-1 rounded blink" style={{ background: '#1a0008', color: 'var(--rc-red)' }}>{t.abs}</span>}
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-2 px-2 pb-2 min-h-0 overflow-hidden">
        {/* COL 1: Speed + Gear + RPM + Engine */}
        <div className="col-span-2 flex flex-col gap-2 overflow-hidden">
          <div className="rc-card flex-1 flex flex-col items-center justify-center">
            <div className="rc-label">{t.speed}</div>
            <div className="rc-value text-6xl glow-cyan" style={{ color: 'var(--rc-cyan)' }}>{speed.toFixed(0)}</div>
            <div className="rc-label">{t.kmh}</div>
          </div>
          <div className="rc-card">
            <RPMBar rpm={rpm} />
            <div className="flex justify-between mt-1.5 items-center">
              <span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>{rpm}</span>
              <span className="rc-value text-3xl glow-purple" style={{ color: 'var(--rc-purple)' }}>{gear === 0 ? 'N' : gear === -1 ? 'R' : gear}</span>
              <span className="text-xs" style={{ color: shiftIndicator > 80 ? 'var(--rc-red)' : 'var(--rc-text-dim)' }}>
                {shiftIndicator > 80 ? `⬆ ${t.shift}` : `${shiftIndicator}%`}
              </span>
            </div>
          </div>
          {/* Engine temps */}
          <div className="rc-card">
            <div className="rc-label mb-1.5"><IconEngine size={14} color="var(--rc-text-dim)" /> {t.engine}</div>
            <div className="space-y-1.5">
              <TempGauge value={oilTemp} max={150} label={t.oilTemp} icon="🛢️" />
              <TempGauge value={waterTemp} max={120} label={t.waterTemp} icon="💧" />
              <TempGauge value={oilPress} max={8} label={t.oilPress} icon="⏲️" unit=" bar" />
              <TempGauge value={voltage} max={15} label={t.voltage} icon="⚡" unit="V" />
            </div>
          </div>
        </div>

        {/* COL 2: Pedals + Timing + Handling */}
        <div className="col-span-4 flex flex-col gap-2 overflow-hidden">
          <div className="rc-card">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t.throttle, value: throttle, cls: 'rc-bar-throttle', color: 'var(--rc-green)', icon: '🟢' },
                { label: t.brake, value: brake, cls: 'rc-bar-brake', color: 'var(--rc-red)', icon: '🔴' },
                { label: t.clutch, value: clutch, cls: 'rc-bar-clutch', color: 'var(--rc-purple)', icon: '🟣' },
              ].map(p => (
                <div key={p.label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>{p.icon} {p.label}</span>
                    <span className="text-sm font-bold" style={{ color: p.color }}>{p.value}%</span>
                  </div>
                  <div className="h-4 rounded-md overflow-hidden" style={{ background: '#0a0a0a' }}>
                    <motion.div animate={{ width: `${p.value}%` }} transition={{ duration: 0.05 }}
                      className={`h-full rounded-md ${p.cls}`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>🎯 {t.steering}</span>
              <div className="flex-1 h-2.5 rounded-full relative" style={{ background: '#0a0a0a' }}>
                <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: '#333' }} />
                <motion.div animate={{ left: `${50 + steering / 3.6}%` }} transition={{ duration: 0.04 }}
                  className="absolute top-0 w-2 h-full rounded-full" style={{ background: 'var(--rc-purple)', marginLeft: '-4px', boxShadow: '0 0 6px var(--rc-purple)' }} />
              </div>
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--rc-purple)' }}>{steering.toFixed(0)}°</span>
            </div>
          </div>

          {/* Timing */}
          <div className="rc-card">
            <div className="rc-label mb-1.5"><IconClock size={14} color="var(--rc-text-dim)" /> {t.timing}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div><span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>{t.current}</span><div className="text-sm font-mono">{fmt(currentLapTime)}</div></div>
              <div><span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>{t.best}</span><div className="text-sm font-mono glow-purple" style={{ color: 'var(--rc-purple)' }}>{fmt(bestLapTime)}</div></div>
              <div><span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>{t.last}</span><div className="text-sm font-mono">{fmt(lastLapTime)}</div></div>
              <div><span className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>{t.delta}</span><div className="text-sm font-mono font-bold" style={{ color: delta > 0 ? 'var(--rc-red)' : 'var(--rc-green)' }}>{delta > 0 ? '+' : ''}{delta.toFixed(3)}</div></div>
            </div>
          </div>

          {/* Handling */}
          <div className="rc-card">
            <div className="flex items-center justify-between">
              <div>
                <span className="rc-label"><IconGForce size={13} color="var(--rc-text-dim)" /> {t.handling}</span>
                <div className="text-lg font-bold mt-0.5" style={{ color: handling === 'oversteer' ? 'var(--rc-yellow)' : handling === 'understeer' ? 'var(--rc-red)' : 'var(--rc-green)' }}>
                  {handling === 'oversteer' ? t.oversteer : handling === 'understeer' ? t.understeer : t.neutral}
                </div>
              </div>
              <div className="text-center">
                <span className="rc-label">{t.abs}</span>
                <div className={`text-lg font-bold mt-0.5 ${absOn ? 'blink' : ''}`} style={{ color: absOn ? 'var(--rc-red)' : '#333' }}>
                  {absOn ? `● ${t.active}` : `○ ${t.off}`}
                </div>
              </div>
              <div className="text-center">
                <span className="rc-label">⚠️ {t.incidents}</span>
                <div className="text-lg font-bold mt-0.5" style={{ color: incidentCount > 0 ? 'var(--rc-yellow)' : '#333' }}>{incidentCount}x</div>
              </div>
            </div>
          </div>

          {/* Track Map + Sectors + Input Trace */}
          <div className="rc-card">
            <TrackMapLinear
              lapDistPct={(d.lapDistPct as number) || 0}
              isOffTrack={(d.isOffTrack as boolean) || false}
              labels={{ s1: t.s1, s2: t.s2, s3: t.s3, trackMap: t.trackMap }}
            />
            <div className="mt-3">
              <SectorTimes
                currentSectors={currentSectors}
                previousSectors={previousSectors}
                labels={{ sectors: t.sectors, s1: t.s1, s2: t.s2, s3: t.s3, better: t.better, worse: t.worse }}
              />
            </div>
            <div className="mt-3">
              <InputTrace
                samples={inputSamples}
                durationMs={10000}
                labels={{ inputTrace: t.inputTrace, throttle: t.throttle, brake: t.brake }}
              />
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="rc-card flex-1 overflow-hidden flex flex-col">
            <div className="rc-label mb-1.5"><IconAI size={14} color="var(--rc-cyan)" /> {t.aiEngineer}</div>
            {recommendations.length === 0 ? (
              <div className="flex-1 flex items-center justify-center"><span className="text-xs" style={{ color: '#444' }}>{t.analyzing}</span></div>
            ) : (
              <div className="flex-1 space-y-1 overflow-y-auto">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="px-2 py-1 rounded text-xs leading-tight"
                    style={{ background: typeBg[rec.type], borderLeft: `2px solid ${typeColors[rec.type]}` }}>
                    {rec.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COL 3: G-Force + Tires + Fuel + Weather */}
        <div className="col-span-3 flex flex-col gap-2 overflow-hidden">
          {/* G-Force */}
          <div className="rc-card">
            <div className="rc-section-title mb-2"><IconGForce size={14} color="var(--rc-cyan)" /> {t.gforce}</div>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex-shrink-0 gforce-container p-1" style={{ background: 'var(--rc-gforce-bg)', borderRadius: '50%' }}>
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Background fill */}
                  <circle cx="50" cy="50" r="48" fill="var(--rc-gforce-bg)" />
                  {/* Rings */}
                  <circle cx="50" cy="50" r="42" fill="none" className="gforce-ring" strokeWidth="1.2" />
                  <circle cx="50" cy="50" r="28" fill="none" className="gforce-ring" strokeWidth="0.8" />
                  <circle cx="50" cy="50" r="14" fill="none" className="gforce-ring" strokeWidth="0.6" />
                  {/* Crosshair */}
                  <line x1="8" y1="50" x2="92" y2="50" className="gforce-cross" strokeWidth="0.6" />
                  <line x1="50" y1="8" x2="50" y2="92" className="gforce-cross" strokeWidth="0.6" />
                  {/* Trail dots */}
                  {gHistRef.current.map((p, i) => (
                    <circle key={i} cx={50 + Math.max(-40, Math.min(40, p.x * 12))} cy={50 + Math.max(-40, Math.min(40, p.y * 12))}
                      r="2" className="gforce-trail" opacity={0.15 + (i / gHistRef.current.length) * 0.45} />
                  ))}
                  {/* Current position */}
                  <circle cx={50 + Math.max(-40, Math.min(40, gLateral * 12))} cy={50 + Math.max(-40, Math.min(40, gLongitudinal * 12))}
                    r="5" className="gforce-dot" />
                </svg>
              </div>
              <div className="text-sm font-mono space-y-1">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--rc-text-dim)' }}>{t.lat}</span>
                  <span className="font-bold text-base" style={{ color: 'var(--rc-cyan)' }}>{Math.abs(gLateral).toFixed(2)}g</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--rc-text-dim)' }}>{t.lon}</span>
                  <span className="font-bold text-base" style={{ color: 'var(--rc-cyan)' }}>{Math.abs(gLongitudinal).toFixed(2)}g</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tires */}
          <div className="rc-card">
            <div className="flex items-center justify-between mb-1.5">
              <span className="rc-label"><IconTire size={14} color="var(--rc-text-dim)" /> {t.tires}</span>
              <span className="text-xs px-2 py-1 rounded" style={{ background: '#111', color: 'var(--rc-text-dim)' }}>{tireCompound}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { pos: t.fl, temp: tireLF_temp, wear: tireLF_wear },
                { pos: t.fr, temp: tireRF_temp, wear: tireRF_wear },
                { pos: t.rl, temp: tireLR_temp, wear: tireLR_wear },
                { pos: t.rr, temp: tireRR_temp, wear: tireRR_wear },
              ].map(tire => {
                const temp = tire.temp || 0;
                const tColor = temp > 110 ? 'var(--rc-red)' : temp > 90 ? 'var(--rc-yellow)' : temp > 50 ? 'var(--rc-green)' : '#444';
                const wearPct = tire.wear || 0;
                const wColor = wearPct > 70 ? 'var(--rc-red)' : wearPct > 50 ? 'var(--rc-yellow)' : 'var(--rc-green)';
                return (
                  <div key={tire.pos} className="rounded px-2 py-1" style={{ background: '#0a0a0a' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold" style={{ color: '#555' }}>{tire.pos}</span>
                      <span className="text-xs font-bold font-mono" style={{ color: tColor }}>{temp > 0 ? `${temp}°` : '--'}</span>
                    </div>
                    {wearPct > 0 && (
                      <div className="mt-0.5">
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, wearPct)}%`, background: wColor }} />
                        </div>
                        <span className="text-[10px]" style={{ color: '#555' }}>{wearPct.toFixed(0)}% {t.wear}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fuel */}
          <div className="rc-card">
            <div className="rc-label mb-1.5"><IconFuel size={14} color="var(--rc-text-dim)" /> {t.fuel}</div>
            <FuelGauge value={fuelPercent} label={t.level} icon="📊" />
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <div className="flex justify-between"><span style={{ color: '#666' }}>{t.liters}</span><span className="font-mono">{fuelLevelLiters.toFixed(1)}L</span></div>
              <div className="flex justify-between"><span style={{ color: '#666' }}>{t.perLap}</span><span className="font-mono">{fuelPerLap.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span style={{ color: '#666' }}>{t.lapsLeft}</span><span className="font-mono font-bold" style={{ color: fuelLaps < 3 ? 'var(--rc-red)' : 'var(--rc-green)' }}>{fuelLaps}</span></div>
              <div className="flex justify-between"><span style={{ color: '#666' }}>{t.consumption}</span><span className="font-mono">{fuelUsePerHour.toFixed(1)} L/h</span></div>
            </div>
          </div>

          {/* Weather */}
          <div className="rc-card">
            <div className="rc-label mb-1.5"><IconWeather size={14} color="var(--rc-text-dim)" /> {t.weather}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <div className="flex justify-between"><span style={{ color: '#666' }}>🌡️ {t.air}</span><span className="font-mono">{airTemp > 0 ? `${airTemp}°C` : '--'}</span></div>
              <div className="flex justify-between"><span style={{ color: '#666' }}>🛣️ {t.trackTemp}</span><span className="font-mono" style={{ color: trackTemp > 40 ? 'var(--rc-red)' : 'var(--rc-green)' }}>{trackTemp > 0 ? `${trackTemp}°C` : '--'}</span></div>
              <div className="flex justify-between"><span style={{ color: '#666' }}>💨 {t.wind}</span><span className="font-mono">{windSpeed > 0 ? `${windSpeed.toFixed(0)} km/h` : '--'}</span></div>
              <div className="flex justify-between"><span style={{ color: '#666' }}>💧 {t.humidity}</span><span className="font-mono">{humidity > 0 ? `${humidity}%` : '--'}</span></div>
              {skies && <div className="flex justify-between col-span-2"><span style={{ color: '#666' }}>☁️ {t.skies}</span><span className="font-mono capitalize">{skies}</span></div>}
            </div>
          </div>
        </div>

        {/* COL 4: Track Info + Event Log */}
        <div className="col-span-3 flex flex-col gap-2 overflow-hidden">
          {/* Track Info Panel */}
          {(() => {
            const trackInfo = findTrackInfo(trackName);
            if (!trackInfo) return null;
            const tip = lang === 'es' ? trackInfo.tipEs : trackInfo.tipEn;
            const particularity = lang === 'es' ? trackInfo.particularityEs : trackInfo.particularityEn;
            return (
              <div className="rc-card flex-shrink-0">
                <div className="rc-section-title mb-2"><IconInfo size={14} color="var(--rc-purple)" /> {lang === 'es' ? 'Info del Circuito' : 'Track Info'}</div>
                <div className="space-y-1.5">
                  <div className="text-xs" style={{ color: 'var(--rc-text-dim)' }}>
                    <span className="font-bold" style={{ color: 'var(--rc-text)' }}>{trackInfo.name}</span>
                    {' · '}{trackInfo.country} · {trackInfo.turns} {lang === 'es' ? 'curvas' : 'turns'} · {trackInfo.length}
                  </div>
                  {trackInfo.lapRecord && (
                    <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                      Record: <span className="font-mono font-bold" style={{ color: 'var(--rc-purple)' }}>{trackInfo.lapRecord}</span>
                    </div>
                  )}
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--rc-text-dim)', borderLeft: '2px solid var(--rc-purple)', paddingLeft: '8px' }}>
                    {tip}
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--rc-text-muted)', borderLeft: '2px solid var(--rc-border)', paddingLeft: '8px' }}>
                    {particularity}
                  </div>
                </div>
              </div>
            );
          })()}

          {showEvents ? (
            <div className="rc-card flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <span className="rc-section-title"><IconLog size={14} color="var(--rc-text-dim)" /> {t.events}</span>
                <button onClick={clearSession} className="text-xs px-2 py-1 rounded" style={{ background: '#1a0008', color: 'var(--rc-red)' }}>{t.clearLog}</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {events.slice().reverse().slice(0, 50).map((evt) => {
                  const evtColor = evt.type === 'off_track' ? 'var(--rc-red)' : evt.type === 'best_lap' ? 'var(--rc-green)' : evt.type === 'max_speed' ? 'var(--rc-cyan)' : 'var(--rc-yellow)';
                  return (
                    <div key={evt.id} className="text-xs px-2 py-1 rounded flex items-center gap-2" style={{ background: '#0a0a0a' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: evtColor }} />
                      <span style={{ color: 'var(--rc-text-dim)' }}>{evt.message}</span>
                    </div>
                  );
                })}
                {events.length === 0 && <span className="text-xs" style={{ color: '#444' }}>{t.noEvents}</span>}
              </div>
            </div>
          ) : (
            <>
              {/* Lap history summary */}
              <div className="rc-card">
                <div className="rc-label mb-1.5">📊 {t.events}</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span style={{ color: '#666' }}>⚡ {t.maxSpeed}</span><span className="font-mono font-bold" style={{ color: 'var(--rc-cyan)' }}>{maxSpeedSession.toFixed(0)} {t.kmh}</span></div>
                  <div className="flex justify-between"><span style={{ color: '#666' }}>🛞 {t.offTrack}</span><span className="font-mono">{events.filter(e => e.type === 'off_track').length}x</span></div>
                  <div className="flex justify-between"><span style={{ color: '#666' }}>⚠️ {t.incidents}</span><span className="font-mono">{incidentCount}x</span></div>
                  <div className="flex justify-between"><span style={{ color: '#666' }}>🏆 {t.bestLapEvent}</span><span className="font-mono glow-purple" style={{ color: 'var(--rc-purple)' }}>{fmt(bestLapTime)}</span></div>
                </div>
              </div>
              {/* Recent events (compact) */}
              <div className="rc-card flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="rc-label"><IconLog size={13} color="var(--rc-text-dim)" /> {t.recent}</span>
                  <button onClick={() => setShowEvents(true)} className="text-xs px-2 py-1 rounded" style={{ background: '#111', color: 'var(--rc-text-dim)' }}>+</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-0.5">
                  {events.slice(-8).reverse().map((evt) => {
                    const evtColor = evt.type === 'off_track' ? 'var(--rc-red)' : evt.type === 'best_lap' ? 'var(--rc-green)' : 'var(--rc-yellow)';
                    return (
                      <div key={evt.id} className="text-xs px-1 py-1 rounded flex items-center gap-1" style={{ background: '#0a0a0a' }}>
                        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: evtColor }} />
                        <span style={{ color: 'var(--rc-text-dim)' }}>{evt.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
