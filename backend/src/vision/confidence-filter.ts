/**
 * Filtro de confianza para detecciones del modelo de visión.
 *
 * Filtra detecciones por debajo del umbral de confianza mínimo (80%).
 * Solo las detecciones con confianza >= threshold se incluyen en el resultado.
 *
 * Validates: Requirement 2.2
 */

import { Detection, InferenceResult, RawDetection, RawInferenceResult } from './types';

/** Umbral de confianza mínimo (80%) */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.80;

/**
 * Filtra una lista de detecciones por umbral de confianza.
 * Solo retorna detecciones con confidence >= threshold.
 *
 * @param detections - Detecciones raw del modelo
 * @param threshold - Umbral mínimo de confianza (default: 0.80)
 * @returns Detecciones filtradas
 */
export function filterByConfidence(
  detections: RawDetection[],
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): Detection[] {
  return detections.filter((d) => d.confidence >= threshold);
}

/**
 * Aplica el filtro de confianza a un resultado de inferencia completo.
 *
 * @param rawResult - Resultado raw del modelo
 * @param threshold - Umbral de confianza
 * @returns Resultado filtrado (solo detecciones >= threshold)
 */
export function filterInferenceResult(
  rawResult: RawInferenceResult,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): InferenceResult {
  return {
    frameId: rawResult.frameId,
    pilotoId: rawResult.pilotoId,
    timestamp: rawResult.timestamp,
    processingTimeMs: rawResult.processingTimeMs,
    detections: filterByConfidence(rawResult.detections, threshold),
    segmentation: rawResult.segmentation,
  };
}
