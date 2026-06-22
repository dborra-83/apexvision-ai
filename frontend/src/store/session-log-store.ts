/**
 * Store de registro de sesión en vivo.
 * Guarda eventos relevantes para análisis posterior:
 * - Velocidades máximas por vuelta
 * - Salidas de pista (con posición en circuito)
 * - Incidentes
 * - Problemas de handling por zona
 * - Historial de tiempos de vuelta
 */

import { create } from 'zustand';

export interface SessionEvent {
  id: string;
  timestamp: number;
  lap: number;
  trackPct: number; // 0-100 posición en pista
  type: 'off_track' | 'incident' | 'oversteer' | 'understeer' | 'pit_stop' | 'best_lap' | 'max_speed' | 'fuel_low' | 'ai_recommendation';
  message: string;
  data?: Record<string, unknown>;
}

export interface LapRecord {
  lap: number;
  time: number;
  maxSpeed: number;
  avgSpeed: number;
  fuelUsed: number;
  incidents: number;
  offTracks: number;
}

interface SessionLogState {
  events: SessionEvent[];
  lapRecords: LapRecord[];
  maxSpeedSession: number;
  currentLapMaxSpeed: number;
  lastProcessedLap: number;
  isOffTrackCooldown: boolean;

  addEvent: (event: Omit<SessionEvent, 'id' | 'timestamp'>) => void;
  recordLap: (record: LapRecord) => void;
  updateMaxSpeed: (speed: number) => void;
  setOffTrackCooldown: (val: boolean) => void;
  setLastProcessedLap: (lap: number) => void;
  clearSession: () => void;
}

let eventCounter = 0;

export const useSessionLogStore = create<SessionLogState>((set) => ({
  events: [],
  lapRecords: [],
  maxSpeedSession: 0,
  currentLapMaxSpeed: 0,
  lastProcessedLap: 0,
  isOffTrackCooldown: false,

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, { ...event, id: `evt-${++eventCounter}`, timestamp: Date.now() }].slice(-200),
    })),

  recordLap: (record) =>
    set((state) => ({
      lapRecords: [...state.lapRecords, record],
    })),

  updateMaxSpeed: (speed) =>
    set((state) => ({
      maxSpeedSession: Math.max(state.maxSpeedSession, speed),
      currentLapMaxSpeed: Math.max(state.currentLapMaxSpeed, speed),
    })),

  setOffTrackCooldown: (val) => set({ isOffTrackCooldown: val }),
  setLastProcessedLap: (lap) => set({ lastProcessedLap: lap, currentLapMaxSpeed: 0 }),

  clearSession: () =>
    set({ events: [], lapRecords: [], maxSpeedSession: 0, currentLapMaxSpeed: 0, lastProcessedLap: 0 }),
}));
