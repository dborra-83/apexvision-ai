/**
 * Paneles de telemetría avanzada para la vista Live:
 * - TrackMapLinear: mapa lineal del circuito con posición y sectores
 * - SectorTimes: tiempos por sector comparados con vuelta anterior
 * - InputTrace: gráfico de throttle/brake en el tiempo (últimos N segundos)
 */

import { useMemo } from 'react';

// ============================================================
// TRACK MAP LINEAR
// ============================================================

interface CarPosition {
  idx: number;
  pct: number;
  pos: number;
  isPlayer: boolean;
}

interface TrackEventMarker {
  pct: number;   // 0-100 track position where it happened
  type: 'off_track' | 'oversteer' | 'understeer' | 'warning' | 'best_lap' | 'ai_recommendation' | string;
}

interface TrackMapLinearProps {
  lapDistPct: number;
  sector1End?: number;
  sector2End?: number;
  isOffTrack?: boolean;
  otherCars?: CarPosition[];
  trackEvents?: TrackEventMarker[];
  labels: { s1: string; s2: string; s3: string; trackMap: string };
}

export function TrackMapLinear({ lapDistPct, sector1End = 33, sector2End = 66, isOffTrack, otherCars = [], trackEvents = [], labels }: TrackMapLinearProps) {
  const currentSector = lapDistPct < sector1End ? 1 : lapDistPct < sector2End ? 2 : 3;
  const sectorColors = ['var(--rc-cyan)', 'var(--rc-purple)', 'var(--rc-orange)'];

  const rivals = otherCars.filter((c) => !c.isPlayer && c.pct > 0.1);

  const eventColor = (type: string): string => {
    if (type === 'off_track') return 'var(--rc-red)';
    if (type === 'best_lap') return 'var(--rc-purple)';
    if (type === 'oversteer' || type === 'understeer') return 'var(--rc-orange)';
    return 'var(--rc-yellow)';
  };

  return (
    <div>
      <div className="rc-section-title mb-1" style={{ fontSize: '11px' }}>
        {labels.trackMap}
        {rivals.length > 0 && (
          <span className="ml-2 font-mono text-[9px]" style={{ color: 'var(--rc-text-muted)' }}>
            · {rivals.length + 1} cars
          </span>
        )}
      </div>
      {/* Linear track bar */}
      <div className="relative rounded-full overflow-hidden" style={{ background: 'var(--rc-surface)', height: '28px' }}>
        {/* Sector divisions */}
        <div className="absolute top-0 bottom-0 left-0" style={{ width: `${sector1End}%`, background: 'rgba(0,212,255,0.08)', borderRight: '1px solid var(--rc-border)' }} />
        <div className="absolute top-0 bottom-0" style={{ left: `${sector1End}%`, width: `${sector2End - sector1End}%`, background: 'rgba(176,102,255,0.08)', borderRight: '1px solid var(--rc-border)' }} />
        <div className="absolute top-0 bottom-0" style={{ left: `${sector2End}%`, right: 0, background: 'rgba(255,107,0,0.08)' }} />

        {/* Event markers — triangles at the bottom of the bar */}
        {trackEvents.map((ev, i) => (
          <div
            key={i}
            className="absolute bottom-0"
            title={ev.type}
            style={{
              left: `${Math.min(99, ev.pct)}%`,
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderBottom: `6px solid ${eventColor(ev.type)}`,
              opacity: 0.85,
              zIndex: 5,
            }}
          />
        ))}

        {/* Rival cars — small yellow dots */}
        {rivals.map((car) => (
          <div
            key={car.idx}
            className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200"
            style={{
              left: `${Math.min(99, car.pct)}%`,
              width: '6px',
              height: '6px',
              background: 'var(--rc-yellow)',
              opacity: 0.75,
              transform: 'translateX(-50%) translateY(-50%)',
            }}
          />
        ))}

        {/* Player position marker */}
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all duration-100"
          style={{
            left: `${Math.min(99, lapDistPct)}%`,
            width: '6px',
            transform: 'translateX(-50%)',
            background: isOffTrack ? 'var(--rc-red)' : sectorColors[currentSector - 1],
            boxShadow: `0 0 10px ${isOffTrack ? 'var(--rc-red)' : sectorColors[currentSector - 1]}`,
            zIndex: 10,
          }}
        />

        {/* Sector labels */}
        <div className="absolute inset-0 flex items-center pointer-events-none">
          <span className="flex-1 text-center text-[9px] font-bold" style={{ color: 'var(--rc-cyan)', opacity: 0.5 }}>{labels.s1}</span>
          <span className="flex-1 text-center text-[9px] font-bold" style={{ color: 'var(--rc-purple)', opacity: 0.5 }}>{labels.s2}</span>
          <span className="flex-1 text-center text-[9px] font-bold" style={{ color: 'var(--rc-orange)', opacity: 0.5 }}>{labels.s3}</span>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between mt-1 text-[10px] font-mono" style={{ color: 'var(--rc-text-dim)' }}>
        <span>{lapDistPct.toFixed(0)}% <span className="font-bold" style={{ color: sectorColors[currentSector - 1] }}>
          {currentSector === 1 ? labels.s1 : currentSector === 2 ? labels.s2 : labels.s3}
        </span></span>
        {rivals.length > 0 && (
          <span style={{ color: 'var(--rc-yellow)' }}>
            ● <span style={{ color: 'var(--rc-text-muted)' }}>rival</span> &nbsp;
            <span style={{ color: sectorColors[currentSector - 1] }}>●</span> <span style={{ color: 'var(--rc-text-muted)' }}>yo</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SECTOR TIMES
// ============================================================

export interface SectorTime {
  sector: number;
  time: number; // seconds
}

interface SectorTimesProps {
  currentSectors: SectorTime[];
  previousSectors: SectorTime[];
  labels: { sectors: string; s1: string; s2: string; s3: string; better: string; worse: string };
}

export function SectorTimes({ currentSectors, previousSectors, labels }: SectorTimesProps) {
  const sectorColors = ['var(--rc-cyan)', 'var(--rc-purple)', 'var(--rc-orange)'];
  const sectorLabels = [labels.s1, labels.s2, labels.s3];

  return (
    <div>
      <div className="rc-section-title mb-2" style={{ fontSize: '11px' }}>{labels.sectors}</div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => {
          const current = currentSectors[i]?.time || 0;
          const previous = previousSectors[i]?.time || 0;
          const diff = current > 0 && previous > 0 ? current - previous : 0;
          const isBetter = diff < 0;

          return (
            <div key={i} className="text-center rounded px-2 py-1.5" style={{ background: 'var(--rc-surface)' }}>
              <div className="text-[10px] font-bold mb-0.5" style={{ color: sectorColors[i] }}>{sectorLabels[i]}</div>
              <div className="text-sm font-mono font-bold">
                {current > 0 ? current.toFixed(2) : '--.-'}
              </div>
              {diff !== 0 && (
                <div className="text-[10px] font-mono" style={{ color: isBetter ? 'var(--rc-green)' : 'var(--rc-red)' }}>
                  {isBetter ? '' : '+'}{diff.toFixed(2)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// INPUT TRACE (Throttle/Brake over time)
// ============================================================

export interface InputSample {
  t: number; // timestamp ms
  throttle: number; // 0-100
  brake: number; // 0-100
}

interface InputTraceProps {
  samples: InputSample[];
  durationMs?: number; // window width in ms
  labels: { inputTrace: string; throttle: string; brake: string };
}

export function InputTrace({ samples, durationMs = 10000, labels }: InputTraceProps) {
  const { throttlePath, brakePath } = useMemo(() => {
    if (samples.length < 2) return { throttlePath: '', brakePath: '' };

    const now = samples[samples.length - 1]?.t || Date.now();
    const startT = now - durationMs;
    const visible = samples.filter((s) => s.t >= startT);

    if (visible.length < 2) return { throttlePath: '', brakePath: '' };

    const w = 100;
    const h = 100;

    const toX = (t: number) => ((t - startT) / durationMs) * w;
    const toY = (val: number) => h - (val / 100) * h;

    let tp = `M ${toX(visible[0].t).toFixed(1)} ${toY(visible[0].throttle).toFixed(1)}`;
    let bp = `M ${toX(visible[0].t).toFixed(1)} ${toY(visible[0].brake).toFixed(1)}`;

    for (let i = 1; i < visible.length; i++) {
      const x = toX(visible[i].t).toFixed(1);
      tp += ` L ${x} ${toY(visible[i].throttle).toFixed(1)}`;
      bp += ` L ${x} ${toY(visible[i].brake).toFixed(1)}`;
    }

    return { throttlePath: tp, brakePath: bp };
  }, [samples, durationMs]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="rc-section-title" style={{ fontSize: '11px' }}>{labels.inputTrace}</span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded" style={{ background: 'var(--rc-green)' }} />{labels.throttle}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded" style={{ background: 'var(--rc-red)' }} />{labels.brake}</span>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--rc-surface)', height: '60px' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {/* Grid lines */}
          <line x1="0" y1="50" x2="100" y2="50" stroke="var(--rc-border)" strokeWidth="0.3" />
          <line x1="0" y1="25" x2="100" y2="25" stroke="var(--rc-border)" strokeWidth="0.2" strokeDasharray="2 2" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="var(--rc-border)" strokeWidth="0.2" strokeDasharray="2 2" />
          {/* Throttle line */}
          {throttlePath && <path d={throttlePath} fill="none" stroke="var(--rc-green)" strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />}
          {/* Brake line */}
          {brakePath && <path d={brakePath} fill="none" stroke="var(--rc-red)" strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />}
        </svg>
      </div>
    </div>
  );
}
