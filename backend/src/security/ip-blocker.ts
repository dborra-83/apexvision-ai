/**
 * Bloqueador de IP de ApexVision AI.
 *
 * Monitoriza intentos de autenticación por IP y bloquea tras 3 fallos
 * consecutivos en un período de 5 minutos. El bloqueo dura 15 minutos.
 *
 * Validates: Requirement 10.7
 */

/** Intento de autenticación desde una IP */
export interface IpAuthAttempt {
  ip: string;
  timestamp: number;
  success: boolean;
}

/** Estado de bloqueo de una IP */
export interface IpBlockStatus {
  blocked: boolean;
  ip: string;
  unblockAt?: number;
  blockedAt?: number;
  failCount?: number;
}

/** Configuración del bloqueador */
export interface IpBlockConfig {
  maxFailures: number;        // 3
  windowMs: number;           // 5 minutos
  blockDurationMs: number;    // 15 minutos
}

export const DEFAULT_IP_BLOCK_CONFIG: IpBlockConfig = {
  maxFailures: 3,
  windowMs: 5 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
};

/**
 * Evalúa si una IP debe ser bloqueada basándose en sus intentos recientes.
 *
 * Criterio: 3 intentos fallidos consecutivos dentro de una ventana de 5 minutos.
 *
 * @param attempts - Historial de intentos de la IP (ordenados cronológicamente)
 * @param now - Timestamp actual
 * @param config - Configuración del bloqueador
 * @returns Estado de bloqueo de la IP
 */
export function evaluateIpBlock(
  attempts: IpAuthAttempt[],
  now: number,
  config: IpBlockConfig = DEFAULT_IP_BLOCK_CONFIG
): IpBlockStatus {
  if (attempts.length === 0) {
    return { blocked: false, ip: '' };
  }

  const ip = attempts[0].ip;

  // Filtrar intentos dentro de la ventana temporal
  const windowStart = now - config.windowMs;
  const recentAttempts = attempts.filter((a) => a.timestamp >= windowStart);

  // Contar fallos consecutivos desde el más reciente
  let consecutiveFailures = 0;
  for (let i = recentAttempts.length - 1; i >= 0; i--) {
    if (recentAttempts[i].success) {
      break;
    }
    consecutiveFailures++;
  }

  if (consecutiveFailures >= config.maxFailures) {
    const lastFailure = recentAttempts[recentAttempts.length - 1];
    const unblockAt = lastFailure.timestamp + config.blockDurationMs;

    // Si el bloqueo ya expiró
    if (unblockAt <= now) {
      return { blocked: false, ip, failCount: consecutiveFailures };
    }

    return {
      blocked: true,
      ip,
      blockedAt: lastFailure.timestamp,
      unblockAt,
      failCount: consecutiveFailures,
    };
  }

  return { blocked: false, ip, failCount: consecutiveFailures };
}

/**
 * Verifica si una IP está actualmente bloqueada.
 *
 * @param status - Estado de bloqueo
 * @param now - Timestamp actual
 * @returns true si la IP sigue bloqueada
 */
export function isIpBlocked(status: IpBlockStatus, now: number): boolean {
  if (!status.blocked || !status.unblockAt) return false;
  return now < status.unblockAt;
}
