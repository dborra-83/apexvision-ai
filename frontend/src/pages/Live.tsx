/**
 * ApexVision AI — Racing Dashboard DDU Style (v3)
 * Features: i18n (es/en), dark/light themes, session logging,
 * engine temps, detailed tires, fuel consumption, AI recommendations,
 * event history with track position.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { fmtLapTime } from '../utils/format';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useIRacingLive } from '../hooks/useIRacingLive';
import { createDemoTelemetryStream } from '../data/demo-session';
import { useLangStore } from '../store/lang-store';
import { useThemeStore } from '../store/theme-store';
import { useSessionLogStore, SessionEvent } from '../store/session-log-store';
import { liveTranslations, LiveT } from './live-i18n';
import { playAlertSound, unlockAudio } from '../utils/sound-alerts';
import { speakRecommendation } from '../utils/tts';
import { findTrackInfo } from '../data/track-info';
import { TrackMapLinear, SectorTimes, InputTrace, InputSample, SectorTime } from '../components/LiveTelemetryPanels';
import { TireVisual } from '../components/TireVisual';
import { IconDriver, IconCar, IconTrack, IconFuel, IconEngine, IconTire, IconGForce, IconAI, IconClock, IconLog, IconInfo } from '../components/RacingIcons';
import '../racing.css';

// --- Helpers ---
const fmt = fmtLapTime;

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

interface StintHistory {
  lapTimes: number[];
  tireWear: { lap: number; lf: number; rf: number; lr: number; rr: number }[];
  fuelPerLap: number[];
  fuelLevels: number[];
}

function generateRecommendations(
  d: Record<string, unknown>,
  t: LiveT,
  sessionEvents: SessionEvent[],
  history: StintHistory,
  lang: string,
): AIRecommendation[] {
  const recs: AIRecommendation[] = [];
  const es = lang === 'es';
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
  const rpm = (d.rpm as number) || 0;
  const gear = (d.gear as number) || 0;
  const throttle = (d.throttle as number) || 0;
  const brake = (d.brake as number) || 0;
  const speed = (d.speed as number) || 0;
  const flags = (d.flags as string[]) || [];

  const slShiftRPM = (d.slShiftRPM as number) || 0;
  const slBlinkRPM = (d.slBlinkRPM as number) || 0;
  const drsStatus = (d.drsStatus as number) || 0;
  const pitRepairLeft = (d.pitRepairLeft as number) || 0;
  const brakeBias = (d.brakeBias as number) || 0;
  const tireLF_temp = (d.tireLF_temp as number) || 0;
  const tireRF_temp = (d.tireRF_temp as number) || 0;
  const tireLR_temp = (d.tireLR_temp as number) || 0;
  const tireRR_temp = (d.tireRR_temp as number) || 0;

  const recentOffs = sessionEvents.filter((e) => e.type === 'off_track').slice(-10);
  const trackPctClusters = new Map<number, number>();
  recentOffs.forEach((e) => {
    const zone = Math.round(e.trackPct / 5) * 5;
    trackPctClusters.set(zone, (trackPctClusters.get(zone) || 0) + 1);
  });

  // ── BANDERAS / FLAGS ──
  if (flags.includes('yellow')) {
    recs.push({ id: 'flag-y', type: 'warning', priority: 1, message: es
      ? '🟡 Bandera amarilla — levantar el pie, sin adelantamientos, atención a autos lentos'
      : '🟡 Yellow flag — lift, no overtaking, watch for slow cars' });
  }
  if (flags.includes('blue')) {
    recs.push({ id: 'flag-b', type: 'warning', priority: 1, message: es
      ? '🔵 Bandera azul — ceder el paso inmediatamente'
      : '🔵 Blue flag — let the faster car past immediately' });
  }
  if (flags.includes('checkered')) {
    recs.push({ id: 'flag-c', type: 'strategy', priority: 1, message: es
      ? '🏁 Bandera a cuadros — vuelta de enfriamiento, proteger el auto hasta los pits'
      : '🏁 Checkered — cool-down lap, protect the car to pits' });
  }

  // ── DAÑO / DAMAGE ──
  if (pitRepairLeft > 0) {
    recs.push({ id: 'damage', type: 'warning', priority: 2, message: es
      ? `🔧 ${pitRepairLeft.toFixed(0)}s de reparación pendientes — evaluar ventana de pit`
      : `🔧 ${pitRepairLeft.toFixed(0)}s damage repair pending — evaluate pit window` });
  }

  // ── COMBUSTIBLE / FUEL ──
  if (fuelLaps <= 2 && fuelLaps > 0) {
    recs.push({ id: 'fuel-crit', type: 'warning', priority: 1, message: es
      ? `⛽ ${t.fuel}: ${fuelLaps} ${t.lapsLeft} — ENTRAR A PITS AHORA`
      : `⛽ ${t.fuel}: ${fuelLaps} ${t.lapsLeft} — PIT NOW!` });
  } else if (fuelLaps <= 5) {
    recs.push({ id: 'fuel-low', type: 'strategy', priority: 2, message: `⛽ ${t.fuel}: ~${fuelLaps} ${t.lapsLeft}` });
  }

  // ── NEUMÁTICOS — desgaste / TIRES — wear ──
  if (maxWear > 80) {
    recs.push({ id: 'tire-crit', type: 'warning', priority: 1, message: es
      ? `🛞 Desgaste ${maxWear.toFixed(0)}% — pérdida de grip inminente, entrar a pits`
      : `🛞 Wear ${maxWear.toFixed(0)}% — grip loss imminent, pit now` });
  } else if (maxWear > 55) {
    recs.push({ id: 'tire-high', type: 'strategy', priority: 3, message: es
      ? `🛞 Desgaste ${maxWear.toFixed(0)}% — ventana de pit se acerca`
      : `🛞 Wear ${maxWear.toFixed(0)}% — pit window approaching` });
  }

  // ── TEMPERATURA DE NEUMÁTICOS / TIRE TEMP ──
  const tireTemps = [tireLF_temp, tireRF_temp, tireLR_temp, tireRR_temp].filter((x) => x > 0);
  const avgTireTemp = tireTemps.length ? tireTemps.reduce((a, b) => a + b, 0) / tireTemps.length : 0;
  if (avgTireTemp > 0 && avgTireTemp < 65 && speed > 60) {
    recs.push({ id: 'tire-cold', type: 'tip', priority: 4, message: es
      ? `🥶 Neumáticos fríos (${avgTireTemp.toFixed(0)}°C) — forzar más para generar temperatura`
      : `🥶 Cold tires (${avgTireTemp.toFixed(0)}°C) — push harder to build heat` });
  }
  if (tireLF_temp > 110 || tireRF_temp > 110) {
    const hotTire = tireLF_temp > tireRF_temp ? (es ? 'DI' : 'LF') : (es ? 'DD' : 'RF');
    const hotTemp = Math.max(tireLF_temp, tireRF_temp);
    recs.push({ id: 'tire-hot', type: 'warning', priority: 3, message: es
      ? `🌡 Neumático ${hotTire} recalentado: ${hotTemp.toFixed(0)}°C — reducir agresividad en curvas lentas`
      : `🌡 ${hotTire} overheating: ${hotTemp.toFixed(0)}°C — reduce aggression in slow corners` });
  }

  // ── DIFERENCIAL TÉRMICO / TEMP SPREAD ──
  const lfSpread = Math.abs(((d.tireLF_inner as number) || 0) - ((d.tireLF_outer as number) || 0));
  const rfSpread = Math.abs(((d.tireRF_inner as number) || 0) - ((d.tireRF_outer as number) || 0));
  const maxSpread = Math.max(lfSpread, rfSpread);
  if (maxSpread > 25) {
    const tire = lfSpread > rfSpread ? (es ? 'DI' : 'LF') : (es ? 'DD' : 'RF');
    recs.push({ id: 'tire-spread', type: 'tip', priority: 4, message: es
      ? `🔧 Diferencia térmica ${tire}: ${maxSpread.toFixed(0)}°C — verificar presión o camber`
      : `🔧 ${tire} temp spread ${maxSpread.toFixed(0)}°C — check tire pressure or camber` });
  }

  // ── RITMO DE DESGASTE / DEGRADATION RATE ──
  if (history.tireWear.length >= 2) {
    const prev = history.tireWear[history.tireWear.length - 2];
    const last = history.tireWear[history.tireWear.length - 1];
    const frontDegRate = ((last.lf - prev.lf) + (last.rf - prev.rf)) / 2;
    if (frontDegRate > 5) {
      recs.push({ id: 'tire-deg', type: 'strategy', priority: 3, message: es
        ? `📉 Delanteros: ${frontDegRate.toFixed(1)}%/vuelta — suavizar zonas de frenada`
        : `📉 Front tires: ${frontDegRate.toFixed(1)}%/lap degradation — ease braking zones` });
    }
  }

  // ── TENDENCIA DE VUELTAS / LAP TREND ──
  if (history.lapTimes.length >= 3) {
    const recent = history.lapTimes.slice(-3);
    const trend = recent[recent.length - 1] - recent[0];
    if (trend > 1.0) {
      recs.push({ id: 'degrading', type: 'strategy', priority: 3, message: es
        ? `📈 Ritmo cayendo +${trend.toFixed(2)}s en 3 vueltas — problema de neumáticos o setup`
        : `📈 Pace degrading +${trend.toFixed(2)}s/3 laps — tires or setup issue` });
    }
  }

  // ── MANEJO / HANDLING ──
  if (handling === 'oversteer') {
    const biasTip = brakeBias > 55
      ? (es ? ` Reducir bias al frente −1% (actual ${brakeBias.toFixed(0)}%)` : ` Try front bias −1% (now ${brakeBias.toFixed(0)}%)`)
      : '';
    recs.push({ id: 'os', type: 'tip', priority: 3, message: es
      ? `🔄 ${t.oversteer}: suavizar salida del gas, reducir velocidad de apoyo.${biasTip}`
      : `🔄 ${t.oversteer}: smooth throttle exit, reduce mid-corner speed.${biasTip}` });
  } else if (handling === 'understeer') {
    recs.push({ id: 'us', type: 'tip', priority: 3, message: es
      ? `🔄 ${t.understeer}: frenar más tarde, entrar antes a la curva`
      : `🔄 ${t.understeer}: trail-brake deeper, earlier turn-in` });
  }

  // ── MOTOR / ENGINE ──
  if (oilTemp > 130) {
    recs.push({ id: 'oil-hot', type: 'warning', priority: 2, message: es
      ? `🌡️ ${t.oilTemp}: ${oilTemp}°C — riesgo de daño, levantar en rectas`
      : `🌡️ ${t.oilTemp}: ${oilTemp}°C — risk of damage, lift on straights` });
  }
  if (waterTemp > 110) {
    recs.push({ id: 'water-hot', type: 'warning', priority: 2, message: es
      ? `💧 ${t.waterTemp}: ${waterTemp}°C — ¡sobrecalentamiento!`
      : `💧 ${t.waterTemp}: ${waterTemp}°C — overheating!` });
  }

  // ── CAMBIOS / SHIFT EFFICIENCY ──
  if (slBlinkRPM > 0 && rpm > slBlinkRPM && gear > 0 && gear < 8 && throttle > 80) {
    recs.push({ id: 'shift-late', type: 'tip', priority: 2, message: es
      ? `⬆️ En zona de corte (${rpm} RPM) — cambiar de marcha ya`
      : `⬆️ Over rev-limiter zone (${rpm} RPM) — upshift immediately` });
  } else if (slShiftRPM > 0 && rpm > slShiftRPM * 1.03 && gear > 0 && gear < 8 && throttle > 80) {
    recs.push({ id: 'shift-opt', type: 'tip', priority: 4, message: es
      ? `⬆️ Cambio tardío: ${rpm} RPM — cambio óptimo en ${slShiftRPM}`
      : `⬆️ Shifting late: ${rpm} RPM — optimal shift at ${slShiftRPM}` });
  }

  // ── DRS ──
  if (drsStatus === 1) {
    recs.push({ id: 'drs', type: 'tip', priority: 3, message: es
      ? '🏎️ DRS disponible — activar en la próxima recta (+15–25 km/h)'
      : '🏎️ DRS available — deploy on next straight (+15–25 km/h)' });
  }

  // ── CONDICIONES DE PISTA / TRACK CONDITIONS ──
  if (trackTemp > 45) {
    recs.push({ id: 'track-hot', type: 'tip', priority: 5, message: es
      ? `🌡️ ${t.trackTemp}: ${trackTemp}°C — desgaste elevado, cuidar neumáticos`
      : `🌡️ ${t.trackTemp}: ${trackTemp}°C — high degradation, conserve tires` });
  }
  if (windSpeed > 20) {
    recs.push({ id: 'wind', type: 'tip', priority: 5, message: es
      ? `💨 ${t.wind}: ${windSpeed.toFixed(0)} km/h — ajustar frenadas por viento de frente/espalda`
      : `💨 ${t.wind}: ${windSpeed.toFixed(0)} km/h — adjust braking for headwind/tailwind` });
  }

  // ── SALIDAS REPETIDAS / REPEATED OFF-TRACKS ──
  trackPctClusters.forEach((count, zone) => {
    if (count >= 2) {
      recs.push({ id: `corner-${zone}`, type: 'strategy', priority: 2, message: es
        ? `⚠️ ${count}x ${t.offTrack} @ ${zone}% — frenar 5m antes en esa zona`
        : `⚠️ ${count}x ${t.offTrack} @ ${zone}% — brake 5m earlier in that zone` });
    }
  });

  // ── RITMO / PACE ──
  if (delta > 2.0 && lap > 3) {
    recs.push({ id: 'pace', type: 'strategy', priority: 3, message: es
      ? `📊 +${delta.toFixed(1)}s vs mejor — foco en salida de curvas y frenada tardía`
      : `📊 +${delta.toFixed(1)}s vs best — focus on exit speed and trail braking` });
  }

  // ── INCIDENTES / INCIDENTS ──
  if (incidentCount >= 8) {
    recs.push({ id: 'inc-dq', type: 'warning', priority: 2, message: es
      ? `⚠️ ${incidentCount}x ${t.incidents} — cerca del límite de descalificación, conducir defensivo`
      : `⚠️ ${incidentCount}x ${t.incidents} — near DQ limit, drive defensively` });
  } else if (incidentCount >= 4) {
    recs.push({ id: 'inc-warn', type: 'strategy', priority: 4, message: es
      ? `⚠️ ${incidentCount}x ${t.incidents} — evitar bordillos y maniobras agresivas`
      : `⚠️ ${incidentCount}x incidents — avoid curbs and aggressive moves` });
  }

  // ── FIN DE CARRERA / END OF RACE ──
  if (lapsRemaining <= 3 && lapsRemaining > 0) {
    recs.push({ id: 'end', type: 'strategy', priority: 2, message: es
      ? `🏁 ${lapsRemaining} ${t.lapsLeft} — exigir al máximo, gestionar incidentes`
      : `🏁 ${lapsRemaining} ${t.lapsLeft} — push to the limit, manage incident risk` });
  }

  // ── DESGASTE TRASERO > DELANTERO / REAR-HEAVY WEAR ──
  const lf_w = (d.tireLF_wear as number) || 0;
  const rf_w = (d.tireRF_wear as number) || 0;
  const lr_w = (d.tireLR_wear as number) || 0;
  const rr_w = (d.tireRR_wear as number) || 0;
  const frontAvgWear = (lf_w + rf_w) / 2;
  const rearAvgWear  = (lr_w + rr_w) / 2;
  const wearAxisDiff = rearAvgWear - frontAvgWear;
  if (wearAxisDiff > 15 && rearAvgWear > 25) {
    recs.push({ id: 'rear-wear', type: 'strategy', priority: 3, message: es
      ? `🛞 Traseros desgastan ${wearAxisDiff.toFixed(0)}% más que delanteros — suavizar salida del gas`
      : `🛞 Rears ${wearAxisDiff.toFixed(0)}% more worn than fronts — ease throttle on exit` });
  }

  // ── ACELERACIÓN TEMPRANA CON SOBREVIRAJE / EARLY THROTTLE + OVERSTEER ──
  const steerAngle = Math.abs((d.steering as number) || 0);
  if (throttle > 65 && steerAngle > 35 && speed > 70 && handling === 'oversteer') {
    recs.push({ id: 'early-throttle', type: 'tip', priority: 3, message: es
      ? '⚡ Gas temprano con sobreviraje — esperar volante más recto antes de acelerar'
      : '⚡ Early throttle causing oversteer — wait for straighter wheel before power' });
  }

  // ── G LATERAL ALTO / HIGH LATERAL G ──
  const latG = Math.abs((d.gLateral as number) || 0);
  if (latG > 3.5 && speed > 80) {
    recs.push({ id: 'high-latg', type: 'tip', priority: 5, message: es
      ? `📐 ${latG.toFixed(1)}g lateral — límite de adherencia, línea más suave`
      : `📐 ${latG.toFixed(1)}g lateral — at grip limit, keep a smoother line` });
  }

  // ── CONSISTENCIA DE VUELTA / LAP CONSISTENCY ──
  if (history.lapTimes.length >= 4) {
    const ltMean = history.lapTimes.reduce((a, b) => a + b, 0) / history.lapTimes.length;
    const ltStdDev = Math.sqrt(
      history.lapTimes.reduce((s, lt) => s + (lt - ltMean) ** 2, 0) / history.lapTimes.length
    );
    if (ltStdDev > 1.5) {
      recs.push({ id: 'inconsistent', type: 'strategy', priority: 4, message: es
        ? `📊 Variación de vueltas ±${ltStdDev.toFixed(1)}s — misma línea y puntos de frenada cada vuelta`
        : `📊 Lap variance ±${ltStdDev.toFixed(1)}s — same line and braking markers every lap` });
    }
  }

  // ── DELTA AL LAP ÓPTIMO / DELTA TO OPTIMAL ──
  const deltaOptimal = Math.abs((d.deltaToOptimal as number) || 0);
  if (deltaOptimal > 2.5 && lap > 3 && delta > 2.0) {
    recs.push({ id: 'delta-opt', type: 'strategy', priority: 5, message: es
      ? `🎯 ${deltaOptimal.toFixed(1)}s del lap óptimo — revisar sectores, mejorar apexes`
      : `🎯 ${deltaOptimal.toFixed(1)}s from optimal lap — review sectors, hit the apex` });
  }

  // ── PISTA MOJADA / WET TRACK ──
  const trackStateStr = String((d.trackState as unknown) || '').toLowerCase();
  const isWetTrack = trackStateStr.includes('wet') || Number(trackStateStr) >= 4;
  if (isWetTrack) {
    recs.push({ id: 'wet', type: 'warning', priority: 2, message: es
      ? '🌧️ Pista mojada — reducir velocidad de entrada, evitar bordillos y marcas de pintura'
      : '🌧️ Wet track — reduce entry speed, avoid kerbs and painted lines' });
  }

  // ── ABS ACTIVO / ABS TRIGGERING ──
  const absActive = (d.absActive as boolean) || false;
  if (absActive && speed > 80 && brake > 50) {
    recs.push({ id: 'abs', type: 'tip', priority: 3, message: es
      ? '🔴 ABS activo — frenar un metro antes con menos presión inicial'
      : '🔴 ABS triggering — brake 1m earlier with less initial pressure' });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

// --- Sub-components ---

function ShiftLightsStrip({ rpm, slFirstRPM, slLastRPM, slBlinkRPM }: {
  rpm: number; slFirstRPM: number; slLastRPM: number; slBlinkRPM: number;
}) {
  const SEGS = 15;
  const shouldBlink = slBlinkRPM > 0 && rpm >= slBlinkRPM;

  const getSegClass = (i: number): string => {
    const range = slLastRPM - slFirstRPM;
    let lit: boolean;
    if (range > 0 && slFirstRPM > 0) {
      const segRPM = slFirstRPM + (range / SEGS) * (i + 1);
      lit = rpm >= segRPM;
    } else {
      lit = rpm / 8000 >= (i + 1) / SEGS;
    }
    if (!lit) return '';
    if (i >= 12) return 'lit-red';
    if (i >= 8)  return 'lit-yellow';
    return 'lit-green';
  };

  return (
    <div className={`shift-strip${shouldBlink ? ' shift-blink' : ''}`}>
      {Array.from({ length: SEGS }, (_, i) => (
        <div key={i} className={`shift-seg ${getSegClass(i)}`} />
      ))}
    </div>
  );
}

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
          <span className="text-xs font-mono font-bold" style={{ color }}>{value > 0 ? `${Number(value.toFixed(1))}${unit}` : '--'}</span>
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

  // Demo mode detection
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get('demo') === 'true';

  const [wsUrl, setWsUrl] = useState(localStorage.getItem('iracing_ws_url') || '');
  const { data: liveData, connected: liveConnected, connect, disconnect } = useIRacingLive(wsUrl || undefined);

  // Demo telemetry stream
  const demoStreamRef = useRef<ReturnType<typeof createDemoTelemetryStream> | null>(null);
  const [demoData, setDemoData] = useState<Record<string, unknown> | null>(() => {
    if (isDemo) {
      const stream = createDemoTelemetryStream();
      return stream(); // Initialize with first frame immediately
    }
    return null;
  });

  useEffect(() => {
    if (!isDemo) return;
    const stream = createDemoTelemetryStream();
    demoStreamRef.current = stream;
    const interval = setInterval(() => {
      if (demoStreamRef.current) {
        setDemoData(demoStreamRef.current());
      }
    }, 100); // 10Hz like real telemetry
    return () => clearInterval(interval);
  }, [isDemo]);

  // Use demo data if in demo mode, otherwise real data
  const data = isDemo ? (demoData as any) : liveData;
  const connected = isDemo ? true : liveConnected;

  const gHistRef = useRef<{ x: number; y: number }[]>([]);
  const [showDashboard, setShowDashboard] = useState(!!wsUrl || isDemo);
  const [showEvents, setShowEvents] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem('iracing_tts') !== 'false');
  const [uiScale, setUiScale] = useState(() => parseFloat(localStorage.getItem('iracing_ui_scale') || '0.75'));

  // Stint history for AI trend analysis
  const [stintHistory, setStintHistory] = useState<StintHistory>({ lapTimes: [], tireWear: [], fuelPerLap: [], fuelLevels: [] });

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
      // Record stint history on lap change
      if (lastLapTime > 0) {
        const lf = (d.tireLF_wear as number) || 0;
        const rf = (d.tireRF_wear as number) || 0;
        const lr = (d.tireLR_wear as number) || 0;
        const rr = (d.tireRR_wear as number) || 0;
        setStintHistory((prev) => ({
          lapTimes: [...prev.lapTimes.slice(-9), lastLapTime],
          tireWear: [...prev.tireWear.slice(-9), { lap: lap - 1, lf, rf, lr, rr }],
          fuelPerLap: [...prev.fuelPerLap.slice(-9), (d.fuelUsePerHour as number) || 0],
          fuelLevels: [...prev.fuelLevels.slice(-9), (d.fuelLevel as number) || 0],
        }));
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
  const fuelLevelLiters = (d.fuelLevel as number) || 0;
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

  const slFirstRPM = (d.slFirstRPM as number) || 0;
  const slLastRPM  = (d.slLastRPM  as number) || 0;
  const slBlinkRPM = (d.slBlinkRPM as number) || 0;

  const fuelPerLap = lap > 1 ? (100 - fuelPercent) / (lap - 1) : 0;
  const fuelLaps = fuelPerLap > 0 ? Math.floor(fuelPercent / fuelPerLap) : 99;

  const recommendations = useMemo(() => generateRecommendations(d, t, events, stintHistory, lang), [
    fuelPercent, lap, handling, trackTemp, incidentCount, tireLF_wear, tireRF_wear, tireLR_wear, tireRR_wear,
    delta, oilTemp, waterTemp, events.length, t, stintHistory, d, lang,
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
      // Race radio TTS — speak only the highest-priority new message
      if (ttsEnabled && wsUrl) {
        const topRec = newRecs.reduce((best, r) => r.priority < best.priority ? r : best, newRecs[0]);
        speakRecommendation(topRec.message, lang, wsUrl);
      }
    }
    lastRecIdsRef.current = currentIds;
  }, [recommendations, lap, d, addEvent, ttsEnabled, wsUrl, lang]);

  const typeColors: Record<string, string> = { warning: 'var(--rc-red)', tip: 'var(--rc-cyan)', strategy: 'var(--rc-yellow)' };
  const typeBg: Record<string, string> = { warning: 'rgba(255,31,68,0.08)', tip: 'rgba(0,200,255,0.06)', strategy: 'rgba(255,194,0,0.06)' };

  return (
    <div className={`racing-app h-screen flex flex-col overflow-hidden ${theme === 'light' ? 'racing-light' : ''}`} style={{ '--rc-scale': uiScale } as React.CSSProperties}>

      {/* SHIFT LIGHTS */}
      <ShiftLightsStrip rpm={rpm} slFirstRPM={slFirstRPM} slLastRPM={slLastRPM} slBlinkRPM={slBlinkRPM} />

      {/* HEADER */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'var(--rc-border)', background: 'var(--rc-surface)' }}>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="font-bold" style={{ color: 'var(--rc-cyan)', fontSize: '13px' }}>
            <IconDriver size={13} color="var(--rc-cyan)" /> {driverName}
          </span>
          {iRating > 0 && (
            <span className="rc-chip" style={{ background: 'rgba(0,200,255,0.1)', color: 'var(--rc-cyan)' }}>{iRating} iR</span>
          )}
          <span className="rc-chip" style={{ background: 'rgba(255,112,67,0.1)', color: 'var(--rc-orange)' }}>
            <IconCar size={12} color="var(--rc-orange)" /> {carName}
          </span>
          <span className="rc-chip" style={{ background: 'rgba(0,232,122,0.1)', color: 'var(--rc-green)' }}>
            <IconTrack size={12} color="var(--rc-green)" /> {trackName}{trackConfig ? ` · ${trackConfig}` : ''}
          </span>
          {sessionName && (
            <span className="rc-chip" style={{ background: 'rgba(255,194,0,0.1)', color: 'var(--rc-yellow)' }}>{sessionName.toUpperCase()}</span>
          )}
          {isDemo && (
            <span className="demo-badge">DEMO</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono" style={{ color: 'var(--rc-text-dim)' }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--rc-text-dim)' }}>MAX {maxSpeedSession.toFixed(0)} {t.kmh}</span>
          <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="rc-chip" style={{ background: 'var(--rc-card)', color: 'var(--rc-text-dim)' }}>{lang.toUpperCase()}</button>
          <button onClick={toggleTheme} className="rc-chip" style={{ background: 'var(--rc-card)', color: 'var(--rc-text-dim)' }}>{theme === 'dark' ? '☀' : '☽'}</button>
          {/* UI Scale controls */}
          <button onClick={() => { const s = Math.max(0.5, uiScale - 0.1); setUiScale(s); localStorage.setItem('iracing_ui_scale', String(s)); }}
            className="rc-chip" style={{ background: 'var(--rc-card)', color: 'var(--rc-text-dim)' }}>A−</button>
          <button onClick={() => { const s = Math.min(1.3, uiScale + 0.1); setUiScale(s); localStorage.setItem('iracing_ui_scale', String(s)); }}
            className="rc-chip" style={{ background: 'var(--rc-card)', color: 'var(--rc-text-dim)' }}>A+</button>
          <button onClick={() => setShowEvents(!showEvents)} className="rc-chip" style={{ background: showEvents ? 'rgba(0,200,255,0.1)' : 'var(--rc-card)', color: showEvents ? 'var(--rc-cyan)' : 'var(--rc-text-dim)' }}>
            <IconLog size={13} color={showEvents ? 'var(--rc-cyan)' : 'var(--rc-text-dim)'} />
          </button>
          <button onClick={handleDisconnect} className="rc-chip" style={{ background: 'rgba(255,31,68,0.1)', color: 'var(--rc-red)' }}>✕</button>
          <Link to="/analysis" className="rc-chip" style={{ background: 'rgba(0,200,255,0.1)', color: 'var(--rc-cyan)' }}>{t.analysis}</Link>
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="flex items-center gap-2 px-3 py-1">
        <div className="flex-1 rounded-md relative overflow-hidden" style={{ background: 'var(--rc-surface)', border: '1px solid var(--rc-border)' }}>
          {/* Delta track bar */}
          <div className="h-5 flex items-center px-3 relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--rc-border-strong)' }} />
            <motion.div
              animate={{ left: `${Math.max(4, Math.min(96, 50 + delta * 15))}%` }}
              transition={{ duration: 0.06 }}
              className="absolute top-0.5 bottom-0.5 w-3 rounded"
              style={{
                background: delta > 0 ? 'var(--rc-red)' : delta < 0 ? 'var(--rc-green)' : 'var(--rc-border-strong)',
                boxShadow: delta !== 0 ? `0 0 10px ${delta > 0 ? 'var(--rc-red)' : 'var(--rc-green)'}` : 'none',
              }}
            />
            <span className="relative z-10 text-xs font-bold font-mono" style={{ color: delta > 0 ? 'var(--rc-red)' : delta < 0 ? 'var(--rc-green)' : 'var(--rc-text-dim)' }}>
              {delta !== 0 ? (delta > 0 ? '+' : '') + delta.toFixed(3) : '± ---'}
            </span>
            <span className="ml-auto relative z-10 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--rc-text-muted)' }}>
              {bestLapTime > 0 && <span className="font-mono" style={{ color: 'var(--rc-purple)' }}>{fmt(bestLapTime)}</span>}
              <span>{t.delta}</span>
            </span>
          </div>
          {/* Scale ticks */}
          <div className="h-px flex" style={{ background: 'var(--rc-border)' }}>
            {[-3,-2,-1,0,1,2,3].map(s => (
              <div key={s} className="absolute bottom-0 w-px h-1" style={{ left: `${50 + s * 15}%`, background: s === 0 ? 'var(--rc-text-dim)' : 'var(--rc-border)' }} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rc-chip font-bold" style={{ background: 'rgba(0,232,122,0.12)', color: 'var(--rc-green)', fontSize: '13px' }}>P{position}</span>
          <span className="rc-chip" style={{ background: 'var(--rc-card)', color: 'var(--rc-text-dim)' }}>L{lap}</span>
          {onPitRoad && <span className="rc-chip blink" style={{ background: 'rgba(255,194,0,0.15)', color: 'var(--rc-yellow)' }}>{t.pit}</span>}
          {!connected && <span className="rc-chip pulse" style={{ background: 'rgba(255,31,68,0.15)', color: 'var(--rc-red)' }}>{t.reconnecting}</span>}
          {absOn && <span className="rc-chip blink" style={{ background: 'rgba(255,31,68,0.15)', color: 'var(--rc-red)' }}>{t.abs}</span>}
        </div>
      </div>

      {/* MAIN GRID — desktop: 12-col fixed; mobile: horizontal scroll */}
      <div className="flex-1 min-h-0 overflow-hidden">
      <div className="h-full grid gap-2 px-2 pb-2" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', minWidth: '900px', overflowX: 'auto' }}>

        {/* ─── ZONE A: COCKPIT ─── */}
        <div className="col-span-2 flex flex-col gap-2 overflow-hidden">
          {/* Speed + Gear + RPM */}
          <div className="rc-card rc-card-cockpit flex-1 flex flex-col items-center justify-center gap-1">
            <div className="rc-label" style={{ color: 'var(--rc-z-cockpit)' }}>{t.speed}</div>
            <div className="rc-value glow-cyan" style={{ fontSize: '68px', color: 'var(--rc-cyan)' }}>{speed.toFixed(0)}</div>
            <div className="rc-label">{t.kmh}</div>
            <div className="mt-2 w-full px-1">
              <RPMBar rpm={rpm} />
              <div className="flex justify-between mt-1 items-center">
                <span className="text-[10px] font-mono" style={{ color: 'var(--rc-text-muted)' }}>{rpm}</span>
                <span className="rc-value" style={{ fontSize: '38px', color: 'var(--rc-purple)' }}>
                  {gear === 0 ? 'N' : gear === -1 ? 'R' : gear}
                </span>
                <span className="text-[10px]" style={{ color: shiftIndicator > 80 ? 'var(--rc-red)' : 'var(--rc-text-muted)' }}>
                  {shiftIndicator > 80 ? `⬆ ${t.shift}` : `${shiftIndicator}%`}
                </span>
              </div>
            </div>
          </div>
          {/* Engine temps */}
          <div className="rc-card rc-card-mechanical">
            <div className="rc-label mb-2" style={{ color: 'var(--rc-z-mechanical)' }}>
              <IconEngine size={12} color="var(--rc-z-mechanical)" /> {t.engine}
            </div>
            <div className="space-y-1.5">
              <TempGauge value={oilTemp}   max={150} label={t.oilTemp}   icon="🛢️" />
              <TempGauge value={waterTemp} max={120} label={t.waterTemp} icon="💧" />
              <TempGauge value={oilPress}  max={8}   label={t.oilPress}  icon="⏲️" unit=" bar" />
              <TempGauge value={voltage}   max={15}  label={t.voltage}   icon="⚡" unit="V" />
            </div>
          </div>
        </div>

        {/* ─── ZONE B: TIMING & INPUTS ─── */}
        <div className="col-span-4 flex flex-col gap-2 overflow-hidden">
          {/* Pedals + Steering */}
          <div className="rc-card rc-card-cockpit">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t.throttle, value: throttle, cls: 'rc-bar-throttle', color: 'var(--rc-green)' },
                { label: t.brake,    value: brake,    cls: 'rc-bar-brake',    color: 'var(--rc-red)' },
                { label: t.clutch,   value: clutch,   cls: 'rc-bar-clutch',   color: 'var(--rc-purple)' },
              ].map(p => (
                <div key={p.label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="rc-label">{p.label}</span>
                    <span className="text-xs font-bold font-mono" style={{ color: p.color }}>{p.value}%</span>
                  </div>
                  <div className="h-3 rounded overflow-hidden" style={{ background: 'var(--rc-surface)' }}>
                    <motion.div animate={{ width: `${p.value}%` }} transition={{ duration: 0.05 }}
                      className={`h-full rounded ${p.cls}`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rc-label">{t.steering}</span>
              <div className="flex-1 h-2 rounded-full relative" style={{ background: 'var(--rc-surface)' }}>
                <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--rc-border-strong)' }} />
                <motion.div animate={{ left: `${50 + steering / 3.6}%` }} transition={{ duration: 0.04 }}
                  className="absolute top-0 w-2 h-full rounded-full"
                  style={{ background: 'var(--rc-purple)', marginLeft: '-4px', boxShadow: '0 0 6px var(--rc-purple)' }} />
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: 'var(--rc-purple)' }}>{steering.toFixed(0)}°</span>
            </div>
          </div>

          {/* Timing */}
          <div className="rc-card rc-card-timing">
            <div className="rc-label mb-2" style={{ color: 'var(--rc-z-timing)' }}>
              <IconClock size={12} color="var(--rc-z-timing)" /> {t.timing}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <div className="rc-label">{t.current}</div>
                <div className="font-mono text-base font-bold">{fmt(currentLapTime)}</div>
              </div>
              <div>
                <div className="rc-label" style={{ color: 'var(--rc-purple)' }}>{t.best}</div>
                <div className="font-mono text-base font-bold glow-purple" style={{ color: 'var(--rc-purple)' }}>{fmt(bestLapTime)}</div>
              </div>
              <div>
                <div className="rc-label">{t.last}</div>
                <div className="font-mono text-base">{fmt(lastLapTime)}</div>
              </div>
              <div>
                <div className="rc-label">{t.delta}</div>
                <div className="font-mono text-base font-bold" style={{ color: delta > 0 ? 'var(--rc-red)' : 'var(--rc-green)' }}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(3)}
                </div>
              </div>
            </div>
          </div>

          {/* Handling */}
          <div className="rc-card rc-card-dynamics">
            <div className="flex items-center justify-between">
              <div>
                <div className="rc-label" style={{ color: 'var(--rc-z-dynamics)' }}>
                  <IconGForce size={12} color="var(--rc-z-dynamics)" /> {t.handling}
                </div>
                <div className="text-lg font-bold mt-0.5" style={{ color: handling === 'oversteer' ? 'var(--rc-yellow)' : handling === 'understeer' ? 'var(--rc-red)' : 'var(--rc-green)' }}>
                  {handling === 'oversteer' ? t.oversteer : handling === 'understeer' ? t.understeer : t.neutral}
                </div>
              </div>
              <div className="text-center">
                <div className="rc-label">{t.abs}</div>
                <div className={`text-base font-bold mt-0.5 ${absOn ? 'blink' : ''}`} style={{ color: absOn ? 'var(--rc-red)' : 'var(--rc-text-muted)' }}>
                  {absOn ? `● ${t.active}` : `○ ${t.off}`}
                </div>
              </div>
              <div className="text-center">
                <div className="rc-label">⚠ {t.incidents}</div>
                <div className="text-base font-bold mt-0.5" style={{ color: incidentCount > 0 ? 'var(--rc-yellow)' : 'var(--rc-text-muted)' }}>{incidentCount}x</div>
              </div>
            </div>
          </div>

          {/* Track Map + Sectors + Input Trace */}
          <div className="rc-card rc-card-timing flex-1 overflow-hidden flex flex-col gap-3">
            <TrackMapLinear
              lapDistPct={(d.lapDistPct as number) || 0}
              isOffTrack={(d.isOffTrack as boolean) || false}
              otherCars={(d.carPositions as { idx: number; pct: number; pos: number; isPlayer: boolean }[]) || []}
              trackEvents={events
                .filter((e) => e.trackPct > 0 && ['off_track', 'oversteer', 'understeer', 'best_lap', 'ai_recommendation'].includes(e.type))
                .slice(-40)
                .map((e) => ({ pct: e.trackPct, type: e.type }))}
              labels={{ s1: t.s1, s2: t.s2, s3: t.s3, trackMap: t.trackMap }}
            />
            <SectorTimes
              currentSectors={currentSectors}
              previousSectors={previousSectors}
              labels={{ sectors: t.sectors, s1: t.s1, s2: t.s2, s3: t.s3, better: t.better, worse: t.worse }}
            />
            <InputTrace
              samples={inputSamples}
              durationMs={10000}
              labels={{ inputTrace: t.inputTrace, throttle: t.throttle, brake: t.brake }}
            />
          </div>
        </div>

        {/* ─── ZONE C: PERFORMANCE ─── */}
        <div className="col-span-3 flex flex-col gap-2 overflow-hidden">
          {/* G-Force */}
          <div className="rc-card rc-card-dynamics">
            <div className="rc-section-title mb-2" style={{ color: 'var(--rc-z-dynamics)' }}>
              <IconGForce size={13} color="var(--rc-z-dynamics)" /> {t.gforce}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex-shrink-0 gforce-container p-1">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="48" fill="var(--rc-gforce-bg)" />
                  <circle cx="50" cy="50" r="42" fill="none" className="gforce-ring" strokeWidth="1.2" />
                  <circle cx="50" cy="50" r="28" fill="none" className="gforce-ring" strokeWidth="0.8" />
                  <circle cx="50" cy="50" r="14" fill="none" className="gforce-ring" strokeWidth="0.6" />
                  <line x1="8" y1="50" x2="92" y2="50" className="gforce-cross" strokeWidth="0.6" />
                  <line x1="50" y1="8" x2="50" y2="92" className="gforce-cross" strokeWidth="0.6" />
                  {gHistRef.current.map((p, i) => (
                    <circle key={i}
                      cx={50 + Math.max(-40, Math.min(40, p.x * 12))}
                      cy={50 + Math.max(-40, Math.min(40, p.y * 12))}
                      r="2.5" className="gforce-trail" opacity={0.30 + (i / gHistRef.current.length) * 0.65} />
                  ))}
                  <circle
                    cx={50 + Math.max(-40, Math.min(40, gLateral * 12))}
                    cy={50 + Math.max(-40, Math.min(40, gLongitudinal * 12))}
                    r="5" className="gforce-dot" />
                </svg>
              </div>
              <div className="font-mono space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rc-label">{t.lat}</span>
                  <span className="font-bold text-base" style={{ color: 'var(--rc-cyan)' }}>{Math.abs(gLateral).toFixed(2)}g</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rc-label">{t.lon}</span>
                  <span className="font-bold text-base" style={{ color: 'var(--rc-cyan)' }}>{Math.abs(gLongitudinal).toFixed(2)}g</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tires — Visual */}
          <div className="rc-card rc-card-mechanical">
            <div className="flex items-center justify-between mb-2">
              <span className="rc-section-title" style={{ color: 'var(--rc-z-mechanical)' }}>
                <IconTire size={13} color="var(--rc-z-mechanical)" /> {t.tires}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'var(--rc-surface)', color: 'var(--rc-text-dim)' }}>{tireCompound}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 justify-items-center">
              <TireVisual temp={tireLF_temp} wear={tireLF_wear} position={t.fl} size={40} />
              <TireVisual temp={tireRF_temp} wear={tireRF_wear} position={t.fr} size={40} />
              <TireVisual temp={tireLR_temp} wear={tireLR_wear} position={t.rl} size={40} />
              <TireVisual temp={tireRR_temp} wear={tireRR_wear} position={t.rr} size={40} />
            </div>
          </div>

          {/* Fuel */}
          <div className="rc-card rc-card-strategy">
            <div className="rc-label mb-1.5" style={{ color: 'var(--rc-z-strategy)' }}>
              <IconFuel size={12} color="var(--rc-z-strategy)" /> {t.fuel}
            </div>
            <FuelGauge value={fuelPercent} label={t.level} icon="📊" />
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>{t.liters}</span><span className="font-mono">{fuelLevelLiters.toFixed(1)}L</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>{t.perLap}</span><span className="font-mono">{fuelPerLap.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>{t.lapsLeft}</span>
                <span className="font-mono font-bold" style={{ color: fuelLaps < 3 ? 'var(--rc-red)' : 'var(--rc-green)' }}>{fuelLaps}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>{t.consumption}</span><span className="font-mono">{fuelUsePerHour.toFixed(1)} L/h</span></div>
            </div>
          </div>

          {/* AI Engineer — with persistent history + auto-scroll */}
          <div className="rc-card rc-card-strategy flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="rc-section-title" style={{ color: 'var(--rc-z-strategy)' }}>
                <IconAI size={14} color="var(--rc-z-strategy)" /> {t.aiEngineer}
              </span>
              <button
                onClick={() => { const next = !ttsEnabled; setTtsEnabled(next); localStorage.setItem('iracing_tts', String(next)); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                style={{
                  background: ttsEnabled ? 'rgba(0,200,255,0.15)' : 'var(--rc-surface)',
                  color: ttsEnabled ? 'var(--rc-cyan)' : 'var(--rc-text-muted)',
                  border: `1px solid ${ttsEnabled ? 'var(--rc-cyan)' : 'var(--rc-border)'}`,
                }}>
                🎙 RADIO
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
              {/* Always show: current recommendations + full history */}
              {recommendations.map((rec) => (
                <div key={rec.id} className="px-2 py-1.5 rounded text-xs leading-snug"
                  style={{ background: typeBg[rec.type], borderLeft: `3px solid ${typeColors[rec.type]}` }}>
                  {rec.message}
                </div>
              ))}
              {events
                .filter(e => e.type === 'ai_recommendation')
                .slice(-20)
                .reverse()
                .map((evt) => (
                  <div key={evt.id} className="px-2 py-1 rounded text-xs leading-snug"
                    style={{ background: 'var(--rc-surface)', borderLeft: '2px solid var(--rc-text-muted)' }}>
                    <span style={{ color: 'var(--rc-text-dim)' }}>{evt.message}</span>
                    <span className="ml-2" style={{ color: 'var(--rc-text-muted)', fontSize: '10px' }}>L{evt.lap}</span>
                  </div>
                ))
              }
              {recommendations.length === 0 && events.filter(e => e.type === 'ai_recommendation').length === 0 && (
                <div className="text-xs text-center py-2" style={{ color: 'var(--rc-text-muted)' }}>{t.analyzing}</div>
              )}
            </div>
          </div>

        </div>

        {/* ─── ZONE D: STRATEGY ─── */}
        <div className="col-span-3 flex flex-col gap-2 overflow-hidden">

          {/* Stint Pace */}
          {stintHistory.lapTimes.length > 0 && (() => {
            const times = stintHistory.lapTimes;
            const best = Math.min(...times.filter((x) => x > 0));
            const avg = times.filter((x) => x > 0).reduce((a, b) => a + b, 0) / times.filter((x) => x > 0).length;
            const trend = times.length >= 3 ? times[times.length - 1] - times[times.length - 3] : 0;
            const avgFrontDeg = stintHistory.tireWear.length >= 2
              ? (() => {
                  const prev = stintHistory.tireWear[stintHistory.tireWear.length - 2];
                  const last = stintHistory.tireWear[stintHistory.tireWear.length - 1];
                  return ((last.lf - prev.lf) + (last.rf - prev.rf)) / 2;
                })() : 0;
            return (
              <div className="rc-card rc-card-timing flex-shrink-0">
                <div className="rc-section-title mb-2" style={{ color: 'var(--rc-z-timing)' }}>📊 {t.stintPace}</div>
                <div className="space-y-1.5">
                  <div className="flex gap-1 flex-wrap">
                    {times.slice(-5).map((lt, i, arr) => {
                      const actualLap = lap - (arr.length - 1 - i);
                      const isBest = lt === best;
                      const color = isBest ? 'var(--rc-purple)' : lt < avg ? 'var(--rc-green)' : 'var(--rc-red)';
                      return (
                        <div key={i} className="flex-1 text-center rounded px-1 py-0.5" style={{ background: 'var(--rc-surface)', minWidth: '44px' }}>
                          <div className="text-[9px]" style={{ color: 'var(--rc-text-muted)' }}>{t.lapLabel}{actualLap > 0 ? actualLap : '?'}</div>
                          <div className="text-[10px] font-mono font-bold" style={{ color }}>{fmt(lt)}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div className="text-center">
                      <div className="rc-label" style={{ fontSize: '9px' }}>{t.trendPer3L}</div>
                      <div className="font-mono font-bold text-[10px]" style={{ color: Math.abs(trend) < 0.2 ? 'var(--rc-green)' : trend > 0 ? 'var(--rc-red)' : 'var(--rc-green)' }}>
                        {trend > 0 ? '+' : ''}{trend.toFixed(2)}s
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="rc-label" style={{ fontSize: '9px' }}>{t.best}</div>
                      <div className="font-mono text-[10px]" style={{ color: 'var(--rc-purple)' }}>{fmt(best)}</div>
                    </div>
                    <div className="text-center">
                      <div className="rc-label" style={{ fontSize: '9px' }}>{t.frontDegL}</div>
                      <div className="font-mono font-bold text-[10px]" style={{ color: avgFrontDeg > 4 ? 'var(--rc-red)' : avgFrontDeg > 2 ? 'var(--rc-yellow)' : 'var(--rc-green)' }}>
                        {avgFrontDeg > 0 ? `${avgFrontDeg.toFixed(1)}%` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Lap History Table */}
          {stintHistory.lapTimes.length > 0 && (() => {
            const times = stintHistory.lapTimes;
            const best = Math.min(...times.filter((x) => x > 0));
            return (
              <div className="rc-card rc-card-timing flex-shrink-0">
                <div className="rc-section-title mb-2" style={{ color: 'var(--rc-z-timing)' }}>📋 {t.lapHistoryTitle}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] font-mono">
                    <thead>
                      <tr style={{ color: 'var(--rc-text-muted)', borderBottom: '1px solid var(--rc-border)' }}>
                        <th className="text-left pb-1 pr-2">{t.lapLabel}</th>
                        <th className="text-right pb-1 pr-2">{t.timing}</th>
                        <th className="text-right pb-1 pr-2">{t.deltaVsBest}</th>
                        <th className="text-right pb-1 pr-2">{t.wear}</th>
                        <th className="text-right pb-1">{t.fuelUsed}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {times.map((lt, i) => {
                        const lapNum = lap - (times.length - 1 - i);
                        const delta = lt - best;
                        const wear = stintHistory.tireWear[i];
                        const maxW = wear ? Math.max(wear.lf, wear.rf, wear.lr, wear.rr) : null;
                        const fuelLvl = stintHistory.fuelLevels[i];
                        const prevFuel = i > 0 ? stintHistory.fuelLevels[i - 1] : null;
                        const fuelDelta = prevFuel != null && fuelLvl != null ? prevFuel - fuelLvl : null;
                        const ltColor = lt === best ? 'var(--rc-purple)' : lt < times.reduce((a, b) => a + b, 0) / times.length ? 'var(--rc-green)' : 'var(--rc-red)';
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--rc-surface)' }}>
                            <td className="py-0.5 pr-2" style={{ color: 'var(--rc-text-muted)' }}>{lapNum > 0 ? lapNum : '?'}</td>
                            <td className="py-0.5 pr-2 text-right font-bold" style={{ color: ltColor }}>{fmt(lt)}</td>
                            <td className="py-0.5 pr-2 text-right" style={{ color: delta < 0.01 ? 'var(--rc-purple)' : 'var(--rc-text-dim)' }}>
                              {delta < 0.01 ? '🏅' : `+${delta.toFixed(3)}`}
                            </td>
                            <td className="py-0.5 pr-2 text-right" style={{ color: maxW != null && maxW > 60 ? 'var(--rc-red)' : 'var(--rc-text-dim)' }}>
                              {maxW != null ? `${maxW.toFixed(0)}%` : '--'}
                            </td>
                            <td className="py-0.5 text-right" style={{ color: 'var(--rc-text-dim)' }}>
                              {fuelDelta != null ? `${fuelDelta.toFixed(2)}L` : '--'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Track Info + Weather + Climate (grouped) */}
          {(() => {
            const trackInfo = findTrackInfo(trackName);
            const tip = trackInfo ? (lang === 'es' ? trackInfo.tipEs : trackInfo.tipEn) : null;
            return (
              <div className="rc-card flex-shrink-0">
                <div className="rc-section-title mb-2">
                  <IconInfo size={13} color="var(--rc-purple)" /> {lang === 'es' ? 'CIRCUITO Y CLIMA' : 'TRACK & WEATHER'}
                </div>
                <div className="space-y-2">
                  {/* Track name + details */}
                  <div className="text-xs">
                    <span className="font-bold" style={{ color: 'var(--rc-text)' }}>{trackInfo?.name || trackName}</span>
                    {trackInfo && <span style={{ color: 'var(--rc-text-dim)' }}> · {trackInfo.country} · {trackInfo.turns} {lang === 'es' ? 'curvas' : 'turns'}</span>}
                    {trackConfig && <span style={{ color: 'var(--rc-text-muted)' }}> ({trackConfig})</span>}
                  </div>
                  {trackInfo?.lapRecord && (
                    <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                      Record: <span className="font-mono font-bold" style={{ color: 'var(--rc-purple)' }}>{trackInfo.lapRecord}</span>
                    </div>
                  )}
                  {/* Driving tip */}
                  {tip && (
                    <div className="text-xs leading-relaxed" style={{ color: 'var(--rc-text-dim)', borderLeft: '2px solid var(--rc-purple)', paddingLeft: '8px' }}>
                      {tip}
                    </div>
                  )}
                  {/* Weather data */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1" style={{ borderTop: '1px solid var(--rc-border)' }}>
                    <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>🌡 {t.air}</span><span className="font-mono">{airTemp > 0 ? `${airTemp}°C` : '--'}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>🛣 {t.trackTemp}</span>
                      <span className="font-mono" style={{ color: trackTemp > 40 ? 'var(--rc-red)' : 'var(--rc-green)' }}>{trackTemp > 0 ? `${trackTemp}°C` : '--'}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>💨 {t.wind}</span><span className="font-mono">{windSpeed > 0 ? `${windSpeed.toFixed(0)} km/h` : '--'}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>💧 {t.humidity}</span><span className="font-mono">{humidity > 0 ? `${humidity}%` : '--'}</span></div>
                    {skies && <div className="col-span-2 flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>☁ {t.skies}</span><span className="font-mono capitalize">{skies}</span></div>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Event Log (moved here from column 4) */}
          {showEvents ? (
            <div className="rc-card flex-shrink-0 max-h-40 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="rc-section-title"><IconLog size={13} color="var(--rc-text-dim)" /> {t.events}</span>
                <button onClick={() => { clearSession(); setStintHistory({ lapTimes: [], tireWear: [], fuelPerLap: [], fuelLevels: [] }); }}
                  className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,31,68,0.1)', color: 'var(--rc-red)' }}>{t.clearLog}</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {events.slice().reverse().slice(0, 50).map((evt) => {
                  const evtColor = evt.type === 'off_track' ? 'var(--rc-red)' : evt.type === 'best_lap' ? 'var(--rc-green)' : evt.type === 'max_speed' ? 'var(--rc-cyan)' : 'var(--rc-yellow)';
                  return (
                    <div key={evt.id} className="text-[10px] px-2 py-0.5 rounded flex items-center gap-2" style={{ background: 'var(--rc-surface)' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: evtColor }} />
                      <span style={{ color: 'var(--rc-text-dim)' }}>{evt.message}</span>
                    </div>
                  );
                })}
                {events.length === 0 && <span className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>{t.noEvents}</span>}
              </div>
            </div>
          ) : (
            <div className="rc-card flex-shrink-0">
              <div className="flex items-center justify-between mb-1">
                <span className="rc-label"><IconLog size={12} color="var(--rc-text-dim)" /> {t.events}</span>
                <button onClick={() => setShowEvents(true)} className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--rc-surface)', color: 'var(--rc-text-dim)' }}>+</button>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>⚡ {t.maxSpeed}</span><span className="font-mono font-bold" style={{ color: 'var(--rc-cyan)' }}>{maxSpeedSession.toFixed(0)} {t.kmh}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>🛞 {t.offTrack}</span><span className="font-mono">{events.filter(e => e.type === 'off_track').length}x</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>⚠ {t.incidents}</span><span className="font-mono">{incidentCount}x</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--rc-text-muted)' }}>🏆 {t.bestLapEvent}</span><span className="font-mono" style={{ color: 'var(--rc-purple)' }}>{fmt(bestLapTime)}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>{/* end grid */}
      </div>{/* end responsive wrapper */}
    </div>
  );
}
