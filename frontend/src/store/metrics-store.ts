/**
 * Store de métricas en tiempo real (Zustand).
 *
 * Optimización de performance:
 * - Selector por piloto: useMetricsStore(s => s.pilots.get(id))
 *   → cada tarjeta se re-renderiza SOLO con sus propios datos.
 * - Para datos a 30fps, usar usePilotMetricsRef() con requestAnimationFrame
 *   en lugar de React state (evita renders masivos).
 * - subscribeWithSelector habilitado para suscripciones granulares fuera de React.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useRef, useEffect, useCallback } from 'react';

export interface PilotMetrics {
  pilotoId: string;
  velocidadAparente: number;
  posicionCarrera: number;
  desgasteNeumaticos: number;
  intensidadFrenado: number;
  anguloDirection: number;
  compuestoNeumatico: string;
  vueltasConCompuesto: number;
  prediccionPitStop?: number;
  lastUpdate: number;
}

interface MetricsState {
  pilots: Map<string, PilotMetrics>;
  updatePilotMetrics: (pilotoId: string, metrics: Partial<PilotMetrics>) => void;
  clearAll: () => void;
}

export const useMetricsStore = create<MetricsState>()(
  subscribeWithSelector((set) => ({
    pilots: new Map(),

    updatePilotMetrics: (pilotoId, metrics) =>
      set((state) => {
        const newPilots = new Map(state.pilots);
        const existing = newPilots.get(pilotoId) || {
          pilotoId,
          velocidadAparente: 0,
          posicionCarrera: 0,
          desgasteNeumaticos: 0,
          intensidadFrenado: 0,
          anguloDirection: 0,
          compuestoNeumatico: 'soft',
          vueltasConCompuesto: 0,
          lastUpdate: Date.now(),
        };
        newPilots.set(pilotoId, { ...existing, ...metrics, lastUpdate: Date.now() });
        return { pilots: newPilots };
      }),

    clearAll: () => set({ pilots: new Map() }),
  }))
);

/**
 * Selector por piloto — usar así en cada tarjeta:
 *   const metrics = usePilotMetrics(pilotoId);
 *
 * Cada tarjeta solo se re-renderiza cuando cambian SUS datos.
 */
export function usePilotMetrics(pilotoId: string): PilotMetrics | undefined {
  return useMetricsStore((state) => state.pilots.get(pilotoId));
}

/**
 * Hook para datos de alta frecuencia (30fps).
 * Mantiene los valores en un ref y llama a un callback de pintura
 * via requestAnimationFrame, sin forzar re-renders de React.
 *
 * Uso:
 *   const metricsRef = usePilotMetricsRef(pilotoId, (metrics) => {
 *     // Pintar directamente al DOM (canvas, svg, etc.)
 *     speedElement.textContent = metrics.velocidadAparente.toFixed(0);
 *   });
 */
export function usePilotMetricsRef(
  pilotoId: string,
  onUpdate?: (metrics: PilotMetrics) => void
): React.MutableRefObject<PilotMetrics | undefined> {
  const metricsRef = useRef<PilotMetrics | undefined>(undefined);
  const onUpdateRef = useRef(onUpdate);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    const unsubscribe = useMetricsStore.subscribe(
      (state) => state.pilots.get(pilotoId),
      (pilotMetrics) => {
        metricsRef.current = pilotMetrics;
        if (pilotMetrics && onUpdateRef.current) {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            onUpdateRef.current?.(pilotMetrics);
          });
        }
      }
    );

    return () => {
      unsubscribe();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pilotoId]);

  return metricsRef;
}

/**
 * Hook para obtener la lista de IDs de pilotos (se re-renderiza solo cuando
 * cambia la cantidad de pilotos, no en cada update de métricas).
 */
export function usePilotIds(): string[] {
  return useMetricsStore(
    useCallback((state: MetricsState) => Array.from(state.pilots.keys()), [])
  );
}
