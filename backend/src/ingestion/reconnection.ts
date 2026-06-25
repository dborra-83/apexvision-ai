/**
 * Módulo de reconexión con backoff exponencial para flujos de video.
 *
 * Implementa la lógica de reconexión automática cuando un flujo de cámara
 * se desconecta. Usa backoff exponencial (base=1s, factor=2, max 3 intentos).
 * Tras agotar los intentos, transiciona al estado 'inactive'.
 *
 * Validates: Requirements 1.4, 1.6
 */

import { BackoffConfig, ReconnectionResult, ReconnectionState } from './types';

/** Configuración por defecto de backoff */
export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  baseDelayMs: 1000,
  factor: 2,
  maxAttempts: 3,
};

/**
 * Calcula el delay para un intento de reconexión dado.
 * Fórmula: delay = baseDelay × factor^intento
 *
 * @param attempt - Número de intento (0-based)
 * @param config - Configuración de backoff
 * @returns Delay en milisegundos
 */
export function calculateDelay(attempt: number, config: BackoffConfig = DEFAULT_BACKOFF_CONFIG): number {
  return config.baseDelayMs * Math.pow(config.factor, attempt);
}

/**
 * Crea un estado inicial de reconexión para un flujo desconectado.
 *
 * @param streamName - Nombre del stream
 * @param pilotoId - ID del piloto
 * @param disconnectTimestamp - Timestamp de la desconexión
 * @param config - Configuración de backoff
 * @returns Estado inicial de reconexión
 */
export function createReconnectionState(
  streamName: string,
  pilotoId: string,
  disconnectTimestamp: number,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG
): ReconnectionState {
  return {
    streamName,
    pilotoId,
    status: 'reconnecting',
    currentAttempt: 0,
    maxAttempts: config.maxAttempts,
    disconnectTimestamp,
    nextRetryTimestamp: disconnectTimestamp + calculateDelay(0, config),
  };
}

/**
 * Procesa un intento de reconexión y retorna el nuevo estado.
 *
 * Si el intento es exitoso: transiciona a 'active'.
 * Si falla y quedan intentos: incrementa el contador y calcula siguiente delay.
 * Si falla y se agotaron los intentos: transiciona a 'inactive'.
 *
 * @param state - Estado actual de reconexión
 * @param success - Si el intento fue exitoso
 * @param timestamp - Timestamp del intento
 * @param config - Configuración de backoff
 * @returns Resultado del intento con nuevo estado
 */
export function processReconnectionAttempt(
  state: ReconnectionState,
  success: boolean,
  timestamp: number,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG
): ReconnectionResult {
  // Si ya está inactivo, no reintentar
  if (state.status === 'inactive') {
    return {
      success: false,
      state,
      shouldRetry: false,
    };
  }

  // Intento exitoso: volver a activo
  if (success) {
    return {
      success: true,
      state: {
        ...state,
        status: 'active',
        currentAttempt: state.currentAttempt + 1,
        lastAttemptTimestamp: timestamp,
        nextRetryTimestamp: undefined,
      },
      shouldRetry: false,
    };
  }

  // Intento fallido
  const nextAttempt = state.currentAttempt + 1;

  // ¿Se agotaron los intentos?
  if (nextAttempt >= config.maxAttempts) {
    return {
      success: false,
      state: {
        ...state,
        status: 'inactive',
        currentAttempt: nextAttempt,
        lastAttemptTimestamp: timestamp,
        nextRetryTimestamp: undefined,
      },
      shouldRetry: false,
    };
  }

  // Aún quedan intentos: calcular siguiente delay
  const nextDelay = calculateDelay(nextAttempt, config);

  return {
    success: false,
    state: {
      ...state,
      status: 'reconnecting',
      currentAttempt: nextAttempt,
      lastAttemptTimestamp: timestamp,
      nextRetryTimestamp: timestamp + nextDelay,
    },
    shouldRetry: true,
    nextDelayMs: nextDelay,
  };
}

/**
 * Ejecuta la secuencia completa de reconexión con backoff exponencial.
 * Retorna el historial de intentos y el estado final.
 *
 * @param streamName - Nombre del stream
 * @param pilotoId - ID del piloto
 * @param connectFn - Función que intenta la conexión (retorna true si éxito)
 * @param disconnectTimestamp - Timestamp de la desconexión
 * @param config - Configuración de backoff
 * @returns Estado final y lista de delays usados
 */
export async function executeReconnection(
  streamName: string,
  pilotoId: string,
  connectFn: () => Promise<boolean>,
  disconnectTimestamp: number,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG
): Promise<{ finalState: ReconnectionState; delays: number[] }> {
  let state = createReconnectionState(streamName, pilotoId, disconnectTimestamp, config);
  const delays: number[] = [];
  let currentTimestamp = disconnectTimestamp;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const delay = calculateDelay(attempt, config);
    delays.push(delay);
    currentTimestamp += delay;

    // Simular espera y ejecutar intento
    const success = await connectFn();

    const result = processReconnectionAttempt(state, success, currentTimestamp, config);
    state = result.state;

    if (result.success || !result.shouldRetry) {
      break;
    }
  }

  return { finalState: state, delays };
}
