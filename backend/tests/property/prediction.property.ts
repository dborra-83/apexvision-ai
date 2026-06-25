import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  calcularZScore,
  detectarAnomalia,
  clasificarAnomalia,
  calcularMedia,
  calcularDesviacionEstandar,
  DEFAULT_PARAMS,
} from '../../src/prediction/anomaly-detector';
import {
  evaluarVentanaAdelantamiento,
  UMBRAL_DIFERENCIA_SECTOR,
} from '../../src/prediction/overtaking-windows';
import {
  adjustConfidence,
  isDatasufficient,
  COMPLETENESS_THRESHOLD,
} from '../../src/prediction/confidence-reducer';
import { DatosPiloto, TipoSector } from '../../src/prediction/types';

// Arbitraries
const tipoSectorArb = fc.constantFrom<TipoSector>('recta', 'curva_lenta', 'curva_rapida');

const datosPilotoArb: fc.Arbitrary<DatosPiloto> = fc.record({
  pilotoId: fc.string({ minLength: 1, maxLength: 10 }),
  tiemposSector: fc.array(fc.double({ min: 20, max: 60, noNaN: true, noDefaultInfinity: true }), { minLength: 3, maxLength: 10 }),
  desgasteNeumaticos: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  vueltaActual: fc.integer({ min: 1, max: 70 }),
});

describe('Property Tests: Prediction', () => {
  // Feature: apexvision-ai-platform, Property 8: Detección de anomalías por Z-score
  // Si |Z-score| > 2.0, se genera anomalía. Si <= 2.0, no se genera.
  describe('Property 8: Z-score anomaly detection', () => {
    it('Z-score > umbral → anomalía detectada', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 50, max: 150, noNaN: true, noDefaultInfinity: true }), { minLength: 5, maxLength: 20 }),
          (historico) => {
            const media = calcularMedia(historico);
            const std = calcularDesviacionEstandar(historico);
            if (std === 0) return true; // Skip degenerate case

            // Crear un valor con Z-score > 2.0
            const valorAnomalo = media + std * 2.5;
            const { esAnomalia } = detectarAnomalia(valorAnomalo, historico);
            return esAnomalia === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Z-score <= umbral → NO anomalía', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 50, max: 150, noNaN: true, noDefaultInfinity: true }), { minLength: 5, maxLength: 20 }),
          (historico) => {
            const media = calcularMedia(historico);
            const std = calcularDesviacionEstandar(historico);
            if (std === 0) return true;

            // Crear un valor con Z-score dentro de [-1.5, 1.5]
            const valorNormal = media + std * 1.0;
            const { esAnomalia } = detectarAnomalia(valorNormal, historico);
            return esAnomalia === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clasificación siempre retorna una categoría válida', () => {
      const metricas = ['anguloDirection', 'posicionLineaCarrera', 'velocidadAparente', 'desgasteNeumaticos', 'intensidadFrenado', 'otra'];
      const clasificacionesValidas = ['subviraje', 'sobreviraje', 'fatiga', 'degradacion_mecanica'];

      fc.assert(
        fc.property(
          fc.constantFrom(...metricas),
          fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
          (metrica, zScore) => {
            const result = clasificarAnomalia(metrica, zScore);
            return clasificacionesValidas.includes(result);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 9: Identificación de ventanas de adelantamiento
  // Una ventana se identifica si y solo si la diferencia >= 0.3s por sector.
  describe('Property 9: Overtaking windows', () => {
    it('diferencia >= 0.3s → ventana identificada', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.3, max: 3.0, noNaN: true, noDefaultInfinity: true }),
          tipoSectorArb,
          fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
          (diferencia, sector, desgasteAtacante, desgasteDefensor) => {
            // Atacante más rápido por `diferencia` segundos
            const baseTime = 30;
            const atacante: DatosPiloto = {
              pilotoId: 'atk',
              tiemposSector: [baseTime, baseTime, baseTime],
              desgasteNeumaticos: desgasteAtacante,
              vueltaActual: 10,
            };
            const defensor: DatosPiloto = {
              pilotoId: 'def',
              tiemposSector: [baseTime + diferencia, baseTime + diferencia, baseTime + diferencia],
              desgasteNeumaticos: desgasteDefensor,
              vueltaActual: 10,
            };

            const result = evaluarVentanaAdelantamiento(atacante, defensor, sector);
            return result.esVentana === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('diferencia < 0.3s → NO ventana', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 0.29, noNaN: true, noDefaultInfinity: true }),
          tipoSectorArb,
          (diferencia, sector) => {
            const baseTime = 30;
            const atacante: DatosPiloto = {
              pilotoId: 'atk',
              tiemposSector: [baseTime, baseTime, baseTime],
              desgasteNeumaticos: 30,
              vueltaActual: 10,
            };
            const defensor: DatosPiloto = {
              pilotoId: 'def',
              tiemposSector: [baseTime + diferencia, baseTime + diferencia, baseTime + diferencia],
              desgasteNeumaticos: 30,
              vueltaActual: 10,
            };

            const result = evaluarVentanaAdelantamiento(atacante, defensor, sector);
            return result.esVentana === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('probabilidad siempre en [0.0, 1.0]', () => {
      fc.assert(
        fc.property(datosPilotoArb, datosPilotoArb, tipoSectorArb, (atk, def, sector) => {
          const result = evaluarVentanaAdelantamiento(atk, def, sector);
          return result.probabilidad >= 0 && result.probabilidad <= 1;
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 10: Reducción de confianza por datos incompletos
  // Si ratio < 70%, confianza < 0.5. Si ratio >= 70%, confianza no se reduce.
  describe('Property 10: Confidence reduction', () => {
    it('datos suficientes (>= 70%) → confianza no modificada', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 70, max: 100 }),
          (originalConf, framesProcessed) => {
            const adjusted = adjustConfidence(originalConf, framesProcessed, 100);
            return adjusted === originalConf;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('datos insuficientes (< 70%) → confianza < 0.5', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 1, max: 69 }),
          (originalConf, framesProcessed) => {
            const adjusted = adjustConfidence(originalConf, framesProcessed, 100);
            return adjusted < 0.5;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('0 frames procesados → confianza 0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          (originalConf) => {
            const adjusted = adjustConfidence(originalConf, 0, 100);
            return adjusted === 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('isDatasufficient coherente con threshold', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 200 }),
          fc.integer({ min: 1, max: 200 }),
          (processed, expected) => {
            const sufficient = isDatasufficient(processed, expected);
            const ratio = processed / expected;
            return sufficient === (ratio >= COMPLETENESS_THRESHOLD);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
