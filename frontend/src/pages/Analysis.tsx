/**
 * ApexVision AI — Session Analysis Page
 * Permite cargar y revisar sesiones grabadas por iracing_live.py:
 * - Resumen de sesión (piloto, auto, pista, clima)
 * - Tiempos por vuelta con gráfico de evolución
 * - Velocidades máximas, fuel, off-tracks
 * - Eventos con recomendaciones IA
 * - Comparación entre vueltas
 */

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLangStore } from '../store/lang-store';
import { listSessions, loadSession, SessionListItem } from '../utils/s3-sessions';

interface SessionInfo {
  startTime: string;
  driver: string;
  iRating: number;
  license: string;
  car: string;
  carNumber: string;
  track: string;
  trackConfig: string;
  trackLength: string;
  sessionName: string;
  airTemp: number;
  trackTemp: number;
}

interface LapSummary {
  lap: number;
  lapTime: number;
  maxSpeed: number;
  avgSpeed: number;
  minSpeed: number;
  fuelStart: number;
  fuelEnd: number;
  fuelUsed: number;
  samples: number;
  offTracks: number;
  maxGLat: number;
  maxGLon: number;
  maxBrake: number;
  incidents: number;
}

interface SessionEvent {
  type: string;
  timestamp: number;
  message: string;
  lap?: number;
  trackPct?: number;
  speed?: number;
}

interface LoadedSession {
  info: SessionInfo;
  laps: LapSummary[];
  events: SessionEvent[];
}

const fmt = (t: number) => {
  if (t <= 0) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
};

function AnalysisTranslations() {
  const lang = useLangStore((s) => s.lang);
  return lang === 'es' ? {
    title: 'Análisis de Sesión',
    loadSession: 'Cargar Sesión',
    instructions: 'Carga los archivos de una sesión grabada para analizar la telemetría.',
    step1: '1. Selecciona session_info.json',
    step2: '2. Selecciona lap_summaries.json',
    step3: '3. Opcionalmente, selecciona events.jsonl',
    overview: 'Resumen',
    driver: 'Piloto', car: 'Auto', track: 'Circuito', session: 'Sesión',
    date: 'Fecha', temp: 'Temperatura', laps: 'Vueltas',
    lapTimes: 'Tiempos por Vuelta', lap: 'Vuelta', time: 'Tiempo',
    maxSpeed: 'Vel. Máx', avgSpeed: 'Vel. Prom', fuel: 'Combustible',
    fuelUsed: 'Usado', offTracks: 'Salidas', incidents: 'Incidentes',
    gforce: 'G Máx', evolution: 'Evolución de Tiempos',
    bestLap: 'Mejor Vuelta', avgLap: 'Promedio', consistency: 'Consistencia',
    events: 'Eventos e IA', noEvents: 'Sin eventos registrados',
    back: '← Volver al Dashboard',
    aiRecommendations: 'Recomendaciones IA',
    performance: 'Performance',
  } : {
    title: 'Session Analysis',
    loadSession: 'Load Session',
    instructions: 'Load recorded session files to analyze telemetry.',
    step1: '1. Select session_info.json',
    step2: '2. Select lap_summaries.json',
    step3: '3. Optionally, select events.jsonl',
    overview: 'Overview',
    driver: 'Driver', car: 'Car', track: 'Track', session: 'Session',
    date: 'Date', temp: 'Temperature', laps: 'Laps',
    lapTimes: 'Lap Times', lap: 'Lap', time: 'Time',
    maxSpeed: 'Max Speed', avgSpeed: 'Avg Speed', fuel: 'Fuel',
    fuelUsed: 'Used', offTracks: 'Off Tracks', incidents: 'Incidents',
    gforce: 'Max G', evolution: 'Time Evolution',
    bestLap: 'Best Lap', avgLap: 'Average', consistency: 'Consistency',
    events: 'Events & AI', noEvents: 'No events recorded',
    back: '← Back to Dashboard',
    aiRecommendations: 'AI Recommendations',
    performance: 'Performance',
  };
}

export function Analysis() {
  const t = AnalysisTranslations();
  const [session, setSession] = useState<LoadedSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [s3Sessions, setS3Sessions] = useState<SessionListItem[]>([]);
  const [s3Loading, setS3Loading] = useState(true);
  const [s3Error, setS3Error] = useState(false);

  // Try to load sessions from S3 on mount
  useEffect(() => {
    async function fetchSessions() {
      try {
        const sessions = await listSessions();
        setS3Sessions(sessions);
        setS3Error(false);
      } catch {
        setS3Error(true);
      } finally {
        setS3Loading(false);
      }
    }
    fetchSessions();
  }, []);

  const handleLoadFromS3 = async (s3Session: SessionListItem) => {
    setLoading(true);
    try {
      const data = await loadSession(s3Session);
      if (data.info) {
        setSession({ info: data.info, laps: data.laps, events: data.events });
      }
    } catch (err) {
      console.error('Error loading session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setLoading(true);

    let info: SessionInfo | null = null;
    let laps: LapSummary[] = [];
    let events: SessionEvent[] = [];

    for (const file of Array.from(files)) {
      const text = await file.text();
      if (file.name === 'session_info.json') {
        info = JSON.parse(text);
      } else if (file.name === 'lap_summaries.json') {
        laps = JSON.parse(text);
      } else if (file.name === 'events.jsonl') {
        events = text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
      }
    }

    if (info) {
      setSession({ info, laps, events });
    }
    setLoading(false);
  };

  const stats = useMemo(() => {
    if (!session || session.laps.length === 0) return null;
    const validLaps = session.laps.filter((l) => l.lapTime > 0);
    if (validLaps.length === 0) return null;

    const times = validLaps.map((l) => l.lapTime);
    const best = Math.min(...times);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(times.reduce((sum, t) => sum + (t - avg) ** 2, 0) / times.length);
    const consistency = ((1 - stdDev / avg) * 100);
    const totalFuel = session.laps.reduce((sum, l) => sum + l.fuelUsed, 0);
    const totalOffTracks = session.laps.reduce((sum, l) => sum + l.offTracks, 0);
    const maxSpeedSession = Math.max(...session.laps.map((l) => l.maxSpeed));

    return { best, avg, stdDev, consistency, totalFuel, totalOffTracks, maxSpeedSession, validLaps: validLaps.length };
  }, [session]);

  if (!session) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t.title}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>{t.instructions}</p>
          </div>

          {/* S3 Sessions */}
          {!s3Loading && s3Sessions.length > 0 && (
            <div className="card p-6 mb-6">
              <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                {t.loadSession} (S3)
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {s3Sessions.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => handleLoadFromS3(s)}
                    disabled={loading}
                    className="w-full text-left p-3 rounded-lg border transition hover:border-[var(--accent)]"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-tertiary)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {s.track || s.name}
                        </span>
                        {s.driver && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>· {s.driver}</span>}
                        {s.car && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>· {s.car}</span>}
                        {s.date && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>· {new Date(s.date).toLocaleDateString()}</span>}
                        {s.sessionName && <span className="text-xs ml-2 font-bold" style={{ color: 'var(--warning)' }}>{s.sessionName}</span>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        {s.source === 'local' ? '📁' : '☁️'} →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {s3Loading && (
            <div className="card p-6 mb-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading sessions from S3...</p>
            </div>
          )}

          {/* Manual file upload fallback */}
          <div className="card p-6">
            <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {s3Error || s3Sessions.length === 0 ? t.loadSession : `${t.loadSession} (manual)`}
            </h2>
            <div className="space-y-2 text-left text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              <p>{t.step1}</p>
              <p>{t.step2}</p>
              <p>{t.step3}</p>
            </div>
            <label className="block">
              <input
                type="file"
                multiple
                accept=".json,.jsonl"
                onChange={handleLoadFiles}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              />
            </label>
            {loading && <p className="mt-4 text-sm" style={{ color: 'var(--accent)' }}>Loading...</p>}
          </div>

          <div className="mt-6 text-center">
            <Link to="/dashboard" className="text-sm" style={{ color: 'var(--accent)' }}>{t.back}</Link>
          </div>
        </div>
      </div>
    );
  }

  const { info, laps, events } = session;
  const aiEvents = events.filter((e) => e.type === 'ai_recommendation' || e.message?.includes('🤖'));
  const trackEvents = events.filter((e) => e.type === 'off_track');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="border-b px-6 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t.title}</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {info.driver} · {info.car} · {info.track}{info.trackConfig ? ` (${info.trackConfig})` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm px-3 py-1.5 rounded cursor-pointer" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {t.loadSession}
              <input type="file" multiple accept=".json,.jsonl" onChange={handleLoadFiles} className="hidden" />
            </label>
            <Link to="/dashboard" className="text-sm" style={{ color: 'var(--accent)' }}>{t.back}</Link>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="card p-4">
            <div className="label">{t.date}</div>
            <div className="text-sm font-bold mt-1">{new Date(info.startTime).toLocaleDateString()}</div>
          </div>
          <div className="card p-4">
            <div className="label">{t.session}</div>
            <div className="text-sm font-bold mt-1">{info.sessionName || '---'}</div>
          </div>
          <div className="card p-4">
            <div className="label">{t.laps}</div>
            <div className="text-sm font-bold mt-1">{stats?.validLaps || 0}</div>
          </div>
          <div className="card p-4">
            <div className="label">{t.bestLap}</div>
            <div className="text-sm font-bold mt-1 font-mono" style={{ color: 'var(--purple)' }}>{stats ? fmt(stats.best) : '--'}</div>
          </div>
          <div className="card p-4">
            <div className="label">{t.consistency}</div>
            <div className="text-sm font-bold mt-1">{stats ? `${stats.consistency.toFixed(1)}%` : '--'}</div>
          </div>
          <div className="card p-4">
            <div className="label">{t.maxSpeed}</div>
            <div className="text-sm font-bold mt-1 font-mono">{stats ? `${stats.maxSpeedSession.toFixed(0)} km/h` : '--'}</div>
          </div>
        </div>

        {/* Lap time evolution chart */}
        {laps.length > 0 && (
          <div className="card p-5">
            <h2 className="font-bold mb-4">{t.evolution}</h2>
            <div className="h-48 relative">
              <svg viewBox={`0 0 ${laps.length * 40 + 20} 200`} className="w-full h-full" preserveAspectRatio="none">
                {/* Grid lines */}
                {stats && (() => {
                  const validLaps = laps.filter((l) => l.lapTime > 0);
                  if (validLaps.length === 0) return null;
                  const times = validLaps.map((l) => l.lapTime);
                  const min = Math.min(...times);
                  const max = Math.max(...times);
                  const range = max - min || 1;
                  const toY = (t: number) => 180 - ((t - min) / range) * 160;

                  // Average line
                  const avgY = toY(stats.avg);

                  return (
                    <>
                      <line x1="10" y1={avgY} x2={validLaps.length * 40 + 10} y2={avgY} stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="4 2" opacity="0.5" />
                      {validLaps.map((l, i) => {
                        const x = i * 40 + 20;
                        const y = toY(l.lapTime);
                        const isBest = l.lapTime === stats.best;
                        return (
                          <g key={l.lap}>
                            {i > 0 && (
                              <line
                                x1={(i - 1) * 40 + 20}
                                y1={toY(validLaps[i - 1].lapTime)}
                                x2={x} y2={y}
                                stroke="var(--accent)" strokeWidth="1.5"
                              />
                            )}
                            <circle cx={x} cy={y} r={isBest ? 5 : 3}
                              fill={isBest ? 'var(--purple)' : 'var(--accent)'}
                              stroke={isBest ? 'var(--purple)' : 'none'} strokeWidth="2"
                            />
                            <text x={x} y="198" textAnchor="middle" fontSize="8" fill="var(--text-muted)">L{l.lap}</text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* Lap details table */}
        <div className="card p-5 overflow-x-auto">
          <h2 className="font-bold mb-4">{t.lapTimes}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="text-left py-2 px-2">{t.lap}</th>
                <th className="text-left py-2 px-2">{t.time}</th>
                <th className="text-right py-2 px-2">{t.maxSpeed}</th>
                <th className="text-right py-2 px-2">{t.avgSpeed}</th>
                <th className="text-right py-2 px-2">{t.fuelUsed}</th>
                <th className="text-right py-2 px-2">{t.offTracks}</th>
                <th className="text-right py-2 px-2">{t.gforce}</th>
              </tr>
            </thead>
            <tbody>
              {laps.filter((l) => l.lapTime > 0).map((l) => {
                const isBest = stats && l.lapTime === stats.best;
                return (
                  <tr key={l.lap} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 px-2 font-bold">{l.lap}</td>
                    <td className="py-2 px-2 font-mono" style={{ color: isBest ? 'var(--purple)' : 'inherit', fontWeight: isBest ? 700 : 400 }}>{fmt(l.lapTime)}</td>
                    <td className="py-2 px-2 text-right font-mono">{l.maxSpeed.toFixed(0)}</td>
                    <td className="py-2 px-2 text-right font-mono">{l.avgSpeed.toFixed(0)}</td>
                    <td className="py-2 px-2 text-right font-mono">{l.fuelUsed.toFixed(1)}%</td>
                    <td className="py-2 px-2 text-right" style={{ color: l.offTracks > 0 ? 'var(--danger)' : 'inherit' }}>{l.offTracks}</td>
                    <td className="py-2 px-2 text-right font-mono">{l.maxGLat.toFixed(1)}g</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Events & AI Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Recommendations */}
          <div className="card p-5">
            <h2 className="font-bold mb-4">{t.aiRecommendations} ({aiEvents.length})</h2>
            {aiEvents.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.noEvents}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {aiEvents.map((evt, i) => (
                  <div key={i} className="text-sm p-2 rounded" style={{ background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent)' }}>
                    <div className="flex justify-between">
                      <span>{evt.message}</span>
                      {evt.lap && <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>L{evt.lap}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Track Events (off-track, incidents) */}
          <div className="card p-5">
            <h2 className="font-bold mb-4">{t.events} ({trackEvents.length})</h2>
            {trackEvents.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.noEvents}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {trackEvents.map((evt, i) => (
                  <div key={i} className="text-sm p-2 rounded flex items-center gap-2" style={{ background: 'var(--danger-soft)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--danger)' }} />
                    <span>{evt.message}</span>
                    {evt.speed && <span className="text-xs font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>{evt.speed.toFixed(0)} km/h</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Performance Summary */}
        {stats && (
          <div className="card p-5">
            <h2 className="font-bold mb-4">{t.performance}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="label">{t.bestLap}</div>
                <div className="font-mono font-bold text-lg mt-1" style={{ color: 'var(--purple)' }}>{fmt(stats.best)}</div>
              </div>
              <div>
                <div className="label">{t.avgLap}</div>
                <div className="font-mono font-bold text-lg mt-1">{fmt(stats.avg)}</div>
              </div>
              <div>
                <div className="label">{t.consistency}</div>
                <div className="font-bold text-lg mt-1" style={{ color: stats.consistency > 95 ? 'var(--success)' : stats.consistency > 90 ? 'var(--warning)' : 'var(--danger)' }}>
                  {stats.consistency.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="label">{t.fuel} total</div>
                <div className="font-mono font-bold text-lg mt-1">{stats.totalFuel.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
