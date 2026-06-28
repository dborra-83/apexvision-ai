/**
 * ApexVision AI — Analysis Extras
 * Additional analysis components: Session Comparison, Problem Zones,
 * Tire Degradation Chart, and CSV Export.
 */

import { useState, useMemo } from 'react';
import { useLangStore } from '../store/lang-store';
import { listSessions, loadSession, SessionListItem } from '../utils/s3-sessions';
import { fmtLapTime as fmt } from '../utils/format';

// ─── Types (shared with Analysis.tsx) ─────────────────────────────────────────

interface SessionInfo {
  startTime: string; driver: string; iRating: number; license: string;
  car: string; carNumber: string; track: string; trackConfig: string;
  trackLength: string; sessionName: string; airTemp: number; trackTemp: number;
}

interface LapSummary {
  lap: number; lapTime: number; maxSpeed: number; avgSpeed: number; minSpeed: number;
  fuelStart: number; fuelEnd: number; fuelUsed: number; samples: number;
  offTracks: number; maxGLat: number; maxGLon: number; maxBrake: number; incidents: number;
}

interface SessionEvent {
  type: string; timestamp: number; message: string;
  lap?: number; trackPct?: number; speed?: number;
}

interface LoadedSession { info: SessionInfo; laps: LapSummary[]; events: SessionEvent[]; }

// ─── Translations ─────────────────────────────────────────────────────────────

function useT(lang: string) {
  return lang === 'es' ? {
    compare: 'Comparar Sesiones',
    loadSecond: 'Cargar segunda sesión',
    problemZones: 'Zonas problemáticas',
    offTracksAt: 'salidas en',
    tireDeg: 'Degradación de Neumáticos',
    exportCsv: 'Exportar CSV',
    comparison: 'Comparación',
    session1: 'Sesión 1',
    session2: 'Sesión 2',
    bestLap: 'Mejor vuelta',
    avgSpeed: 'Vel. promedio',
    consistency: 'Consistencia',
    totalFuel: 'Combustible total',
    noData: 'Sin datos',
    frequency: 'frecuencia',
    zone: 'zona',
    lapN: 'Vuelta',
    wear: 'Desgaste',
    loading: 'Cargando...',
  } : {
    compare: 'Compare Sessions',
    loadSecond: 'Load second session',
    problemZones: 'Problem Zones',
    offTracksAt: 'off-tracks at',
    tireDeg: 'Tire Degradation',
    exportCsv: 'Export CSV',
    comparison: 'Comparison',
    session1: 'Session 1',
    session2: 'Session 2',
    bestLap: 'Best Lap',
    avgSpeed: 'Avg Speed',
    consistency: 'Consistency',
    totalFuel: 'Total Fuel',
    noData: 'No data',
    frequency: 'frequency',
    zone: 'zone',
    lapN: 'Lap',
    wear: 'Wear',
    loading: 'Loading...',
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function computeSessionStats(laps: LapSummary[]) {
  const valid = laps.filter((l) => l.lapTime > 0);
  if (!valid.length) return null;
  const times = valid.map((l) => l.lapTime);
  const best = Math.min(...times);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const avgSpeed = valid.reduce((s, l) => s + l.avgSpeed, 0) / valid.length;
  const stdDev = Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length);
  const consistency = (1 - stdDev / avg) * 100;
  const totalFuel = laps.reduce((s, l) => s + l.fuelUsed, 0);
  return { best, avg, avgSpeed, consistency, totalFuel };
}

// ─── 1. Session Comparison Panel ──────────────────────────────────────────────

interface SessionComparisonPanelProps {
  session1: LoadedSession;
}

export function SessionComparisonPanel({ session1 }: SessionComparisonPanelProps) {
  const lang = useLangStore((s) => s.lang);
  const t = useT(lang);

  const [session2, setSession2] = useState<LoadedSession | null>(null);
  const [s3Sessions, setS3Sessions] = useState<SessionListItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [s3Loaded, setS3Loaded] = useState(false);

  const stats1 = useMemo(() => computeSessionStats(session1.laps), [session1]);
  const stats2 = useMemo(() => session2 ? computeSessionStats(session2.laps) : null, [session2]);

  const handleOpenPicker = async () => {
    setShowPicker(true);
    if (!s3Loaded) {
      try {
        const sessions = await listSessions();
        setS3Sessions(sessions);
      } catch { /* ignore */ }
      setS3Loaded(true);
    }
  };

  const handleLoadSecondSession = async (s: SessionListItem) => {
    setLoading(true);
    try {
      const data = await loadSession(s);
      if (data.info) setSession2({ info: data.info, laps: data.laps, events: data.events });
    } catch (e) { console.error(e); }
    finally { setLoading(false); setShowPicker(false); }
  };

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setLoading(true);
    let info: SessionInfo | null = null, laps: LapSummary[] = [], events: SessionEvent[] = [];
    try {
      for (const file of Array.from(e.target.files)) {
        const name = file.name.toLowerCase();
        const text = await file.text();
        if (name.includes('session_info') || name.includes('session-info')) {
          info = JSON.parse(text);
        } else if (name.includes('lap_summar') || name.includes('lap-summar')) {
          laps = JSON.parse(text);
        } else if (name.endsWith('.jsonl') || name.includes('events')) {
          events = text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
        }
      }
      if (info) setSession2({ info, laps, events });
    } catch (e) { console.error(e); }
    finally { setLoading(false); setShowPicker(false); }
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
          🔀 {t.compare}
        </h3>
        {!session2 && (
          <button
            onClick={handleOpenPicker}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: '6px', padding: '6px 12px', fontSize: '11px',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t.loadSecond}
          </button>
        )}
        {session2 && (
          <button
            onClick={() => setSession2(null)}
            style={{
              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              borderRadius: '6px', padding: '6px 12px', fontSize: '11px',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Session picker modal */}
      {showPicker && !session2 && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '12px', marginBottom: '16px',
        }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{
              display: 'inline-block', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              borderRadius: '6px', padding: '8px 14px', fontSize: '11px', cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}>
              📁 {lang === 'es' ? 'Cargar desde archivos' : 'Load from files'}
              <input type="file" multiple accept=".json,.jsonl" onChange={handleFileLoad} style={{ display: 'none' }} />
            </label>
          </div>
          {loading && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.loading}</p>}
          {s3Sessions.length > 0 && (
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {s3Sessions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => handleLoadSecondSession(s)}
                  style={{
                    padding: '6px 10px', fontSize: '11px', cursor: 'pointer',
                    borderRadius: '4px', color: 'var(--text-secondary)',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {s.track || s.name} — {s.driver || 'Unknown'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comparison table */}
      {stats1 && stats2 && session2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px' }}>
          {/* Header */}
          <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}></div>
          <div style={{ fontWeight: 700, color: '#0ea5e9', fontSize: '10px', textAlign: 'center' }}>
            {t.session1}
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
              {session1.info.track}
            </div>
          </div>
          <div style={{ fontWeight: 700, color: '#a855f7', fontSize: '10px', textAlign: 'center' }}>
            {t.session2}
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
              {session2.info.track}
            </div>
          </div>

          {/* Best Lap */}
          <CompRow label={t.bestLap} v1={fmt(stats1.best)} v2={fmt(stats2.best)} better={stats1.best <= stats2.best ? 1 : 2} />
          {/* Avg Speed */}
          <CompRow label={t.avgSpeed} v1={`${stats1.avgSpeed.toFixed(1)} km/h`} v2={`${stats2.avgSpeed.toFixed(1)} km/h`} better={stats1.avgSpeed >= stats2.avgSpeed ? 1 : 2} />
          {/* Consistency */}
          <CompRow label={t.consistency} v1={`${stats1.consistency.toFixed(1)}%`} v2={`${stats2.consistency.toFixed(1)}%`} better={stats1.consistency >= stats2.consistency ? 1 : 2} />
          {/* Total Fuel */}
          <CompRow label={t.totalFuel} v1={`${stats1.totalFuel.toFixed(1)}%`} v2={`${stats2.totalFuel.toFixed(1)}%`} better={stats1.totalFuel <= stats2.totalFuel ? 1 : 2} />
        </div>
      )}

      {stats1 && !session2 && !showPicker && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
          {lang === 'es'
            ? 'Carga una segunda sesión para comparar rendimiento lado a lado.'
            : 'Load a second session to compare performance side by side.'}
        </p>
      )}
    </div>
  );
}

function CompRow({ label, v1, v2, better }: { label: string; v1: string; v2: string; better: 1 | 2 }) {
  return (
    <>
      <div style={{ color: 'var(--text-secondary)', fontWeight: 600, padding: '6px 0', borderTop: '1px solid var(--border)' }}>{label}</div>
      <div style={{
        textAlign: 'center', fontFamily: 'monospace', padding: '6px 0',
        borderTop: '1px solid var(--border)',
        color: better === 1 ? '#22c55e' : 'var(--text-muted)', fontWeight: better === 1 ? 700 : 400,
      }}>
        {v1} {better === 1 && '✓'}
      </div>
      <div style={{
        textAlign: 'center', fontFamily: 'monospace', padding: '6px 0',
        borderTop: '1px solid var(--border)',
        color: better === 2 ? '#22c55e' : 'var(--text-muted)', fontWeight: better === 2 ? 700 : 400,
      }}>
        {v2} {better === 2 && '✓'}
      </div>
    </>
  );
}

// ─── 2. Problematic Corners Detection ─────────────────────────────────────────

interface ProblemZonesCardProps {
  events: SessionEvent[];
}

export function ProblemZonesCard({ events }: ProblemZonesCardProps) {
  const lang = useLangStore((s) => s.lang);
  const t = useT(lang);

  const zones = useMemo(() => {
    const offTracks = events.filter((e) => e.type === 'off_track' && e.trackPct != null);
    if (offTracks.length === 0) return [];

    // Group off-tracks into 5% zones (0-5, 5-10, ..., 95-100)
    const zoneCounts: Record<number, number> = {};
    for (const ev of offTracks) {
      const zoneIdx = Math.floor((ev.trackPct ?? 0) / 5);
      zoneCounts[zoneIdx] = (zoneCounts[zoneIdx] || 0) + 1;
    }

    // Sort by count descending, take top 3
    return Object.entries(zoneCounts)
      .map(([zIdx, count]) => ({
        zoneStart: Number(zIdx) * 5,
        zoneEnd: Number(zIdx) * 5 + 5,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [events]);

  if (zones.length === 0) return null;

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
        🚧 {t.problemZones}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {zones.map((zone, i) => {
          const severity = zone.count >= 5 ? '#ef4444' : zone.count >= 3 ? '#f59e0b' : '#0ea5e9';
          const barWidth = (zone.count / zones[0].count) * 100;
          return (
            <div key={i} style={{
              background: `${severity}0d`, border: `1px solid ${severity}25`,
              borderRadius: '8px', padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t.zone} {zone.zoneStart}% – {zone.zoneEnd}%
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: severity, fontWeight: 700 }}>
                  {zone.count}× {t.offTracksAt} {zone.zoneStart}-{zone.zoneEnd}%
                </span>
              </div>
              <div style={{ height: '5px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${barWidth}%`,
                  background: severity, borderRadius: '3px',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3. Tire Degradation Chart ────────────────────────────────────────────────

interface TireDegradationChartProps {
  laps: LapSummary[];
}

export function TireDegradationChart({ laps }: TireDegradationChartProps) {
  const lang = useLangStore((s) => s.lang);
  const t = useT(lang);

  // Use fuel values as a proxy for stint progress / tire wear
  // fuelStart decreases over laps — normalize to show degradation progression
  const data = useMemo(() => {
    const valid = laps.filter((l) => l.lapTime > 0 && l.fuelStart > 0);
    if (valid.length < 2) return null;

    // Calculate "wear proxy": as fuel decreases, tires degrade.
    // Normalize fuelStart so first lap = 0% wear, last lap = max wear
    const maxFuel = valid[0].fuelStart;
    const minFuel = valid[valid.length - 1].fuelStart;
    const fuelRange = maxFuel - minFuel;

    if (fuelRange <= 0) return null;

    return valid.map((l) => ({
      lap: l.lap,
      wearPct: ((maxFuel - l.fuelStart) / fuelRange) * 100,
      lapTime: l.lapTime,
      // Combine lap time degradation as secondary indicator
      timeDelta: l.lapTime - Math.min(...valid.map((v) => v.lapTime)),
    }));
  }, [laps]);

  if (!data || data.length < 2) return null;

  const height = 120;
  const pad = { top: 16, bottom: 24, left: 8, right: 8 };
  const chartW = Math.max(data.length * 32 + pad.left + pad.right, 300);
  const chartH = height - pad.top - pad.bottom;

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * (chartW - pad.left - pad.right);
  const toYWear = (pct: number) => pad.top + (1 - pct / 100) * chartH;
  const toYTime = (delta: number) => {
    const maxDelta = Math.max(...data.map((d) => d.timeDelta), 0.001);
    return pad.top + (1 - delta / maxDelta) * chartH;
  };

  const wearPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toYWear(d.wearPct)}`).join(' ');
  const wearArea = `${wearPath} L ${toX(data.length - 1)} ${height - pad.bottom} L ${toX(0)} ${height - pad.bottom} Z`;

  const timePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toYTime(d.timeDelta)}`).join(' ');

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
        🛞 {t.tireDeg}
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${chartW} ${height}`}
          style={{ width: '100%', minWidth: `${Math.min(chartW, 450)}px`, height: `${height}px` }}
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={pad.left} y1={pad.top + f * chartH}
              x2={chartW - pad.right} y2={pad.top + f * chartH}
              stroke="var(--border)" strokeWidth="0.4" strokeDasharray="3 3"
            />
          ))}

          {/* Wear area fill */}
          <path d={wearArea} fill="#f59e0b" opacity="0.1" />

          {/* Wear line */}
          <path d={wearPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" />

          {/* Lap time delta line (secondary) */}
          <path d={timePath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" opacity="0.6" />

          {/* Data points */}
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toYWear(d.wearPct)} r="3"
                fill="var(--bg-secondary)" stroke="#f59e0b" strokeWidth="1.5" />
              <text
                x={toX(i)} y={height - 4}
                textAnchor="middle" fontSize="7" fill="var(--text-muted)"
              >
                {d.lap}
              </text>
            </g>
          ))}

          {/* Y-axis labels */}
          <text x={pad.left + 2} y={pad.top + 3} fontSize="7" fill="#f59e0b" fontWeight="600">100%</text>
          <text x={pad.left + 2} y={height - pad.bottom - 2} fontSize="7" fill="#f59e0b" fontWeight="600">0%</text>
        </svg>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '9px', color: 'var(--text-muted)' }}>
        <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>━</span> {t.wear} (fuel proxy)</span>
        <span><span style={{ color: '#ef4444', fontWeight: 700 }}>╌</span> {lang === 'es' ? 'Δ Tiempo' : 'Δ Time'}</span>
      </div>
    </div>
  );
}

// ─── 4. Export CSV Button ─────────────────────────────────────────────────────

interface ExportCSVButtonProps {
  laps: LapSummary[];
  sessionInfo: SessionInfo;
}

export function ExportCSVButton({ laps, sessionInfo }: ExportCSVButtonProps) {
  const lang = useLangStore((s) => s.lang);
  const t = useT(lang);

  const handleExport = () => {
    if (!laps.length) return;

    const headers = [
      'Lap', 'LapTime', 'MaxSpeed', 'AvgSpeed', 'MinSpeed',
      'FuelStart', 'FuelEnd', 'FuelUsed', 'Samples',
      'OffTracks', 'MaxGLat', 'MaxGLon', 'MaxBrake', 'Incidents',
    ];

    const rows = laps.map((l) => [
      l.lap, l.lapTime.toFixed(3), l.maxSpeed.toFixed(1), l.avgSpeed.toFixed(1), l.minSpeed.toFixed(1),
      l.fuelStart.toFixed(2), l.fuelEnd.toFixed(2), l.fuelUsed.toFixed(2), l.samples,
      l.offTracks, l.maxGLat.toFixed(3), l.maxGLon.toFixed(3), l.maxBrake.toFixed(3), l.incidents,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const fileName = `${sessionInfo.driver || 'session'}_${sessionInfo.track || 'track'}_${new Date(sessionInfo.startTime).toISOString().slice(0, 10)}.csv`;
    link.download = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      style={{
        background: 'var(--bg-tertiary)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '8px 14px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
    >
      📥 {t.exportCsv}
    </button>
  );
}
