/**
 * ApexVision AI — Landing Page / Home
 * Introducción a la plataforma con acceso a Live y Analysis.
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
    tagline: 'Ingeniero de carrera con inteligencia artificial',
    subtitle: 'Telemetría en tiempo real, análisis de sesión y recomendaciones IA para pilotos de iRacing',
    liveTitle: 'Live Telemetry',
    liveDesc: 'Conectá a iRacing y visualizá toda la telemetría en tiempo real con recomendaciones del ingeniero IA.',
    liveBtn: 'Ir a Live',
    analysisTitle: 'Análisis de Sesión',
    analysisDesc: 'Revisá sesiones anteriores: tiempos por vuelta, evolución, eventos y sugerencias para mejorar.',
    analysisBtn: 'Ir a Análisis',
    features: 'Características',
    feat1: 'Telemetría a 10Hz',
    feat1d: 'Velocidad, RPM, pedales, G-Force, neumáticos, motor y más en tiempo real.',
    feat2: 'IA Race Engineer',
    feat2d: 'Recomendaciones inteligentes basadas en tu conducción: frenado, desgaste, combustible.',
    feat3: 'Grabación automática',
    feat3d: 'Cada sesión se guarda con detalle por vuelta para análisis posterior.',
    feat4: 'Info del circuito',
    feat4d: 'Datos útiles del circuito, consejos de manejo y particularidades.',
    footer: 'Creado con pasión por la velocidad.',
  } : {
    tagline: 'AI-powered race engineer',
    subtitle: 'Real-time telemetry, session analysis and AI recommendations for iRacing drivers',
    liveTitle: 'Live Telemetry',
    liveDesc: 'Connect to iRacing and visualize all telemetry in real time with AI engineer recommendations.',
    liveBtn: 'Go to Live',
    analysisTitle: 'Session Analysis',
    analysisDesc: 'Review past sessions: lap times, evolution, events and suggestions to improve.',
    analysisBtn: 'Go to Analysis',
    features: 'Features',
    feat1: '10Hz Telemetry',
    feat1d: 'Speed, RPM, pedals, G-Force, tires, engine and more in real time.',
    feat2: 'AI Race Engineer',
    feat2d: 'Smart recommendations based on your driving: braking, wear, fuel.',
    feat3: 'Auto Recording',
    feat3d: 'Every session is saved with per-lap detail for later analysis.',
    feat4: 'Track Info',
    feat4d: 'Useful circuit data, driving tips and particularities.',
    footer: 'Built with passion for speed.',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-lg">ApexVision AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/live" className="text-sm font-medium px-3 py-1.5 rounded-lg no-underline transition" style={{ color: 'var(--text-secondary)' }}>
            Live
          </Link>
          <Link to="/analysis" className="text-sm font-medium px-3 py-1.5 rounded-lg no-underline transition" style={{ color: 'var(--text-secondary)' }}>
            {lang === 'es' ? 'Análisis' : 'Analysis'}
          </Link>
          <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="text-xs font-bold px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            {lang.toUpperCase()}
          </button>
          <button onClick={toggleTheme} className="text-sm px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            {theme === 'dark' ? '☀' : '☽'}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ letterSpacing: '-0.03em' }}>
          ApexVision <span style={{ color: 'var(--accent)' }}>AI</span>
        </h1>
        <p className="text-xl md:text-2xl font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t.tagline}
        </p>
        <p className="text-base max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-muted)' }}>
          {t.subtitle}
        </p>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Live card */}
          <Link to="/live" className="card p-6 text-left no-underline group" style={{ color: 'var(--text-primary)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--success-soft)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold">{t.liveTitle}</h2>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{t.liveDesc}</p>
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{t.liveBtn} →</span>
          </Link>

          {/* Analysis card */}
          <Link to="/analysis" className="card p-6 text-left no-underline group" style={{ color: 'var(--text-primary)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 3v18h18" />
                  <path d="M7 16l4-8 4 4 4-8" />
                </svg>
              </div>
              <h2 className="text-lg font-bold">{t.analysisTitle}</h2>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{t.analysisDesc}</p>
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{t.analysisBtn} →</span>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">{t.features}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: t.feat1, desc: t.feat1d, icon: '⚡' },
            { title: t.feat2, desc: t.feat2d, icon: '🧠' },
            { title: t.feat3, desc: t.feat3d, icon: '💾' },
            { title: t.feat4, desc: t.feat4d, icon: '🗺️' },
          ].map((f) => (
            <div key={f.title} className="card p-5">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-sm mb-2">{f.title}</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ApexVision AI · {t.footer}
        </p>
      </footer>
    </div>
  );
}
