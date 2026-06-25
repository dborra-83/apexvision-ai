/**
 * Monitor de flujos de video para ApexVision AI.
 *
 * Monitoriza la tasa de pérdida de frames por piloto y genera
 * alarmas cuando la pérdida supera el 0.1% en ventanas de 60 segundos.
 *
 * Validates: Requirement 1.2
 */

/** Estadísticas de un stream en una ventana temporal */
export interface StreamStats {
  pilotoId: string;
  windowStartMs: number;
  windowEndMs: number;
  totalFramesExpected: number;
  totalFramesReceived: number;
  framesLost: number;
  lossPercentage: number;
}

/** Configuración del monitor */
export interface MonitorConfig {
  windowSizeMs: number;       // 60000 (60 segundos)
  frameRate: number;          // 30 fps
  lossThreshold: number;      // 0.001 (0.1%)
}

export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  windowSizeMs: 60000,
  frameRate: 30,
  lossThreshold: 0.001,
};

/**
 * Calcula las estadísticas de pérdida de frames para una ventana temporal.
 *
 * @param pilotoId - ID del piloto
 * @param frameTimestamps - Timestamps de frames recibidos en la ventana
 * @param windowStart - Inicio de la ventana (epoch ms)
 * @param windowEnd - Fin de la ventana (epoch ms)
 * @param config - Configuración del monitor
 * @returns Estadísticas del stream
 */
export function calculateStreamStats(
  pilotoId: string,
  frameTimestamps: number[],
  windowStart: number,
  windowEnd: number,
  config: MonitorConfig = DEFAULT_MONITOR_CONFIG
): StreamStats {
  const windowDurationMs = windowEnd - windowStart;
  const windowDurationS = windowDurationMs / 1000;
  const totalFramesExpected = Math.floor(windowDurationS * config.frameRate);
  const totalFramesReceived = frameTimestamps.filter(
    (t) => t >= windowStart && t < windowEnd
  ).length;
  const framesLost = Math.max(0, totalFramesExpected - totalFramesReceived);
  const lossPercentage = totalFramesExpected > 0
    ? framesLost / totalFramesExpected
    : 0;

  return {
    pilotoId,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
    totalFramesExpected,
    totalFramesReceived,
    framesLost,
    lossPercentage,
  };
}

/**
 * Determina si se debe generar una alarma de pérdida de frames.
 *
 * @param stats - Estadísticas del stream
 * @param config - Configuración del monitor
 * @returns true si la pérdida supera el umbral configurado
 */
export function shouldAlarm(
  stats: StreamStats,
  config: MonitorConfig = DEFAULT_MONITOR_CONFIG
): boolean {
  return stats.lossPercentage > config.lossThreshold;
}
