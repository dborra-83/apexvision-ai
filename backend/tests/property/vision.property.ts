import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { filterByConfidence, filterInferenceResult } from '../../src/vision/confidence-filter';
import {
  createDiscardState,
  recordDiscard,
  recordSuccess,
  DISCARD_ALERT_THRESHOLD,
} from '../../src/vision/discard-monitor';
import { BoundingBox, DetectionClass, RawDetection, RawInferenceResult } from '../../src/vision/types';

// Arbitraries
const detectionClassArb = fc.constantFrom<DetectionClass>(
  'vehiculo_propio', 'vehiculo_cercano', 'limite_pista', 'sector'
);

const boundingBoxArb: fc.Arbitrary<BoundingBox> = fc.record({
  x: fc.float({ min: 0, max: Math.fround(0.9), noNaN: true }),
  y: fc.float({ min: 0, max: Math.fround(0.9), noNaN: true }),
  width: fc.float({ min: Math.fround(0.01), max: Math.fround(0.5), noNaN: true }),
  height: fc.float({ min: Math.fround(0.01), max: Math.fround(0.5), noNaN: true }),
});

const rawDetectionArb: fc.Arbitrary<RawDetection> = fc.record({
  classId: detectionClassArb,
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  boundingBox: boundingBoxArb,
});

describe('Property Tests: Vision', () => {
  // Feature: apexvision-ai-platform, Property 2: Filtrado de detecciones por umbral de confianza
  // Para cualquier conjunto de detecciones con confianzas en [0.0, 1.0], el resultado
  // filtrado debe contener únicamente aquellas con confianza >= 0.80.
  describe('Property 2: Filtrado por confianza >= 80%', () => {
    it('todas las detecciones en resultado tienen confianza >= threshold', () => {
      fc.assert(
        fc.property(
          fc.array(rawDetectionArb, { minLength: 0, maxLength: 50 }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (detections, threshold) => {
            const filtered = filterByConfidence(detections, threshold);
            return filtered.every((d) => d.confidence >= threshold);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('ninguna detección con confianza < threshold aparece en resultado', () => {
      fc.assert(
        fc.property(
          fc.array(rawDetectionArb, { minLength: 1, maxLength: 50 }),
          (detections) => {
            const filtered = filterByConfidence(detections, 0.80);
            const lowConfidence = detections.filter((d) => d.confidence < 0.80);
            // Ninguna de las de baja confianza debe estar en el resultado
            return lowConfidence.every(
              (low) => !filtered.some((f) => f === low)
            );
          }
        ),
        { numRuns: 200 }
      );
    });

    it('el filtrado preserva todas las detecciones >= threshold', () => {
      fc.assert(
        fc.property(
          fc.array(rawDetectionArb, { minLength: 0, maxLength: 50 }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (detections, threshold) => {
            const filtered = filterByConfidence(detections, threshold);
            const expected = detections.filter((d) => d.confidence >= threshold);
            return filtered.length === expected.length;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 3: Estructura completa del resultado de inferencia
  // Para cualquier resultado válido: frameId no vacío, pilotoId no vacío, timestamp > 0,
  // cada detección con confianza en [0.80, 1.0] y bbox en [0.0, 1.0].
  describe('Property 3: Estructura resultado de inferencia', () => {
    it('resultado filtrado mantiene estructura válida', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 36 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 2000000000000 }),
          fc.integer({ min: 1, max: 5000 }),
          fc.array(rawDetectionArb, { minLength: 0, maxLength: 20 }),
          (frameId, pilotoId, timestamp, processingTimeMs, detections) => {
            const raw: RawInferenceResult = {
              frameId,
              pilotoId,
              timestamp,
              processingTimeMs,
              detections,
            };

            const result = filterInferenceResult(raw);

            // Validar estructura
            if (!result.frameId || result.frameId.length === 0) return false;
            if (!result.pilotoId || result.pilotoId.length === 0) return false;
            if (result.timestamp <= 0) return false;

            // Todas las detecciones deben tener confianza >= 0.80
            for (const det of result.detections) {
              if (det.confidence < 0.80) return false;
              const bb = det.boundingBox;
              if (bb.x < 0 || bb.y < 0 || bb.width <= 0 || bb.height <= 0) return false;
            }

            return true;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 4: Alerta de degradación por frames consecutivos descartados
  // Se genera alerta si y solo si más de 10 frames consecutivos son descartados.
  describe('Property 4: Alerta por >10 frames descartados consecutivos', () => {
    it('exactamente N descartes consecutivos: alerta solo si N > 10', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          (numDiscards) => {
            let state = createDiscardState('pilot-1');
            let alertTriggered = false;

            for (let i = 0; i < numDiscards; i++) {
              const result = recordDiscard(state, Date.now() + i * 100);
              state = result.state;
              if (result.shouldAlert) alertTriggered = true;
            }

            if (numDiscards > DISCARD_ALERT_THRESHOLD) {
              return alertTriggered === true;
            }
            return alertTriggered === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('un éxito intermedio resetea el contador', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (discardsBefore, discardsAfter) => {
            let state = createDiscardState('pilot-1');

            // Descartes antes del éxito
            for (let i = 0; i < discardsBefore; i++) {
              const result = recordDiscard(state, Date.now() + i * 100);
              state = result.state;
            }

            // Un éxito
            const successResult = recordSuccess(state);
            state = successResult.state;

            // Verificar reset
            if (state.consecutiveDiscards !== 0) return false;

            // Descartes después del éxito
            let alertAfter = false;
            for (let i = 0; i < discardsAfter; i++) {
              const result = recordDiscard(state, Date.now() + (discardsBefore + i + 1) * 100);
              state = result.state;
              if (result.shouldAlert) alertAfter = true;
            }

            // Solo alerta si descartes después > 10
            if (discardsAfter > DISCARD_ALERT_THRESHOLD) {
              return alertAfter === true;
            }
            return alertAfter === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('la alerta se genera una sola vez (no se repite)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 12, max: 30 }),
          (numDiscards) => {
            let state = createDiscardState('pilot-1');
            let alertCount = 0;

            for (let i = 0; i < numDiscards; i++) {
              const result = recordDiscard(state, Date.now() + i * 100);
              state = result.state;
              if (result.shouldAlert) alertCount++;
            }

            // La alerta solo se genera UNA vez
            return alertCount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
