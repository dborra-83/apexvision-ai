/**
 * Monitor de frames descartados para ApexVision AI.
 *
 * Cuenta frames consecutivos descartados por piloto y genera
 * alerta de degradación si se superan 10 frames consecutivos.
 *
 * Validates: Requirements 2.4, 2.5
 */

/** Estado del monitor por piloto */
export interface DiscardState {
  pilotoId: string;
  consecutiveDiscards: number;
  alertGenerated: boolean;
  lastDiscardTimestamp?: number;
}

/** Resultado del procesamiento de un frame */
export interface FrameProcessResult {
  state: DiscardState;
  shouldAlert: boolean;
}

/** Umbral de frames descartados consecutivos para generar alerta */
export const DISCARD_ALERT_THRESHOLD = 10;

/**
 * Crea el estado inicial del monitor para un piloto.
 */
export function createDiscardState(pilotoId: string): DiscardState {
  return {
    pilotoId,
    consecutiveDiscards: 0,
    alertGenerated: false,
  };
}

/**
 * Registra un frame descartado y evalúa si se debe generar alerta.
 *
 * @param state - Estado actual del monitor
 * @param timestamp - Timestamp del descarte
 * @param threshold - Umbral para generar alerta (default: 10)
 * @returns Nuevo estado y si se debe alertar
 */
export function recordDiscard(
  state: DiscardState,
  timestamp: number,
  threshold: number = DISCARD_ALERT_THRESHOLD
): FrameProcessResult {
  const newCount = state.consecutiveDiscards + 1;
  const shouldAlert = newCount > threshold && !state.alertGenerated;

  return {
    state: {
      ...state,
      consecutiveDiscards: newCount,
      lastDiscardTimestamp: timestamp,
      alertGenerated: state.alertGenerated || shouldAlert,
    },
    shouldAlert,
  };
}

/**
 * Registra un frame procesado exitosamente (resetea el contador).
 *
 * @param state - Estado actual del monitor
 * @returns Estado reseteado
 */
export function recordSuccess(state: DiscardState): FrameProcessResult {
  return {
    state: {
      ...state,
      consecutiveDiscards: 0,
      alertGenerated: false,
    },
    shouldAlert: false,
  };
}

/**
 * Verifica si el estado actual ha superado el umbral de descartes.
 */
export function isAboveThreshold(
  state: DiscardState,
  threshold: number = DISCARD_ALERT_THRESHOLD
): boolean {
  return state.consecutiveDiscards > threshold;
}
