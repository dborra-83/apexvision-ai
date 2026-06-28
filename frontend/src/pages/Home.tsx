/**
 * ApexVision AI — Landing Page
 * F1 pit-wall style intro with logo slots, demo access, and navigation.
 */

import { Link } from 'react-router-dom';
import { useLangStore } from '../store/lang-store';
import { useThemeStore } from '../store/theme-store';

export function Home() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const t = lang === 'es' ? {
    tagline: 'Tu ingeniero de carrera con IA',
    subtitle: 'Telemetría en tiempo real, análisis de sesión y recomendaciones inteligentes. Compatible con iRacing, F1 2024/25, Assetto Corsa y ACC.',
    liveTitle: 'Live Telemetry',
    liveDesc: 'Dashboard de telemetría en tiempo real con recomendaciones del ingeniero IA.',
    liveBtn: 'Ir a Live',
    liveDemo: 'Ver Demo Live',
    analysisTitle: 'Session Analysis',
    analysisDesc: 'Analizar sesiones grabadas con gráficos, comparaciones y consejos IA.',
    analysisBtn: 'Ir a Análisis',
    analysisDemo: 'Ver Demo Análisis',
    features: 'Capacidades',
    feat1: '10Hz Multi-Sim', feat1d: 'iRacing, F1 2024/25, Assetto Corsa, ACC — una sola interfaz.',
    feat2: 'IA Race Engineer', feat2d: 'Análisis en tiempo real: frenado, desgaste, estrategia, curvas problemáticas.',
    feat3: 'Auto Recording', feat3d: 'Cada sesión se graba y sube a la nube automáticamente para análisis posterior.',
    feat4: 'Track Intelligence', feat4d: 'Info del circuito, consejos de manejo y particularidades de cada pista.',
    logoSlot: 'Arrastrá tu logo aquí',
  } : {
    tagline: 'Your AI-powered race engineer',
    subtitle: 'Real-time telemetry, session analysis and intelligent recommendations. Compatible with iRacing, F1 2024/25, Assetto Corsa, and ACC.',
    liveTitle: 'Live Telemetry',
    liveDesc: 'Real-time telemetry dashboard with AI race engineer recommendations.',
    liveBtn: 'Go to Live',
    liveDemo: 'Live Demo',
    analysisTitle: 'Session Analysis',
    analysisDesc: 'Analyze recorded sessions with charts, comparisons, and AI insights.',
    analysisBtn: 'Go to Analysis',
    analysisDemo: 'Analysis Demo',
    features: 'Capabilities',
    feat1: '10Hz Multi-Sim', feat1d: 'iRacing, F1 2024/25, Assetto Corsa, ACC — one unified interface.',
    feat2: 'AI Race Engineer', feat2d: 'Real-time analysis: braking, wear, strategy, problem corners.',
    feat3: 'Auto Recording', feat3d: 'Every session is recorded and uploaded to the cloud automatically.',
    feat4: 'Track Intelligence', feat4d: 'Circuit info, driving tips and particularities for each track.',
    logoSlot: 'Drop your logo here',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          {/* Logo slot 1 — Team logo */}
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--accent)', minWidth: '32px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">ApexVision AI</span>
          {/* Logo slot 2 — Sponsor/partner logo */}
          <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 rounded border border-dashed opacity-40 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8m-4-4h8"/></svg>
            {t.logoSlot}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/live" className="text-sm font-semibold px-3 py-1.5 rounded no-underline" style={{ color: 'var(--text-secondary)' }}>Live</Link>
          <Link to="/analysis" className="text-sm font-semibold px-3 py-1.5 rounded no-underline" style={{ color: 'var(--text-secondary)' }}>{lang === 'es' ? 'Análisis' : 'Analysis'}</Link>
          <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="text-xs font-bold px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{lang.toUpperCase()}</button>
          <button onClick={toggleTheme} className="text-sm px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{theme === 'dark' ? '☀' : '☽'}</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
          ApexVision <span style={{ color: 'var(--accent)' }}>AI</span>
        </h1>
        <p className="text-xl md:text-2xl font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{t.tagline}</p>
        <p className="text-sm max-w-2xl mx-auto mb-12" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {/* Live */}
          <div className="card p-6 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: 'rgba(0,210,255,0.1)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
              </div>
              <h2 className="text-base font-bold">{t.liveTitle}</h2>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{t.liveDesc}</p>
            <div className="flex gap-3">
              <Link to="/live" className="text-sm font-semibold px-4 py-2 rounded no-underline" style={{ background: 'var(--accent)', color: '#fff' }}>{t.liveBtn}</Link>
              <Link to="/live?demo=true" className="text-sm font-semibold px-4 py-2 rounded no-underline border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>{t.liveDemo}</Link>
            </div>
          </div>

          {/* Analysis */}
          <div className="card p-6 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: 'rgba(155,89,240,0.1)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9b59f0" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-8"/></svg>
              </div>
              <h2 className="text-base font-bold">{t.analysisTitle}</h2>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{t.analysisDesc}</p>
            <div className="flex gap-3">
              <Link to="/analysis" className="text-sm font-semibold px-4 py-2 rounded no-underline" style={{ background: '#9b59f0', color: '#fff' }}>{t.analysisBtn}</Link>
              <Link to="/analysis?demo=true" className="text-sm font-semibold px-4 py-2 rounded no-underline border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>{t.analysisDemo}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-lg font-bold text-center mb-8">{t.features}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: t.feat1, desc: t.feat1d, color: 'var(--accent)' },
            { title: t.feat2, desc: t.feat2d, color: '#9b59f0' },
            { title: t.feat3, desc: t.feat3d, color: '#00ff87' },
            { title: t.feat4, desc: t.feat4d, color: '#ff6b00' },
          ].map((f) => (
            <div key={f.title} className="card p-4" style={{ borderTop: `2px solid ${f.color}` }}>
              <h3 className="font-bold text-xs mb-2" style={{ color: f.color }}>{f.title}</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported sims */}
      <section className="text-center py-10 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
          {lang === 'es' ? 'Compatible con' : 'Compatible with'}
        </p>
        <div className="flex justify-center gap-8 flex-wrap text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          <span>iRacing</span><span>F1 2024</span><span>F1 2025</span><span>Assetto Corsa</span><span>ACC</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ApexVision AI © 2026</p>
      </footer>
    </div>
  );
}
