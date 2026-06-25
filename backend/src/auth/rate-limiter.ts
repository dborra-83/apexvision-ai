/**
 * Rate Limiter para autenticación de ApexVision AI.
 *
 * Implementa bloqueo temporal de cuentas/IPs basado en intentos
 * fallidos consecutivos:
 * - Login: 5 fallos en 10 minutos → bloqueo 30 minutos
 * - MFA: 3 fallos consecutivos → bloqueo 15 minutos
 *
 * Validates: Requirements 7.10, 7.11, 10.7
 */

import { AuthAttempt, BlockStatus } from './types';

/** Configuración de rate limiting para login */
export interface RateLimitConfig {
  /** Máximo de intentos fallidos permitidos */
  maxAttempts: number;
  /** Ventana de tiempo en ms para contar intentos */
  windowMs: number;
  /** Duración del bloqueo en ms */
  blockDurationMs: number;
}

/** Configuraciones predeterminadas */
export const LOGIN_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 10 * 60 * 1000,      // 10 minutos
  blockDurationMs: 30 * 60 * 1000, // 30 minutos
};

export const MFA_CONFIG: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: Infinity,              // Consecutivos sin ventana temporal
  blockDurationMs: 15 * 60 * 1000, // 15 minutos
};

export const IP_BLOCK_CONFIG: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 5 * 60 * 1000,        // 5 minutos
  blockDurationMs: 15 * 60 * 1000, // 15 minutos
};

/**
 * Evalúa si un identificador (IP o usuario) debe ser bloqueado
 * basándose en su historial de intentos.
 *
 * @param attempts - Historial de intentos (ordenados cronológicamente)
 * @param config - Configuración de rate limiting
 * @param now - Timestamp actual (para testing)
 * @returns Estado de bloqueo
 */
export function evaluateBlock(
  attempts: AuthAttempt[],
  config: RateLimitConfig,
  now: number = Date.now()
): BlockStatus {
  if (attempts.length === 0) {
    return { blocked: false };
  }

  // Filtrar intentos dentro de la ventana temporal
  const windowStart = now - config.windowMs;
  const relevantAttempts = config.windowMs === Infinity
    ? attempts
    : attempts.filter((a) => a.timestamp >= windowStart);

  // Contar fallos consecutivos (desde el más reciente)
  let consecutiveFailures = 0;
  for (let i = relevantAttempts.length - 1; i >= 0; i--) {
    if (relevantAttempts[i].success) {
      break;
    }
    consecutiveFailures++;
  }

  // Verificar si se alcanzó el umbral
  if (consecutiveFailures >= config.maxAttempts) {
    // El bloqueo se aplica desde el último intento fallido
    const lastFailure = relevantAttempts[relevantAttempts.length - 1];
    const unblockAt = lastFailure.timestamp + config.blockDurationMs;

    // Si el bloqueo ya expiró, no bloquear
    if (unblockAt <= now) {
      return { blocked: false };
    }

    return {
      blocked: true,
      unblockAt,
      reason: `Bloqueado por ${consecutiveFailures} intentos fallidos. Desbloqueo en ${Math.ceil((unblockAt - now) / 60000)} minutos.`,
    };
  }

  return { blocked: false };
}

/**
 * Evalúa bloqueo de IP por intentos de autenticación fallidos.
 * 3 fallos consecutivos desde la misma IP en 5 minutos → bloqueo 15 minutos.
 *
 * @param attempts - Historial de intentos desde esa IP
 * @param now - Timestamp actual
 * @returns Estado de bloqueo de la IP
 */
export function evaluateIpBlock(
  attempts: AuthAttempt[],
  now: number = Date.now()
): BlockStatus {
  return evaluateBlock(attempts, IP_BLOCK_CONFIG, now);
}

/**
 * Evalúa bloqueo de cuenta por intentos de login fallidos.
 * 5 fallos en 10 minutos → bloqueo 30 minutos.
 *
 * @param attempts - Historial de intentos del usuario
 * @param now - Timestamp actual
 * @returns Estado de bloqueo de la cuenta
 */
export function evaluateLoginBlock(
  attempts: AuthAttempt[],
  now: number = Date.now()
): BlockStatus {
  return evaluateBlock(attempts, LOGIN_CONFIG, now);
}

/**
 * Evalúa bloqueo por fallos de MFA.
 * 3 fallos consecutivos → bloqueo 15 minutos.
 *
 * @param attempts - Historial de intentos MFA del usuario
 * @param now - Timestamp actual
 * @returns Estado de bloqueo MFA
 */
export function evaluateMfaBlock(
  attempts: AuthAttempt[],
  now: number = Date.now()
): BlockStatus {
  return evaluateBlock(attempts, MFA_CONFIG, now);
}

/**
 * Calcula el tiempo restante de bloqueo en milisegundos.
 *
 * @param blockStatus - Estado de bloqueo actual
 * @param now - Timestamp actual
 * @returns Milisegundos restantes, o 0 si no está bloqueado
 */
export function remainingBlockTime(
  blockStatus: BlockStatus,
  now: number = Date.now()
): number {
  if (!blockStatus.blocked || !blockStatus.unblockAt) {
    return 0;
  }
  return Math.max(0, blockStatus.unblockAt - now);
}
