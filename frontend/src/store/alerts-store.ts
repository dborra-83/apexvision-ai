/**
 * Store de alertas (Zustand).
 */

import { create } from 'zustand';

export interface Alert {
  alertaId: string;
  tipo: string;
  severidad: 'critica' | 'alta' | 'media' | 'informativa';
  pilotoId: string;
  texto?: string;
  timestamp: number;
  audible: boolean;
  dismissed: boolean;
}

interface AlertsState {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'dismissed'>) => void;
  dismissAlert: (alertaId: string) => void;
  clearAll: () => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: [],

  addAlert: (alert) =>
    set((state) => ({
      alerts: [{ ...alert, dismissed: false }, ...state.alerts].slice(0, 100),
    })),

  dismissAlert: (alertaId) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.alertaId === alertaId ? { ...a, dismissed: true } : a
      ),
    })),

  clearAll: () => set({ alerts: [] }),
}));
