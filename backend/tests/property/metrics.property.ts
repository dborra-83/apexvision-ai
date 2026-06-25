import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  calcularDesviacionLineaOptima,
  roundToResolution,
} from '../../src/metrics/line-deviation';
import {
  validarValor,
  validarMetricas,
  sonMetricasValidas,
  obtenerMetricasAnomelas,
} from '../../src/metrics/range-validator';
import { MetricValues, PuntoLineaOptima, RangosMetricas } from '../../src/metrics/types';

// Arbitraries
const puntoArb: fc.Arbitrary<PuntoLineaOptima> = fc.record({
  x: fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
});

const lineaOptimaArb = fc.array(puntoArb, { minLength: 2, maxLength: 30 });

const metricValuesArb: fc.Arbitrary<MetricValues> = fc.record({
  velocidadAparente: fc.double({ min: -50, max: 400, noNaN: true, noDefaultInfinity: true }),
  posicionLineaCarrera: fc.double({ min: -20, max: 20, noNaN: true, noDefaultInfinity: true }),
  intensidadFrenado: fc.double({ min: -10, max: 110, noNaN: true, noDefaultInfinity: true }),
  anguloDirection: fc.double({ min: -200, max: 200, noNaN: true, noDefaultInfinity: true }),
  desgasteNeumaticos: fc.double({ min: -10, max: 110, noNaN: true, noDefaultInfinity: true }),
});

const rangosValidosArb: fc.Arbitrary<RangosMetricas> = fc.constant({
  velocidadAparente: { min: 0, max: 370 },
  posicionLineaCarrera: { min: -15, max: 15 },
  intensidadFrenado: { min: 0, max: 100 },
  anguloDirection: { min: -180, max: 180 },
  desgasteNeumaticos: { min: 0, max: 100 },
});

describe('Property Tests: Metrics', () => {
  // Feature: apexvision-ai-platform, Property 5: Cálculo de métricas con precisión y trazabilidad
  describe('Property 5: Precisión de métricas', () => {
    it('roundToResolution produce valores con la resolución correcta', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
          fc.constantFrom(0.1, 0.01, 1),
          (value, resolution) => {
            const rounded = roundToResolution(value, resolution);
            // El residuo debe ser < resolution/2 (tolerancia float)
            const residuo = Math.abs(rounded % resolution);
            return residuo < resolution * 0.01 || Math.abs(residuo - resolution) < resolution * 0.01;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 6: Cálculo de desviación respecto a línea óptima
  // La desviación calculada debe ser >= 0 con resolución de 0.01 metros.
  describe('Property 6: Desviación línea óptima', () => {
    it('la desviación siempre es >= 0', () => {
      fc.assert(
        fc.property(puntoArb, lineaOptimaArb, (posicion, linea) => {
          const desviacion = calcularDesviacionLineaOptima(posicion, linea);
          return desviacion >= 0;
        }),
        { numRuns: 200 }
      );
    });

    it('la desviación tiene resolución 0.01m', () => {
      fc.assert(
        fc.property(puntoArb, lineaOptimaArb, (posicion, linea) => {
          const desviacion = calcularDesviacionLineaOptima(posicion, linea);
          // Verificar que es múltiplo de 0.01 (con tolerancia floating point)
          const residuo = Math.abs((desviacion * 100) % 1);
          return residuo < 0.001 || Math.abs(residuo - 1) < 0.001;
        }),
        { numRuns: 200 }
      );
    });

    it('un punto sobre la línea tiene desviación 0 o muy cercana a 0', () => {
      fc.assert(
        fc.property(
          lineaOptimaArb,
          fc.integer({ min: 0, max: 28 }),
          (linea, index) => {
            if (index >= linea.length) return true;
            const puntoEnLinea = linea[index];
            const desviacion = calcularDesviacionLineaOptima(puntoEnLinea, linea);
            return desviacion <= 0.01; // Tolerancia de resolución
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 7: Validación de rangos físicos de métricas
  // Si el valor está fuera del rango [min, max], se marca como inválido.
  describe('Property 7: Validación de rangos físicos', () => {
    it('valor dentro de rango → esValido=true', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 370, noNaN: true, noDefaultInfinity: true }),
          (valor) => {
            const result = validarValor('velocidadAparente', valor, 0, 370);
            return result.esValido === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('valor fuera de rango → esValido=false', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.double({ min: -100, max: -0.001, noNaN: true, noDefaultInfinity: true }),
            fc.double({ min: 370.001, max: 500, noNaN: true, noDefaultInfinity: true })
          ),
          (valor) => {
            const result = validarValor('velocidadAparente', valor, 0, 370);
            return result.esValido === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('métrica fuera de rango aparece en metricasAnomelas', () => {
      fc.assert(
        fc.property(metricValuesArb, rangosValidosArb, (metricas, rangos) => {
          const anomelas = obtenerMetricasAnomelas(metricas, rangos);
          const valido = sonMetricasValidas(metricas, rangos);

          // Si es válido, no hay anomalías
          if (valido) {
            return anomelas.length === 0;
          }

          // Si no es válido, debe haber al menos una anomalía
          return anomelas.length > 0;
        }),
        { numRuns: 200 }
      );
    });

    it('validación es coherente: sonMetricasValidas === anomelas.length === 0', () => {
      fc.assert(
        fc.property(metricValuesArb, rangosValidosArb, (metricas, rangos) => {
          const valido = sonMetricasValidas(metricas, rangos);
          const anomelas = obtenerMetricasAnomelas(metricas, rangos);
          return valido === (anomelas.length === 0);
        }),
        { numRuns: 200 }
      );
    });

    it('cada métrica en anomelas tiene valor fuera de su rango', () => {
      fc.assert(
        fc.property(metricValuesArb, rangosValidosArb, (metricas, rangos) => {
          const anomelas = obtenerMetricasAnomelas(metricas, rangos);

          for (const nombreMetrica of anomelas) {
            const valor = metricas[nombreMetrica as keyof MetricValues];
            const rango = rangos[nombreMetrica as keyof RangosMetricas];
            if (valor >= rango.min && valor <= rango.max) {
              return false; // No debería estar en anomelas si está en rango
            }
          }
          return true;
        }),
        { numRuns: 200 }
      );
    });
  });
});
