/**
 * ApexVision AI — Session Analysis v3
 * Visual AI engineer analysis, structured insights, lap comparison with charts
 */

import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLangStore } from '../store/lang-store';
import { listSessions, loadSession, SessionListItem } from '../utils/s3-sessions';
import { fmtLapTime as fmt } from '../utils/format';
import { DEMO_SESSION_INFO, DEMO_LAP_SUMMARIES, DEMO_EVENTS } from '../data/demo-session';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface AIInsight {
  id: string;
  category: 'consistency' | 'pace' | 'fuel' | 'gforce' | 'incidents' | 'recommendation';
  severity: 'excellent' | 'good' | 'warning' | 'critical';
  icon: string;
  title: string;
  body: string;
  metric?: string;
  metricSub?: string;
  barPct?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<AIInsight['severity'], string> = {
  excellent: '#22c55e', good: '#0ea5e9', warning: '#f59e0b', critical: '#ef4444',
};

const CAT_ICON: Record<AIInsight['category'], string> = {
  consistency: '📊', pace: '⏱', fuel: '⛽', gforce: '📐', incidents: '⚠️', recommendation: '🎯',
};

// ─── Translations ─────────────────────────────────────────────────────────────

function useT(lang: string) {
  return lang === 'es' ? {
    title: 'Análisis de Sesión', loadSession: 'Cargar Sesión',
    instructions: 'Carga los archivos de una sesión grabada para analizar la telemetría.',
    step1: '📄 session_info.json — datos del circuito y piloto', step2: '📊 lap_summaries.json — resumen de cada vuelta',
    step3: '📋 events.jsonl — eventos de la sesión (opcional)',
    overview: 'Resumen', driver: 'Piloto', car: 'Auto', track: 'Circuito', session: 'Sesión',
    date: 'Fecha', laps: 'Vueltas', lapTimes: 'Tiempos por Vuelta', lap: 'Vuelta', time: 'Tiempo',
    maxSpeed: 'Vel. Máx', avgSpeed: 'Vel. Prom', fuelUsed: 'Cons./V', offTracks: 'Salidas',
    gforce: 'G Máx', evolution: 'Evolución de Tiempos', speedTrend: 'Velocidad Promedio',
    fuelTrend: 'Consumo por Vuelta', gTrend: 'G Lateral Máx',
    bestLap: 'Mejor Vuelta', avgLap: 'Promedio', consistency: 'Consistencia',
    events: 'Eventos', noEvents: 'Sin eventos registrados',
    back: '← Volver', aiAnalysis: 'Análisis IA — Ingeniero de Carrera',
    comparison: 'Comparación de Vueltas', lapA: 'Vuelta A', lapB: 'Vuelta B',
    selectLap: 'Seleccionar...', performance: 'Rendimiento',
    aiRecommendations: 'Recomendaciones IA', loading: 'Cargando...', fuel: 'Combustible',
    eventsMap: 'Mapa de Eventos en Pista',
  } : {
    title: 'Session Analysis', loadSession: 'Load Session',
    instructions: 'Load recorded session files to analyze telemetry.',
    step1: '📄 session_info.json — circuit and driver data', step2: '📊 lap_summaries.json — per-lap summary',
    step3: '📋 events.jsonl — session events (optional)',
    overview: 'Overview', driver: 'Driver', car: 'Car', track: 'Track', session: 'Session',
    date: 'Date', laps: 'Laps', lapTimes: 'Lap Times', lap: 'Lap', time: 'Time',
    maxSpeed: 'Max Speed', avgSpeed: 'Avg Speed', fuelUsed: 'Cons./Lap', offTracks: 'Off Trk',
    gforce: 'Max G', evolution: 'Time Evolution', speedTrend: 'Average Speed',
    fuelTrend: 'Fuel per Lap', gTrend: 'Peak Lateral G',
    bestLap: 'Best Lap', avgLap: 'Average', consistency: 'Consistency',
    events: 'Events', noEvents: 'No events recorded',
    back: '← Back', aiAnalysis: 'AI Analysis — Race Engineer',
    comparison: 'Lap Comparison', lapA: 'Lap A', lapB: 'Lap B',
    selectLap: 'Select...', performance: 'Performance',
    aiRecommendations: 'AI Recommendations', loading: 'Loading...', fuel: 'Fuel',
    eventsMap: 'Track Events Map',
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function computeStats(laps: LapSummary[]) {
  const v = laps.filter((l) => l.lapTime > 0);
  if (!v.length) return null;
  const times = v.map((l) => l.lapTime);
  const best = Math.min(...times);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const stdDev = Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length);
  const consistency = (1 - stdDev / avg) * 100;
  const totalFuel = laps.reduce((s, l) => s + l.fuelUsed, 0);
  const totalOffTracks = laps.reduce((s, l) => s + l.offTracks, 0);
  const maxSpeedSession = Math.max(...v.map((l) => l.maxSpeed));
  return { best, avg, stdDev, consistency, totalFuel, totalOffTracks, maxSpeedSession, validLaps: v.length };
}

// ─── AI Engine ───────────────────────────────────────────────────────────────

function computeAIInsights(laps: LapSummary[], stats: ReturnType<typeof computeStats>, es: boolean): AIInsight[] {
  if (!stats) return [];
  const v = laps.filter((l) => l.lapTime > 0);
  if (v.length < 2) return [];
  const insights: AIInsight[] = [];

  // 1. Consistency
  const consPct = Math.max(0, Math.min(100, stats.consistency));
  insights.push({
    id: 'consistency',
    category: 'consistency',
    severity: consPct >= 97 ? 'excellent' : consPct >= 93 ? 'good' : consPct >= 88 ? 'warning' : 'critical',
    icon: CAT_ICON.consistency,
    title: consPct >= 97
      ? (es ? 'Consistencia excepcional' : 'Exceptional Consistency')
      : consPct >= 93
        ? (es ? 'Consistencia sólida' : 'Solid Consistency')
        : (es ? 'Consistencia a mejorar' : 'Consistency Needs Work'),
    body: consPct >= 97
      ? (es ? `Desviación estándar de solo ${stats.stdDev.toFixed(2)}s. Ritmo muy repetible — base ideal para optimizar el setup.` : `Std dev of only ${stats.stdDev.toFixed(2)}s. Very repeatable pace — ideal base for setup tuning.`)
      : consPct >= 93
        ? (es ? `Desviación de ${stats.stdDev.toFixed(2)}s. Trabajo en usar las mismas referencias de frenada cada vuelta.` : `${stats.stdDev.toFixed(2)}s deviation. Work on using the same braking references each lap.`)
        : (es ? `Alta variación (${stats.stdDev.toFixed(2)}s). Revisar línea de curva, puntos de frenada y aplicación de gas.` : `High variation (${stats.stdDev.toFixed(2)}s). Review corner line, braking points, and throttle application.`),
    metric: `${consPct.toFixed(1)}%`,
    metricSub: es ? 'consistencia' : 'consistency',
    barPct: consPct,
  });

  // 2. Pace trend
  if (v.length >= 4) {
    const half = Math.floor(v.length / 2);
    const avgFirst = v.slice(0, half).reduce((a, b) => a + b.lapTime, 0) / half;
    const avgSecond = v.slice(half).reduce((a, b) => a + b.lapTime, 0) / (v.length - half);
    const fade = avgSecond - avgFirst;
    insights.push({
      id: 'pace',
      category: 'pace',
      severity: fade > 2 ? 'critical' : fade > 0.8 ? 'warning' : fade < -0.5 ? 'excellent' : 'good',
      icon: CAT_ICON.pace,
      title: fade > 1.5
        ? (es ? 'Degradación de ritmo severa' : 'Severe Pace Degradation')
        : fade > 0.5
          ? (es ? 'Caída de ritmo moderada' : 'Moderate Pace Drop')
          : fade < -0.5
            ? (es ? 'Ritmo mejorando' : 'Improving Pace')
            : (es ? 'Ritmo estable' : 'Stable Pace'),
      body: fade > 0
        ? (es ? `Las últimas ${v.length - half} vueltas son ${fade.toFixed(2)}s más lentas que las primeras ${half}. Probable desgaste de neumáticos o pérdida de carga.` : `Last ${v.length - half} laps are ${fade.toFixed(2)}s slower than first ${half}. Likely tire wear or grip loss.`)
        : (es ? `El ritmo mejoró ${Math.abs(fade).toFixed(2)}s en la segunda mitad — buena progresión de calentamiento o condiciones favorables.` : `Pace improved ${Math.abs(fade).toFixed(2)}s in the second half — good warmup or favorable conditions.`),
      metric: `${fade > 0 ? '+' : ''}${fade.toFixed(2)}s`,
      metricSub: es ? 'primera → segunda mitad' : 'first → second half',
    });
  }

  // 3. Best lap
  const bestLap = v.find((l) => l.lapTime === stats.best);
  if (bestLap) {
    const gapToAvg = stats.avg - stats.best;
    insights.push({
      id: 'bestlap',
      category: 'pace',
      severity: gapToAvg < 0.5 ? 'excellent' : gapToAvg < 1.5 ? 'good' : 'warning',
      icon: '⭐',
      title: es ? `Mejor vuelta — V${bestLap.lap}` : `Best Lap — L${bestLap.lap}`,
      body: es
        ? `${fmt(stats.best)} con velocidad máxima de ${bestLap.maxSpeed.toFixed(0)} km/h. ${gapToAvg.toFixed(2)}s por debajo del promedio. ${gapToAvg > 1 ? 'Hay potencial para acercar el promedio a ese nivel.' : 'El ritmo está bien consolidado.'}`
        : `${fmt(stats.best)} with ${bestLap.maxSpeed.toFixed(0)} km/h top speed. ${gapToAvg.toFixed(2)}s below average. ${gapToAvg > 1 ? 'There\'s potential to bring the average closer.' : 'Pace is well consolidated.'}`,
      metric: fmt(stats.best),
      metricSub: `V${bestLap.lap} · ${bestLap.maxSpeed.toFixed(0)} km/h`,
    });
  }

  // 4. Outliers
  const outliers = v.filter((l) => l.lapTime > stats.avg + 1.8 * stats.stdDev);
  if (outliers.length > 0) {
    insights.push({
      id: 'outliers',
      category: 'incidents',
      severity: outliers.length >= 3 ? 'critical' : 'warning',
      icon: CAT_ICON.incidents,
      title: es ? `${outliers.length} vuelta(s) anómala(s)` : `${outliers.length} Anomalous Lap(s)`,
      body: es
        ? `V${outliers.map((l) => l.lap).join(', V')} son ${((outliers[0].lapTime - stats.avg) / stats.avg * 100).toFixed(1)}%+ más lentas que el promedio. Posibles banderas, incidentes o tráfico. Excluirlas para evaluar ritmo puro.`
        : `L${outliers.map((l) => l.lap).join(', L')} are ${((outliers[0].lapTime - stats.avg) / stats.avg * 100).toFixed(1)}%+ slower than average. Possible flags, incidents or traffic. Exclude for pure pace analysis.`,
      metric: String(outliers.length),
      metricSub: es ? 'vueltas fuera de rango' : 'laps out of range',
    });
  }

  // 5. Fuel
  const fuelLaps = v.filter((l) => l.fuelUsed > 0);
  if (fuelLaps.length >= 3) {
    const avgFuel = fuelLaps.reduce((a, b) => a + b.fuelUsed, 0) / fuelLaps.length;
    const fuelDev = Math.sqrt(fuelLaps.reduce((s, l) => s + (l.fuelUsed - avgFuel) ** 2, 0) / fuelLaps.length);
    insights.push({
      id: 'fuel',
      category: 'fuel',
      severity: fuelDev > 0.5 ? 'warning' : 'good',
      icon: CAT_ICON.fuel,
      title: fuelDev > 0.5
        ? (es ? 'Consumo de combustible variable' : 'Variable Fuel Consumption')
        : (es ? 'Consumo de combustible estable' : 'Stable Fuel Consumption'),
      body: es
        ? `Promedio ${avgFuel.toFixed(2)}% por vuelta (±${fuelDev.toFixed(2)}%). ${fuelDev > 0.5 ? 'Variación alta — revisar agresividad en aceleración y frenada.' : 'Muy regular — buena base para calcular estrategia de pit.'}`
        : `Average ${avgFuel.toFixed(2)}% per lap (±${fuelDev.toFixed(2)}%). ${fuelDev > 0.5 ? 'High variation — check throttle and braking aggression.' : 'Very consistent — solid base for pit strategy calculation.'}`,
      metric: `${avgFuel.toFixed(2)}%`,
      metricSub: es ? 'por vuelta' : 'per lap',
    });
  }

  // 6. G-force
  const maxGLap = v.reduce((mx, l) => l.maxGLat > mx.maxGLat ? l : mx, v[0]);
  const avgGLat = v.reduce((s, l) => s + l.maxGLat, 0) / v.length;
  if (maxGLap.maxGLat > 1) {
    insights.push({
      id: 'gforce',
      category: 'gforce',
      severity: maxGLap.maxGLat > 4 ? 'excellent' : maxGLap.maxGLat > 2.5 ? 'good' : 'warning',
      icon: CAT_ICON.gforce,
      title: es ? `G lateral pico: ${maxGLap.maxGLat.toFixed(1)}g en V${maxGLap.lap}` : `Peak Lateral G: ${maxGLap.maxGLat.toFixed(1)}g on L${maxGLap.lap}`,
      body: es
        ? `Promedio de ${avgGLat.toFixed(2)}g en el stint. ${maxGLap.maxGLat > 3.5 ? 'Alta carga en curvas rápidas — buena velocidad de paso y adherencia.' : 'Velocidad de curva moderada — hay margen para incrementar la carga lateral.  '}`
        : `Average ${avgGLat.toFixed(2)}g across the stint. ${maxGLap.maxGLat > 3.5 ? 'High cornering load — good corner speed and grip.' : 'Moderate corner speed — room to increase lateral load.'}`,
      metric: `${maxGLap.maxGLat.toFixed(1)}g`,
      metricSub: `avg ${avgGLat.toFixed(2)}g`,
      barPct: Math.min(100, maxGLap.maxGLat / 5 * 100),
    });
  }

  // 7. Off-tracks
  const totalOff = v.reduce((s, l) => s + l.offTracks, 0);
  if (totalOff > 0) {
    const worstOff = v.reduce((mx, l) => l.offTracks > mx.offTracks ? l : mx, v[0]);
    insights.push({
      id: 'offtracks',
      category: 'incidents',
      severity: totalOff >= 5 ? 'critical' : totalOff >= 2 ? 'warning' : 'good',
      icon: '🔴',
      title: es ? `${totalOff} salida(s) de pista` : `${totalOff} Off-Track(s)`,
      body: es
        ? `Mayor incidencia en V${worstOff.lap} (${worstOff.offTracks}x). Revisar el input de frenada y la línea en esa vuelta para identificar la zona problemática.`
        : `Worst on L${worstOff.lap} (${worstOff.offTracks}x). Review braking input and line on that lap to identify the problematic zone.`,
      metric: String(totalOff),
      metricSub: es ? 'incidentes totales' : 'total incidents',
    });
  } else {
    insights.push({
      id: 'clean',
      category: 'incidents',
      severity: 'excellent',
      icon: '✅',
      title: es ? 'Stint limpio — sin salidas de pista' : 'Clean Stint — No Off-Tracks',
      body: es ? 'Excelente control del auto durante todo el stint. Las decisiones de frenada y línea fueron consistentes y seguras.' : 'Excellent car control throughout the stint. Braking and line decisions were consistent and safe.',
    });
  }

  // 8. Main recommendation
  let recTitle = '', recBody = '';
  if (stats.consistency < 93) {
    recTitle = es ? 'Foco en repetibilidad' : 'Focus on Repeatability';
    recBody = es
      ? `Con una desviación de ${stats.stdDev.toFixed(2)}s entre vueltas, el área de mayor ganancia es la repetibilidad. Elige tres marcas visuales fijas por curva (entrada, apex, salida) y apégate a ellas.`
      : `With ${stats.stdDev.toFixed(2)}s lap-to-lap deviation, the biggest gain is repeatability. Pick three fixed visual markers per corner (entry, apex, exit) and commit to them.`;
  } else if (stats.best < stats.avg - 1.5) {
    recTitle = es ? 'Llevar el ritmo punta al promedio' : 'Bring Peak Pace to Average';
    recBody = es
      ? `Hay ${(stats.avg - stats.best).toFixed(2)}s entre la mejor vuelta y el promedio. Analizar en qué sectores se pierde ese tiempo en las vueltas regulares vs. la mejor.`
      : `There's ${(stats.avg - stats.best).toFixed(2)}s between best lap and average. Analyze which sectors lose that time in regular laps vs the best.`;
  } else {
    recTitle = es ? 'Perfil sólido — afinar detalles' : 'Solid Profile — Fine-tune Details';
    recBody = es
      ? 'El perfil general del stint es bueno. El siguiente nivel es analizar micro-sectores específicos para identificar las últimas décimas de ganancia en las curvas más lentas.'
      : 'The overall stint profile is good. Next level is analyzing specific micro-sectors to find the last tenths in the slowest corners.';
  }
  insights.push({
    id: 'recommendation',
    category: 'recommendation',
    severity: 'good',
    icon: CAT_ICON.recommendation,
    title: recTitle,
    body: recBody,
  });

  return insights;
}

// ─── AI Insight Card ──────────────────────────────────────────────────────────

function AIInsightCard({ insight }: { insight: AIInsight }) {
  const color = SEV_COLOR[insight.severity];
  return (
    <div style={{
      background: `${color}0d`,
      border: `1px solid ${color}30`,
      borderLeft: `4px solid ${color}`,
      borderRadius: '10px',
      padding: '14px 16px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: '22px', flexShrink: 0, lineHeight: 1 }}>{insight.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
          <div>
            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color, display: 'block', marginBottom: '2px' }}>
              {insight.category}
            </span>
            <p style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{insight.title}</p>
          </div>
          {insight.metric && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '20px', color, lineHeight: 1 }}>{insight.metric}</div>
              {insight.metricSub && <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{insight.metricSub}</div>}
            </div>
          )}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{insight.body}</p>
        {insight.barPct !== undefined && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${insight.barPct}%`, background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>0</span>
              <span style={{ fontSize: '9px', color }}>◆ {insight.barPct.toFixed(0)}%</span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>100</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Visual Lap Comparison ────────────────────────────────────────────────────

function CompareBar({ label, valA, valB, unitA = '', unitB = '', higherIsBetter = true }: {
  label: string; valA: number; valB: number; unitA?: string; unitB?: string; higherIsBetter?: boolean;
}) {
  const max = Math.max(valA, valB, 0.001);
  const pctA = (valA / max) * 100;
  const pctB = (valB / max) * 100;
  const aWins = higherIsBetter ? valA >= valB : valA <= valB;
  const colorA = aWins ? '#0ea5e9' : 'rgba(255,255,255,0.15)';
  const colorB = !aWins ? '#a855f7' : 'rgba(255,255,255,0.15)';
  const delta = valB - valA;

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: delta === 0 ? 'var(--text-muted)' : delta > 0 === higherIsBetter ? '#a855f7' : '#0ea5e9' }}>
          {delta > 0 ? '+' : ''}{unitA === 's' ? delta.toFixed(3) : delta.toFixed(1)}{unitB || unitA}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '9px', color: '#0ea5e9', width: '12px', fontWeight: 700, flexShrink: 0 }}>A</span>
          <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctA}%`, background: colorA, borderRadius: '4px', transition: 'width 0.5s ease' }} />
          </div>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: aWins ? '#0ea5e9' : 'var(--text-muted)', width: '56px', textAlign: 'right', fontWeight: aWins ? 700 : 400, flexShrink: 0 }}>
            {valA.toFixed(unitA === 's' ? 3 : 1)}{unitA} {aWins ? '✓' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '9px', color: '#a855f7', width: '12px', fontWeight: 700, flexShrink: 0 }}>B</span>
          <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctB}%`, background: colorB, borderRadius: '4px', transition: 'width 0.5s ease' }} />
          </div>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: !aWins ? '#a855f7' : 'var(--text-muted)', width: '56px', textAlign: 'right', fontWeight: !aWins ? 700 : 400, flexShrink: 0 }}>
            {valB.toFixed(unitA === 's' ? 3 : 1)}{unitB || unitA} {!aWins ? '✓' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Track Events Mini-Map ────────────────────────────────────────────────────

function TrackEventsMap({ events, es }: { events: SessionEvent[]; es: boolean }) {
  const offTracks = events.filter((e) => e.type === 'off_track' && e.trackPct != null);
  const aiEvents = events.filter((e) => e.type === 'ai_recommendation' && e.trackPct != null);
  if (offTracks.length === 0 && aiEvents.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>
        {es ? 'Mapa de Eventos en Pista' : 'Track Events Map'}
      </div>
      <div style={{ position: 'relative', height: '28px', background: 'var(--bg-tertiary)', borderRadius: '14px', overflow: 'hidden' }}>
        {/* Sector bands */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '33.3%', height: '100%', background: 'rgba(14,165,233,0.06)', borderRight: '1px solid rgba(14,165,233,0.15)' }} />
        <div style={{ position: 'absolute', top: 0, left: '33.3%', width: '33.3%', height: '100%', background: 'rgba(168,85,247,0.06)', borderRight: '1px solid rgba(168,85,247,0.15)' }} />
        <div style={{ position: 'absolute', top: 0, left: '66.6%', right: 0, height: '100%', background: 'rgba(249,115,22,0.06)' }} />

        {/* Off-track markers */}
        {offTracks.map((e, i) => (
          <div key={`off-${i}`} title={`Off-track @ ${e.trackPct?.toFixed(0)}%${e.lap ? ` L${e.lap}` : ''}`}
            style={{
              position: 'absolute', top: '4px', height: '20px', width: '3px',
              left: `${Math.min(99, e.trackPct ?? 0)}%`,
              background: '#ef4444', borderRadius: '1px', opacity: 0.8,
              transform: 'translateX(-50%)',
            }} />
        ))}

        {/* AI warning markers */}
        {aiEvents.slice(-20).map((e, i) => (
          <div key={`ai-${i}`} title={e.message?.slice(0, 60)}
            style={{
              position: 'absolute', top: '8px', width: '6px', height: '6px',
              left: `${Math.min(99, e.trackPct ?? 0)}%`,
              background: '#f59e0b', borderRadius: '50%', opacity: 0.7,
              transform: 'translateX(-50%)',
            }} />
        ))}

        {/* Sector labels */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: 'rgba(14,165,233,0.5)', fontWeight: 700 }}>S1</span>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: 'rgba(168,85,247,0.5)', fontWeight: 700 }}>S2</span>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: 'rgba(249,115,22,0.5)', fontWeight: 700 }}>S3</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '5px', fontSize: '9px', color: 'var(--text-muted)' }}>
        {offTracks.length > 0 && <span><span style={{ color: '#ef4444', fontWeight: 700 }}>▐</span> {es ? 'Salida de pista' : 'Off-track'} ({offTracks.length})</span>}
        {aiEvents.length > 0 && <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>●</span> {es ? 'Alerta IA' : 'AI alert'} ({aiEvents.length})</span>}
      </div>
    </div>
  );
}

// ─── SVG Trend Chart ──────────────────────────────────────────────────────────

function TrendChart({ data, color, label, unit, height = 90 }: {
  data: { y: number; label: string }[]; color: string; label: string; unit: string; height?: number;
}) {
  if (data.length < 2) return null;
  const ys = data.map((d) => d.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const w = data.length * 36 + 16;
  const pad = 14;
  const toX = (i: number) => i * 36 + 18;
  const toY = (y: number) => pad + (1 - (y - minY) / rangeY) * (height - pad * 2);
  let path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.y)}`).join(' ');
  const area = `${path} L ${toX(data.length - 1)} ${height - pad} L ${toX(0)} ${height - pad} Z`;
  const bestIdx = ys.indexOf(Math.min(...ys));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '10px', fontFamily: 'monospace', color }}>{minY.toFixed(1)} – {maxY.toFixed(1)} {unit}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', minWidth: `${Math.min(w, 500)}px`, height: `${height}px` }} preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="10" y1={pad + f * (height - pad * 2)} x2={w - 10} y2={pad + f * (height - pad * 2)} stroke="var(--border)" strokeWidth="0.4" strokeDasharray="3 3" />
          ))}
          <path d={area} fill={color} opacity="0.08" />
          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(d.y)} r={i === bestIdx ? 5 : 3}
                fill={i === bestIdx ? color : 'var(--bg-secondary)'} stroke={color} strokeWidth={i === bestIdx ? 0 : 1.5} />
              <text x={toX(i)} y={height - 1} textAnchor="middle" fontSize="7" fill="var(--text-muted)">{d.label}</text>
            </g>
          ))}
          <text x={toX(bestIdx)} y={toY(data[bestIdx].y) - 5} textAnchor="middle" fontSize="8" fill={color} fontWeight="700">
            {data[bestIdx].y.toFixed(1)}
          </text>
        </svg>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Analysis() {
  const lang = useLangStore((s) => s.lang);
  const t = useT(lang);
  const es = lang === 'es';

  // Demo mode detection
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get('demo') === 'true';

  const [session, setSession] = useState<LoadedSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [s3Sessions, setS3Sessions] = useState<SessionListItem[]>([]);
  const [s3Loading, setS3Loading] = useState(true);
  const [s3Error, setS3Error] = useState(false);
  const [selectedLapA, setSelectedLapA] = useState<number | null>(null);
  const [selectedLapB, setSelectedLapB] = useState<number | null>(null);

  // Load demo data automatically if ?demo=true
  useEffect(() => {
    if (isDemo && !session) {
      setSession({
        info: DEMO_SESSION_INFO as any,
        laps: DEMO_LAP_SUMMARIES,
        events: DEMO_EVENTS as any,
      });
    }
  }, [isDemo, session]);

  // Auto-load first available session from API/S3
  useEffect(() => {
    if (isDemo) { setS3Loading(false); return; }
    listSessions()
      .then((s) => {
        setS3Sessions(s);
        setS3Error(false);
        // Auto-load the first session if available
        if (s.length > 0 && !session) {
          loadSession(s[0]).then((data) => {
            if (data.info) setSession({ info: data.info, laps: data.laps, events: data.events });
          }).catch(() => {});
        }
      })
      .catch(() => setS3Error(true))
      .finally(() => setS3Loading(false));
  }, [isDemo]);

  useEffect(() => {
    if (!session) return;
    const v = session.laps.filter((l) => l.lapTime > 0);
    if (v.length < 2) return;
    const bestIdx = v.reduce((bi, l, i, a) => l.lapTime < a[bi].lapTime ? i : bi, 0);
    const worstIdx = v.reduce((wi, l, i, a) => l.lapTime > a[wi].lapTime ? i : wi, 0);
    setSelectedLapA(v[bestIdx].lap);
    setSelectedLapB(v[worstIdx !== bestIdx ? worstIdx : (bestIdx === 0 ? 1 : 0)].lap);
  }, [session]);

  const handleLoadFromS3 = async (s: SessionListItem) => {
    setLoading(true);
    try {
      const data = await loadSession(s);
      if (data.info) setSession({ info: data.info, laps: data.laps, events: data.events });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleLoadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setLoading(true);
    setLoadError(null);
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
        } else if (name.endsWith('.json') && !info) {
          // Try to auto-detect: if it has lapTime fields it's laps, otherwise info
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed[0]?.lapTime !== undefined) laps = parsed;
          else if (parsed.driver !== undefined || parsed.track !== undefined) info = parsed;
        }
      }
      if (info) {
        setSession({ info, laps, events });
      } else {
        setLoadError(es
          ? `No se encontró session_info.json entre los ${e.target.files.length} archivo(s) seleccionado(s). Asegurate de incluirlo.`
          : `session_info.json not found among ${e.target.files.length} selected file(s). Make sure to include it.`
        );
      }
    } catch (err) {
      setLoadError(es
        ? `Error al parsear los archivos: ${err instanceof Error ? err.message : String(err)}`
        : `Error parsing files: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => session ? computeStats(session.laps) : null, [session]);
  const validLaps = useMemo(() => (session?.laps ?? []).filter((l) => l.lapTime > 0), [session]);
  const lapA = useMemo(() => validLaps.find((l) => l.lap === selectedLapA) ?? null, [validLaps, selectedLapA]);
  const lapB = useMemo(() => validLaps.find((l) => l.lap === selectedLapB) ?? null, [validLaps, selectedLapB]);
  const aiInsights = useMemo(() => session ? computeAIInsights(session.laps, stats, es) : [], [session, stats, es]);
  const speedChart = useMemo(() => validLaps.map((l) => ({ y: l.avgSpeed, label: `L${l.lap}` })), [validLaps]);
  const fuelChart = useMemo(() => validLaps.filter((l) => l.fuelUsed > 0).map((l) => ({ y: l.fuelUsed, label: `L${l.lap}` })), [validLaps]);
  const gChart = useMemo(() => validLaps.filter((l) => l.maxGLat > 0).map((l) => ({ y: l.maxGLat, label: `L${l.lap}` })), [validLaps]);

  // ─── Load screen ──────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{t.title}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{t.instructions}</p>
          </div>

          {!s3Loading && s3Sessions.length > 0 && (
            <div className="card p-5 mb-5">
              <h2 style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>{t.loadSession} (S3)</h2>
              <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {s3Sessions.map((s) => (
                  <button key={s.name} onClick={() => handleLoadFromS3(s)} disabled={loading}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', cursor: 'pointer', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{s.track || s.name}</span>
                        {s.driver && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>· {s.driver}</span>}
                        {s.date && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>· {new Date(s.date).toLocaleDateString()}</span>}
                      </div>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        {s.source === 'local' ? '📁' : '☁️'} →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {s3Loading && <div className="card p-5 mb-5" style={{ textAlign: 'center' }}><p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t.loading}</p></div>}

          <div className="card p-5">
            <h2 style={{ fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
              {s3Error || s3Sessions.length === 0 ? t.loadSession : `${t.loadSession} (manual)`}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.6 }}>
              <p>{t.step1}</p><p>{t.step2}</p><p>{t.step3}</p>
            </div>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              cursor: 'pointer', padding: '14px', border: '2px dashed var(--border)',
              borderRadius: '10px', color: 'var(--accent)', fontWeight: 700, fontSize: '13px',
              background: 'var(--accent-soft)', transition: 'all 0.2s',
            }}>
              📂 {es ? 'Seleccionar archivos de sesión' : 'Select session files'}
              <input type="file" multiple accept=".json,.jsonl" onChange={handleLoadFiles} style={{ display: 'none' }} />
            </label>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
              {es ? 'Podés seleccionar varios archivos a la vez (Ctrl+clic)' : 'You can select multiple files at once (Ctrl+click)'}
            </p>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: '13px', color: 'var(--accent)', margin: 0 }}>{t.loading}</p>
              </div>
            )}
            {loadError && (
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '12px', lineHeight: 1.5 }}>
                ⚠️ {loadError}
              </div>
            )}
          </div>
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Link to="/" style={{ fontSize: '13px', color: 'var(--accent)' }}>{t.back}</Link>
          </div>
        </div>
      </div>
    );
  }

  const { info, laps, events } = session;
  const aiEvents = events.filter((e) => e.type === 'ai_recommendation' || e.message?.includes('🤖'));
  const trackEvents = events.filter((e) => e.type === 'off_track');

  // ─── Analysis view ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* Sticky header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid var(--border)', padding: '10px 20px', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{t.title}</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {info.driver} · {info.car} · {info.track}{info.trackConfig ? ` (${info.trackConfig})` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <label style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {t.loadSession}
            <input type="file" multiple accept=".json,.jsonl" onChange={handleLoadFiles} style={{ display: 'none' }} />
          </label>
          <Link to="/" style={{ fontSize: '12px', color: 'var(--accent)' }}>{t.back}</Link>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Overview ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
          {[
            { label: t.date, value: new Date(info.startTime).toLocaleDateString(), color: '' },
            { label: t.laps, value: String(stats?.validLaps || 0), color: '' },
            { label: t.bestLap, value: stats ? fmt(stats.best) : '--', color: '#a855f7' },
            { label: t.avgLap, value: stats ? fmt(stats.avg) : '--', color: '' },
            { label: t.consistency, value: stats ? `${stats.consistency.toFixed(1)}%` : '--',
              color: stats ? (stats.consistency > 97 ? '#22c55e' : stats.consistency > 93 ? '#f59e0b' : '#ef4444') : '' },
            { label: t.maxSpeed, value: stats ? `${stats.maxSpeedSession.toFixed(0)} km/h` : '--', color: '#0ea5e9' },
          ].map((c) => (
            <div key={c.label} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' }}>{c.label}</div>
              <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', color: c.color || 'var(--text-primary)' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* ── AI Engineer Analysis ── */}
        {aiInsights.length > 0 && (
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🤖</span> {t.aiAnalysis}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px' }}>
              {aiInsights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)}
            </div>
          </div>
        )}

        {/* ── Track Events Mini-Map ── */}
        {events.length > 0 && (
          <div className="card" style={{ padding: '14px 16px' }}>
            <TrackEventsMap events={events} es={es} />
          </div>
        )}

        {/* ── Lap Time Evolution ── */}
        {validLaps.length >= 2 && (
          <div className="card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{t.evolution}</h2>
            <div style={{ overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${validLaps.length * 40 + 20} 170`}
                style={{ width: '100%', height: '160px' }}
                preserveAspectRatio="xMidYMid meet">
                {stats && (() => {
                  const times = validLaps.map((l) => l.lapTime);
                  const mn = Math.min(...times), mx = Math.max(...times);
                  const range = mx - mn || 1;
                  const pad = 14;
                  const toY = (t: number) => pad + ((t - mn) / range) * (150 - pad * 2);
                  const toX = (i: number) => i * 40 + 20;
                  const avgY = toY(stats.avg);
                  return (
                    <>
                      <line x1="10" y1={avgY} x2={validLaps.length * 40 + 10} y2={avgY} stroke="#0ea5e9" strokeWidth="0.6" strokeDasharray="4 2" opacity="0.4" />
                      {validLaps.map((l, i) => {
                        const x = toX(i); const y = toY(l.lapTime);
                        const isBest = l.lapTime === stats.best;
                        const isSelA = l.lap === selectedLapA, isSelB = l.lap === selectedLapB;
                        return (
                          <g key={l.lap} onClick={() => { if (!selectedLapA || selectedLapA === l.lap) setSelectedLapA(l.lap); else setSelectedLapB(l.lap); }} style={{ cursor: 'pointer' }}>
                            {i > 0 && <line x1={toX(i - 1)} y1={toY(validLaps[i - 1].lapTime)} x2={x} y2={y} stroke={isBest ? '#a855f7' : '#0ea5e9'} strokeWidth="1.5" opacity="0.7" />}
                            <circle cx={x} cy={y} r={isBest || isSelA || isSelB ? 6 : 4}
                              fill={isBest ? '#a855f7' : isSelA ? '#0ea5e9' : isSelB ? '#a855f7' : 'var(--bg-secondary)'}
                              stroke={isBest ? '#a855f7' : isSelA ? '#0ea5e9' : isSelB ? '#a855f7' : '#0ea5e9'} strokeWidth="1.5" />
                            {(isSelA || isSelB) && <text x={x} y={y - 10} textAnchor="middle" fontSize="8" fill={isSelA ? '#0ea5e9' : '#a855f7'} fontWeight="700">{isSelA ? 'A' : 'B'}</text>}
                            <text x={x} y="166" textAnchor="middle" fontSize="7" fill="var(--text-muted)">{es ? 'V' : 'L'}{l.lap}</text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>
            <p style={{ fontSize: '10px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '4px' }}>
              {es ? 'Clic en una vuelta para seleccionarla (A=azul, B=violeta)' : 'Click a lap to select it (A=blue, B=purple)'}
            </p>
          </div>
        )}

        {/* ── Lap Comparison ── */}
        {validLaps.length >= 2 && (
          <div className="card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>⚡ {t.comparison}</h2>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[
                { label: t.lapA, color: '#0ea5e9', val: selectedLapA, set: setSelectedLapA },
                { label: t.lapB, color: '#a855f7', val: selectedLapB, set: setSelectedLapB },
              ].map(({ label, color, val, set }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color }}>{label}</span>
                  <select value={val ?? ''} onChange={(e) => set(Number(e.target.value))}
                    style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                    <option value="">{t.selectLap}</option>
                    {validLaps.map((l) => (
                      <option key={l.lap} value={l.lap}>{es ? 'V' : 'L'}{l.lap} — {fmt(l.lapTime)}{l.lapTime === stats?.best ? ' ★' : ''}</option>
                    ))}
                  </select>
                  {val && validLaps.find(l => l.lap === val) && (
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color }}>{fmt(validLaps.find(l => l.lap === val)!.lapTime)}</span>
                  )}
                </div>
              ))}
            </div>

            {lapA && lapB ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <CompareBar label={es ? 'Tiempo de vuelta' : 'Lap time'} valA={lapA.lapTime} valB={lapB.lapTime} unitA="s" higherIsBetter={false} />
                  <CompareBar label={es ? 'Vel. máxima' : 'Max speed'} valA={lapA.maxSpeed} valB={lapB.maxSpeed} unitA=" km/h" />
                  <CompareBar label={es ? 'Vel. promedio' : 'Avg speed'} valA={lapA.avgSpeed} valB={lapB.avgSpeed} unitA=" km/h" />
                  <CompareBar label={es ? 'G lateral pico' : 'Peak lateral G'} valA={lapA.maxGLat} valB={lapB.maxGLat} unitA="g" />
                </div>
                <div>
                  <CompareBar label={es ? 'Combustible usado' : 'Fuel used'} valA={lapA.fuelUsed} valB={lapB.fuelUsed} unitA="%" higherIsBetter={false} />
                  <CompareBar label={es ? 'Freno máx' : 'Max brake'} valA={lapA.maxBrake} valB={lapB.maxBrake} unitA="%" />
                  <CompareBar label={es ? 'Salidas de pista' : 'Off-tracks'} valA={lapA.offTracks} valB={lapB.offTracks} unitA="" higherIsBetter={false} />
                  <CompareBar label={es ? 'G longitudinal pico' : 'Peak long. G'} valA={lapA.maxGLon} valB={lapB.maxGLon} unitA="g" />
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {es ? 'Selecciona dos vueltas arriba o haz clic en el gráfico.' : 'Select two laps above or click on the chart.'}
              </p>
            )}
          </div>
        )}

        {/* ── Trend charts ── */}
        {validLaps.length >= 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {speedChart.length >= 2 && <div className="card" style={{ padding: '14px' }}><TrendChart data={speedChart} color="#0ea5e9" label={t.speedTrend} unit="km/h" /></div>}
            {fuelChart.length >= 2 && <div className="card" style={{ padding: '14px' }}><TrendChart data={fuelChart} color="#f59e0b" label={t.fuelTrend} unit="%" /></div>}
            {gChart.length >= 2 && <div className="card" style={{ padding: '14px' }}><TrendChart data={gChart} color="#ef4444" label={t.gTrend} unit="g" /></div>}
          </div>
        )}

        {/* ── Lap table ── */}
        <div className="card" style={{ padding: '16px', overflowX: 'auto' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{t.lapTimes}</h2>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', minWidth: '500px' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                {[t.lap, t.time, t.maxSpeed, t.avgSpeed, t.fuelUsed, t.offTracks, t.gforce].map((h) => (
                  <th key={h} style={{ textAlign: h === t.lap || h === t.time ? 'left' : 'right', padding: '6px 8px', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {laps.filter((l) => l.lapTime > 0).map((l) => {
                const isBest = stats && l.lapTime === stats.best;
                const isSelA = l.lap === selectedLapA, isSelB = l.lap === selectedLapB;
                return (
                  <tr key={l.lap} onClick={() => { if (!selectedLapA || selectedLapA === l.lap) setSelectedLapA(l.lap); else setSelectedLapB(l.lap); }}
                    style={{
                      borderTop: '1px solid var(--border)', cursor: 'pointer',
                      background: isSelA ? 'rgba(14,165,233,0.07)' : isSelB ? 'rgba(168,85,247,0.07)' : 'transparent',
                    }}>
                    <td style={{ padding: '7px 8px', fontWeight: 700 }}>
                      {isSelA && <span style={{ fontSize: '9px', color: '#0ea5e9', marginRight: '4px', fontWeight: 700 }}>A</span>}
                      {isSelB && <span style={{ fontSize: '9px', color: '#a855f7', marginRight: '4px', fontWeight: 700 }}>B</span>}
                      {l.lap}
                    </td>
                    <td style={{ padding: '7px 8px', fontFamily: 'monospace', color: isBest ? '#a855f7' : 'inherit', fontWeight: isBest ? 700 : 400 }}>
                      {fmt(l.lapTime)} {isBest && '★'}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{l.maxSpeed.toFixed(0)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{l.avgSpeed.toFixed(0)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{l.fuelUsed.toFixed(2)}%</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: l.offTracks > 0 ? '#ef4444' : 'inherit' }}>{l.offTracks}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{l.maxGLat.toFixed(2)}g</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Events ── */}
        {(aiEvents.length > 0 || trackEvents.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {aiEvents.length > 0 && (
              <div className="card" style={{ padding: '14px' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{t.aiRecommendations} ({aiEvents.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {aiEvents.map((ev, i) => (
                    <div key={i} style={{ fontSize: '11px', padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span>{ev.message}</span>
                      {ev.lap && <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>{es ? 'V' : 'L'}{ev.lap}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {trackEvents.length > 0 && (
              <div className="card" style={{ padding: '14px' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{t.events} ({trackEvents.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {trackEvents.map((ev, i) => (
                    <div key={i} style={{ fontSize: '11px', padding: '8px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{ev.message}</span>
                      {ev.speed && <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>{ev.speed.toFixed(0)} km/h</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Performance footer ── */}
        {stats && (
          <div className="card" style={{ padding: '14px 16px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{t.performance}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '14px' }}>
              {[
                { label: t.bestLap, value: fmt(stats.best), color: '#a855f7' },
                { label: t.avgLap, value: fmt(stats.avg), color: '' },
                { label: t.consistency, value: `${stats.consistency.toFixed(1)}%`, color: stats.consistency > 97 ? '#22c55e' : stats.consistency > 93 ? '#f59e0b' : '#ef4444' },
                { label: `${t.fuel} total`, value: `${stats.totalFuel.toFixed(1)}%`, color: '' },
              ].map((c) => (
                <div key={c.label}>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' }}>{c.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', color: c.color || 'var(--text-primary)' }}>{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
