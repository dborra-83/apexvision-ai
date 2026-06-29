/**
 * ApexVision AI — Team View (2×2 Multi-Driver Grid)
 * Shows 4 driver mini-dashboards with live telemetry from gateway.
 * Phase 4: Frontend team monitoring for race engineers.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLangStore } from '../store/lang-store';
import { createDemoTelemetryStream } from '../data/demo-session';
import '../racing.css';

// ─── i18n ───
const teamTranslations = {
  en: {
    title: 'TEAM MONITOR',
    driver: 'Driver',
    speed: 'Speed',
    rpm: 'RPM',
    gear: 'Gear',
    lap: 'Lap',
    position: 'P',
    lastLap: 'Last Lap',
    tires: 'Tires',
    fuel: 'Fuel',
    connected: 'LIVE',
    disconnected: 'OFFLINE',
    kmh: 'km/h',
    back: '← Back',
    lf: 'LF',
    rf: 'RF',
    lr: 'LR',
    rr: 'RR',
  },
  es: {
    title: 'MONITOR DE EQUIPO',
    driver: 'Piloto',
    speed: 'Velocidad',
    rpm: 'RPM',
    gear: 'Marcha',
    lap: 'Vuelta',
    position: 'P',
    lastLap: 'Última Vuelta',
    tires: 'Neumáticos',
    fuel: 'Combustible',
    connected: 'EN VIVO',
    disconnected: 'OFFLINE',
    kmh: 'km/h',
    back: '← Volver',
    lf: 'DI',
    rf: 'DD',
    lr: 'TI',
    rr: 'TD',
  },
};

type TeamT = typeof teamTranslations.en;

function useTeamT(): TeamT {
  const lang = useLangStore((s) => s.lang);
  return teamTranslations[lang] || teamTranslations.en;
}

// ─── Demo Data Generation ───
interface DriverTelemetry {
  driverId: number;
  connected: boolean;
  speed: number;
  rpm: number;
  gear: number;
  lap: number;
  position: number;
  lastLapTime: number;
  tireLF_temp: number;
  tireRF_temp: number;
  tireLR_temp: number;
  tireRR_temp: number;
  fuelPercent: number;
  driverName: string;
  carName: string;
}

function generateDemoDrivers(): DriverTelemetry[] {
  // Create 4 demo streams with slight variations to simulate a team
  const names = ['Carlos M.', 'Alex R.', 'Daniela V.', 'Miguel S.'];
  const cars = ['Mercedes AMG GT3', 'Porsche 911 GT3 R', 'Ferrari 296 GT3', 'BMW M4 GT3'];
  const streams = Array.from({ length: 4 }, () => createDemoTelemetryStream());

  return streams.map((stream, i) => {
    // Advance each stream a different amount to de-sync them
    let frame: Record<string, unknown> = {};
    const advanceTicks = (i + 1) * 47; // stagger positions on track
    for (let t = 0; t < advanceTicks; t++) {
      frame = stream();
    }

    return {
      driverId: i + 1,
      connected: i < 3, // Driver 4 = disconnected for demo
      speed: (frame.speed as number) || 0,
      rpm: (frame.rpm as number) || 0,
      gear: (frame.gear as number) || 0,
      lap: (frame.lap as number) || 1 + i,
      position: i + 1,
      lastLapTime: (frame.lastLapTime as number) || 229 + i * 1.2,
      tireLF_temp: (frame.tireLF_temp as number) || 88 + i * 2,
      tireRF_temp: (frame.tireRF_temp as number) || 90 + i * 2,
      tireLR_temp: (frame.tireLR_temp as number) || 84 + i,
      tireRR_temp: (frame.tireRR_temp as number) || 86 + i,
      fuelPercent: (frame.fuelPercent as number) || 85 - i * 12,
      driverName: names[i],
      carName: cars[i],
    };
  });
}

// ─── Helper: format lap time ───
function fmtTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

// ─── Helper: tire temp color ───
function tireColor(temp: number): string {
  if (temp < 65) return 'var(--rc-cyan)';
  if (temp > 105) return 'var(--rc-red)';
  return 'var(--rc-green)';
}

// ─── Helper: fuel color ───
function fuelColor(pct: number): string {
  if (pct < 15) return 'var(--rc-red)';
  if (pct < 30) return 'var(--rc-yellow)';
  return 'var(--rc-green)';
}

// ─── Driver Panel Component ───
function DriverPanel({ driver, t }: { driver: DriverTelemetry; t: TeamT }) {
  return (
    <div className="rc-card" style={{ opacity: driver.connected ? 1 : 0.5 }}>
      {/* Header: Driver ID + Connection */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="rc-value"
            style={{
              background: 'var(--rc-cyan)',
              color: '#000',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 14,
            }}
          >
            {driver.driverId}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{driver.driverName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: driver.connected ? 'var(--rc-green)' : 'var(--rc-text-muted)',
              display: 'inline-block',
            }}
          />
          <span className="rc-label" style={{ fontSize: 10 }}>
            {driver.connected ? t.connected : t.disconnected}
          </span>
        </div>
      </div>

      {/* Speed — large */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div className="rc-value" style={{ fontSize: 36, color: 'var(--rc-text)' }}>
          {driver.connected ? Math.round(driver.speed) : '--'}
        </div>
        <div className="rc-label">{t.kmh}</div>
      </div>

      {/* RPM + Gear row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div className="rc-label">{t.rpm}</div>
          <div className="rc-value" style={{ fontSize: 16 }}>
            {driver.connected ? driver.rpm.toLocaleString() : '--'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="rc-label">{t.gear}</div>
          <div className="rc-value" style={{ fontSize: 16 }}>
            {driver.connected ? driver.gear : '-'}
          </div>
        </div>
      </div>

      {/* Lap + Position */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div className="rc-label">{t.lap}</div>
          <div className="rc-value" style={{ fontSize: 14 }}>{driver.lap}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="rc-label">{t.position}</div>
          <div className="rc-value" style={{ fontSize: 14, color: 'var(--rc-yellow)' }}>
            {driver.position}
          </div>
        </div>
      </div>

      {/* Last Lap Time */}
      <div style={{ marginBottom: 8 }}>
        <div className="rc-label">{t.lastLap}</div>
        <div className="rc-value" style={{ fontSize: 14, color: 'var(--rc-purple)' }}>
          {driver.connected ? fmtTime(driver.lastLapTime) : '--:--.---'}
        </div>
      </div>

      {/* Tire Temps */}
      <div style={{ marginBottom: 8 }}>
        <div className="rc-label" style={{ marginBottom: 4 }}>{t.tires} (°C)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: tireColor(driver.tireLF_temp) }}>
            {t.lf} {driver.connected ? driver.tireLF_temp.toFixed(0) : '--'}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: tireColor(driver.tireRF_temp) }}>
            {t.rf} {driver.connected ? driver.tireRF_temp.toFixed(0) : '--'}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: tireColor(driver.tireLR_temp) }}>
            {t.lr} {driver.connected ? driver.tireLR_temp.toFixed(0) : '--'}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: tireColor(driver.tireRR_temp) }}>
            {t.rr} {driver.connected ? driver.tireRR_temp.toFixed(0) : '--'}
          </span>
        </div>
      </div>

      {/* Fuel */}
      <div>
        <div className="rc-label">{t.fuel}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: 'var(--rc-surface)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${driver.connected ? Math.min(100, driver.fuelPercent) : 0}%`,
                background: fuelColor(driver.fuelPercent),
                borderRadius: 3,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <span
            className="rc-value"
            style={{ fontSize: 12, color: fuelColor(driver.fuelPercent), minWidth: 36, textAlign: 'right' }}
          >
            {driver.connected ? `${driver.fuelPercent.toFixed(0)}%` : '--%'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Team Component ───
export function Team() {
  const t = useTeamT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  // Generate demo data (in production, this would come from a Zustand store
  // connected to the gateway WebSocket)
  const drivers = useMemo(() => generateDemoDrivers(), []);

  return (
    <div className="racing-app" style={{ minHeight: '100vh', padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ color: 'var(--rc-text-dim)', textDecoration: 'none', fontSize: 13 }}>
            {t.back}
          </Link>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--rc-cyan)', letterSpacing: '0.05em' }}>
            {t.title}
          </h1>
        </div>
        <button
          onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
          style={{
            background: 'var(--rc-surface)',
            border: '1px solid var(--rc-border)',
            borderRadius: 4,
            padding: '4px 10px',
            color: 'var(--rc-text-dim)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {lang === 'en' ? 'ES' : 'EN'}
        </button>
      </div>

      {/* 2×2 Grid (responsive: 1 col on mobile) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {drivers.map((driver) => (
          <DriverPanel key={driver.driverId} driver={driver} t={t} />
        ))}
      </div>
    </div>
  );
}
