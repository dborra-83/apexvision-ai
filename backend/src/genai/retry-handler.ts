/**
 * Retry handler para invocaciones a Amazon Bedrock.
 *
 * Gestiona reintentos con límite de 3 intentos, preserva el último
 * insight válido y notifica en caso de fallo persistente.
 *
 * Validates: Requirements 4.5, 4.6
 */

import { InsightResponse, RetryState } from './types';

/** Máximo de reintentos */
export const MAX_RETRIES = 3;

/**
 * Crea un estado inicial de retry.
 */
export function createRetryState(): RetryState {
  return {
    intentos: 0,
    maxIntentos: MAX_RETRIES,
    ultimoInsightValido: undefined,
    fallosPersistentes: false,
  };
}

/**
 * Registra un intento exitoso y actualiza el estado.
 *
 * @param state - Estado actual
 * @param insight - Insight generado exitosamente
 * @returns Nuevo estado con insight almacenado y contadores reseteados
 */
export function recordSuccess(state: RetryState, insight: InsightResponse): RetryState {
  return {
    intentos: 0,
    maxIntentos: state.maxIntentos,
    ultimoInsightValido: insight,
    fallosPersistentes: false,
  };
}

/**
 * Registra un fallo y evalúa si se deben seguir intentando.
 *
 * @param state - Estado actual
 * @returns { newState, shouldRetry, isPersistentFailure }
 */
export function recordFailure(state: RetryState): {
  newState: RetryState;
  shouldRetry: boolean;
  isPersistentFailure: boolean;
} {
  const newIntentos = state.intentos + 1;
  const isPersistentFailure = newIntentos >= state.maxIntentos;

  return {
    newState: {
      ...state,
      intentos: newIntentos,
      fallosPersistentes: isPersistentFailure,
    },
    shouldRetry: !isPersistentFailure,
    isPersistentFailure,
  };
}

/**
 * Obtiene el último insight válido como fallback.
 *
 * @param state - Estado actual
 * @returns Último insight válido, o undefined si no hay ninguno
 */
export function getLastValidInsight(state: RetryState): InsightResponse | undefined {
  return state.ultimoInsightValido;
}

/**
 * Verifica si el sistema está en estado de fallo persistente.
 */
export function isPersistentFailure(state: RetryState): boolean {
  return state.fallosPersistentes;
}

/**
 * Resetea el estado de retry (e.g., después de intervención manual).
 */
export function resetState(state: RetryState): RetryState {
  return {
    ...state,
    intentos: 0,
    fallosPersistentes: false,
  };
}
