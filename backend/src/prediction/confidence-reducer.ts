/**
 * Reducer de confianza por datos incompletos de ApexVision AI.
 *
 * Reduce el nivel de confianza de una predicción cuando los datos
 * de entrada están incompletos (menos del 70% de frames procesados).
 *
 * Validates: Requirement 5.5
 */

/** Umbral mínimo de completitud de datos (70%) */
export const COMPLETENESS_THRESHOLD = 0.70;

/** Confianza máxima cuando datos están incompletos */
export const MAX_CONFIDENCE_INCOMPLETE = 0.49;

/**
 * Evalúa si los datos son suficientes para una predicción confiable.
 *
 * @param framesProcessed - Número de frames procesados en el intervalo
 * @param framesTotalExpected - Número total de frames esperados
 * @returns true si la completitud es >= 70%
 */
export function isDatasufficient(
  framesProcessed: number,
  framesTotalExpected: number
): boolean {
  if (framesTotalExpected <= 0) return false;
  return (framesProcessed / framesTotalExpected) >= COMPLETENESS_THRESHOLD;
}

/**
 * Calcula el ratio de completitud de datos.
 *
 * @param framesProcessed - Frames procesados
 * @param framesTotalExpected - Frames esperados
 * @returns Ratio [0.0, 1.0]
 */
export function calculateCompletenessRatio(
  framesProcessed: number,
  framesTotalExpected: number
): number {
  if (framesTotalExpected <= 0) return 0;
  return Math.min(1, Math.max(0, framesProcessed / framesTotalExpected));
}

/**
 * Ajusta la confianza de una predicción basándose en la completitud de datos.
 *
 * Si la completitud es < 70%, la confianza se reduce a un valor < 0.5.
 * Si la completitud es >= 70%, la confianza no se modifica.
 *
 * @param originalConfidence - Confianza original del modelo [0.0, 1.0]
 * @param framesProcessed - Frames procesados
 * @param framesTotalExpected - Frames esperados
 * @returns Confianza ajustada [0.0, 1.0]
 */
export function adjustConfidence(
  originalConfidence: number,
  framesProcessed: number,
  framesTotalExpected: number
): number {
  const ratio = calculateCompletenessRatio(framesProcessed, framesTotalExpected);

  if (ratio >= COMPLETENESS_THRESHOLD) {
    // Datos suficientes: mantener confianza original
    return originalConfidence;
  }

  // Datos insuficientes: reducir confianza proporcional al ratio
  // Máximo: 0.49 (por debajo de 0.5 para indicar baja confianza)
  const reducedConfidence = ratio * MAX_CONFIDENCE_INCOMPLETE / COMPLETENESS_THRESHOLD;
  return Math.min(MAX_CONFIDENCE_INCOMPLETE, reducedConfidence);
}

/**
 * Determina si una predicción debe marcarse como baja confianza.
 *
 * @param confidence - Nivel de confianza de la predicción
 * @returns true si la confianza es < 0.5 (baja confianza)
 */
export function isLowConfidence(confidence: number): boolean {
  return confidence < 0.5;
}
