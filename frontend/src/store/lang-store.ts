/**
 * Store de idioma (única fuente de verdad para i18n del MVP).
 *
 * Centraliza la persistencia en localStorage y las traducciones.
 * Los componentes acceden a t vía: const { t } = useLangStore();
 */

import { create } from 'zustand';

export type Lang = 'en' | 'es';

const translations = {
  en: {
    speed: 'Speed', gear: 'Gear', throttle: 'Throttle', brake: 'Brake',
    clutch: 'Clutch', tires: 'Tires', fuel: 'Fuel', timing: 'Timing',
    handling: 'Handling', gforce: 'G-Force', track: 'Track Map',
    current: 'Current', last: 'Last', best: 'Best', delta: 'Delta',
    position: 'Position', lap: 'Lap', lapsLeft: 'Laps Left',
    perLap: 'Per Lap', trackTemp: 'Track', airTemp: 'Air',
    understeer: 'UNDERSTEER', oversteer: 'OVERSTEER', neutral: 'NEUTRAL',
    abs: 'ABS', wheel: 'Wheel', live: 'Live', paused: 'Paused',
    connect: 'Connect', disconnect: 'Disconnect', speedTrace: 'Speed Trace',
    pedalInputs: 'Pedal Inputs', lapHistory: 'Lap History',
    fuelSession: 'Fuel & Session', steer: 'Steer', wear: 'Wear',
    incidents: 'Incidents', pit: 'PIT',
  },
  es: {
    speed: 'Velocidad', gear: 'Marcha', throttle: 'Acelerador', brake: 'Freno',
    clutch: 'Embrague', tires: 'Neumáticos', fuel: 'Combustible', timing: 'Tiempos',
    handling: 'Comportamiento', gforce: 'Fuerza G', track: 'Mapa Pista',
    current: 'Actual', last: 'Última', best: 'Mejor', delta: 'Delta',
    position: 'Posición', lap: 'Vuelta', lapsLeft: 'Vueltas rest.',
    perLap: 'Por vuelta', trackTemp: 'Pista', airTemp: 'Aire',
    understeer: 'SUBVIRAJE', oversteer: 'SOBREVIRAJE', neutral: 'NEUTRO',
    abs: 'ABS', wheel: 'Volante', live: 'En vivo', paused: 'Pausado',
    connect: 'Conectar', disconnect: 'Desconectar', speedTrace: 'Velocidad',
    pedalInputs: 'Pedales', lapHistory: 'Historial Vueltas',
    fuelSession: 'Combustible', steer: 'Dirección', wear: 'Desgaste',
    incidents: 'Incidentes', pit: 'PITS',
  },
};

export type TranslationKeys = Record<keyof typeof translations.en, string>;

interface LangState {
  lang: Lang;
  t: TranslationKeys;
  setLang: (l: Lang) => void;
}

function getInitialLang(): Lang {
  const saved = localStorage.getItem('lang');
  if (saved === 'en' || saved === 'es') return saved;
  return 'es';
}

export const useLangStore = create<LangState>((set) => {
  const initial = getInitialLang();
  return {
    lang: initial,
    t: translations[initial],
    setLang: (l) => {
      localStorage.setItem('lang', l);
      set({ lang: l, t: translations[l] });
    },
  };
});
