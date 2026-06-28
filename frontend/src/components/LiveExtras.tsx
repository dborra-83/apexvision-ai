/**
 * ApexVision AI — Live Dashboard Extras
 * - TrackPositionsMap: mini-mapa con posiciones de todos los autos
 * - PitPrediction: predicción de cuándo pitar
 * - LapHistoryTable: tabla compacta de las últimas N vueltas
 */

import { useMemo } from 'react';
import { useLangStore } from '../store/lang-store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CarPosition {
  idx: number;
  pct: number;   // 0-100 track position
  pos: number;   // race position
  isPlayer: boolean;
}

// ─── 1. Track Positions Map ───────────────────────────────────────────────────

interface TrackPositionsMapProps {
  cars: CarPosition[];
  playerPct: number;
}

export function TrackPositionsMap({ cars }: TrackPositionsMapProps) {
  const lang = useLangStore((s) => s.lang);

  // Sort to render player on top
  const sortedCars = useMemo(() => {
    return [...cars].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
  }, [cars]);

  if (sortedCars.length === 0) return null;

  return (
    <div>
      <div className="rc-section-title" style={{ marginBottom: '6px', fontSize: '10px' }}>
        {lang === 'es' ? 'POSICIONES EN PISTA' : 'TRACK POSITIONS'}
      </div>
      <div style={{
        position: 'relative', height: '24px',
        background: 'var(--rc-surface)', borderRadius: '12px',
        overflow: 'hidden', border: '1px solid var(--rc-border)',
      }}>
        {/* Sector dividers */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '33.3%', width: '1px', background: 'var(--rc-border)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '66.6%', width: '1px', background: 'var(--rc-border)' }} />

        {/* Car dots */}
        {sortedCars.map((car) => (
          <div
            key={car.idx}
            title={`P${car.pos}${car.isPlayer ? ' (you)' : ''}`}
            style={{
              position: 'absolute',
              top: '50%', transform: 'translate(-50%, -50%)',
              left: `${Math.max(1, Math.min(99, car.pct))}%`,
              width: car.isPlayer ? '10px' : '6px',
              height: car.isPlayer ? '10px' : '6px',
              borderRadius: '50%',
              background: car.isPlayer ? 'var(--rc-cyan)' : 'var(--rc-text-dim)',
              boxShadow: car.isPlayer ? '0 0 6px var(--rc-cyan)' : 'none',
              zIndex: car.isPlayer ? 10 : 1,
              opacity: car.isPlayer ? 1 : 0.5,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
        <span style={{ fontSize: '8px', color: 'var(--rc-text-muted)' }}>S1</span>
        <span style={{ fontSize: '8px', color: 'var(--rc-text-muted)' }}>S2</span>
        <span style={{ fontSize: '8px', color: 'var(--rc-text-muted)' }}>S3</span>
      </div>
    </div>
  );
}

// ─── 2. Pit Prediction ────────────────────────────────────────────────────────

interface PitPredictionProps {
  fuelPercent: number;
  fuelPerLap: number;
  tireLFWear: number;
  tireRFWear: number;
  tireLRWear: number;
  tireRRWear: number;
  lap: number;
  sessionLapsRemaining: number;
}

export function PitPrediction(props: PitPredictionProps) {
  const lang = useLangStore((s) => s.lang);
  const { fuelPercent, fuelPerLap, tireLFWear, tireRFWear, tireLRWear, tireRRWear, lap, sessionLapsRemaining } = props;

  const prediction = useMemo(() => {
    // Fuel-based pit prediction
    const fuelLapsLeft = fuelPerLap > 0 ? Math.floor(fuelPercent / fuelPerLap) : 99;

    // Tire-based pit prediction (assume pit at 85% wear)
    const maxWear = Math.max(tireLFWear, tireRFWear, tireLRWear, tireRRWear);
    const wearRate = lap > 1 ? maxWear / (lap - 1) : 0;
    const tireLapsLeft = wearRate > 0 ? Math.floor((85 - maxWear) / wearRate) : 99;

    // Take the minimum (most urgent)
    const lapsUntilPit = Math.max(0, Math.min(fuelLapsLeft, tireLapsLeft));
    const pitLap = lap + lapsUntilPit;

    // Determine the limiting factor
    let reason = '';
    if (fuelLapsLeft <= tireLapsLeft) {
      reason = lang === 'es' ? 'combustible' : 'fuel';
    } else {
      reason = lang === 'es' ? 'neumáticos' : 'tires';
    }

    // Can we finish without pit?
    const canFinish = sessionLapsRemaining > 0 && lapsUntilPit >= sessionLapsRemaining;

    return { lapsUntilPit, pitLap, reason, canFinish };
  }, [fuelPercent, fuelPerLap, tireLFWear, tireRFWear, tireLRWear, tireRRWear, lap, sessionLapsRemaining, lang]);

  const urgency = prediction.lapsUntilPit <= 2 ? 'var(--rc-red)' : prediction.lapsUntilPit <= 5 ? 'var(--rc-yellow)' : 'var(--rc-green)';

  return (
    <div style={{
      background: 'var(--rc-surface)', borderRadius: '6px',
      padding: '8px 10px', border: '1px solid var(--rc-border)',
    }}>
      <div className="rc-section-title" style={{ marginBottom: '4px', fontSize: '10px' }}>
        {lang === 'es' ? 'PREDICCIÓN PIT' : 'PIT PREDICTION'}
      </div>
      {prediction.canFinish ? (
        <div style={{ fontSize: '11px', color: 'var(--rc-green)', fontWeight: 700 }}>
          ✓ {lang === 'es' ? 'Puede terminar sin parar' : 'Can finish without stopping'}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 900, color: urgency }}>
            {prediction.lapsUntilPit}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--rc-text-dim)' }}>
            <div>{lang === 'es' ? 'vueltas para pit' : 'laps to pit'}</div>
            <div style={{ fontSize: '9px', color: 'var(--rc-text-muted)' }}>
              ({prediction.reason}) → L{prediction.pitLap}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 3. Lap History Table ─────────────────────────────────────────────────────

interface LapRecord {
  lap: number;
  time: number;
  isBest: boolean;
  delta: number; // vs best
}

interface LapHistoryTableProps {
  laps: LapRecord[];
  maxRows?: number;
}

export function LapHistoryTable({ laps, maxRows = 8 }: LapHistoryTableProps) {
  const lang = useLangStore((s) => s.lang);
  const visible = laps.slice(-maxRows);

  if (visible.length === 0) return null;

  const fmt = (t: number) => {
    if (t <= 0) return '--:--.---';
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s.toFixed(3).padStart(6, '0')}`;
  };

  return (
    <div>
      <div className="rc-section-title" style={{ marginBottom: '4px', fontSize: '10px' }}>
        {lang === 'es' ? 'HISTORIAL DE VUELTAS' : 'LAP HISTORY'}
      </div>
      <div style={{ fontSize: '10px' }}>
        {visible.map((l) => (
          <div key={l.lap} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '3px 6px', borderRadius: '3px',
            background: l.isBest ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
          }}>
            <span style={{ color: 'var(--rc-text-dim)', width: '28px' }}>L{l.lap}</span>
            <span style={{
              fontFamily: 'monospace', fontWeight: l.isBest ? 700 : 400,
              color: l.isBest ? 'var(--rc-purple)' : 'var(--rc-text)',
            }}>
              {fmt(l.time)}
            </span>
            <span style={{
              fontFamily: 'monospace', fontSize: '9px', width: '50px', textAlign: 'right',
              color: l.delta === 0 ? 'var(--rc-purple)' : l.delta > 0 ? 'var(--rc-red)' : 'var(--rc-green)',
            }}>
              {l.isBest ? 'BEST' : l.delta > 0 ? `+${l.delta.toFixed(2)}` : l.delta.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
