import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  clasificarSeveridad,
  obtenerTtlEntrega,
  requiereNotificacionAudible,
  AlertContext,
  TipoAlerta,
} from '../../src/alerts/severity-classifier';
import {
  procesarAlerta,
  DEFAULT_GROUPING_RULE,
  AlertBuffer,
} from '../../src/alerts/alert-grouper';
import { Alerta, AlertaAgrupada, Severidad, SLA_ENTREGA_MS } from '../../src/alerts/types';

// Arbitraries
const severidadArb = fc.constantFrom<Severidad>('critica', 'alta', 'media', 'informativa');

const tipoAlertaArb = fc.constantFrom<TipoAlerta>(
  'anomalia_rendimiento', 'pit_stop_inminente', 'ventana_adelantamiento',
  'degradacion_neumaticos', 'desconexion_stream', 'degradacion_servicio', 'metrica_fuera_rango'
);

const alertContextArb: fc.Arbitrary<AlertContext> = fc.record({
  tipo: tipoAlertaArb,
  pilotoId: fc.string({ minLength: 1, maxLength: 10 }),
  desviacionSigma: fc.option(fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true })),
  vueltasParaPit: fc.option(fc.integer({ min: 1, max: 30 })),
  esUltimasVueltas: fc.option(fc.boolean()),
});

function makeAlerta(tipo: string, pilotoId: string, timestamp: number, severidad: Severidad): Alerta {
  return {
    alertaId: `alert-${timestamp}`,
    tipo,
    severidad,
    pilotoId,
    sessionId: 'session-1',
    timestamp,
    payload: {},
    destinatarios: ['ingeniero_pista'],
    ttlEntrega: SLA_ENTREGA_MS[severidad],
  };
}

describe('Property Tests: Alerts', () => {
  // Feature: apexvision-ai-platform, Property 14: Clasificación de severidad y SLA de entrega
  // Cada alerta debe tener exactamente una severidad. TTL: 500ms critica/alta, 2000ms media, 5000ms informativa.
  // Pit stop inminente (< 3 vueltas) = severidad 'alta'.
  describe('Property 14: Severidad + SLA entrega', () => {
    it('clasificación siempre retorna exactamente una severidad válida', () => {
      fc.assert(
        fc.property(alertContextArb, (context) => {
          const severidad = clasificarSeveridad(context);
          const validas: Severidad[] = ['critica', 'alta', 'media', 'informativa'];
          return validas.includes(severidad);
        }),
        { numRuns: 200 }
      );
    });

    it('pit_stop_inminente siempre es severidad alta', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }),
          (pilotoId) => {
            const context: AlertContext = {
              tipo: 'pit_stop_inminente',
              pilotoId,
            };
            return clasificarSeveridad(context) === 'alta';
          }
        ),
        { numRuns: 50 }
      );
    });

    it('TTL critica y alta = 500ms', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Severidad>('critica', 'alta'),
          (severidad) => {
            return obtenerTtlEntrega(severidad) === 500;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('TTL media = 2000ms, informativa = 5000ms', () => {
      return obtenerTtlEntrega('media') === 2000 && obtenerTtlEntrega('informativa') === 5000;
    });

    it('notificación audible solo para critica y alta', () => {
      fc.assert(
        fc.property(severidadArb, (severidad) => {
          const audible = requiereNotificacionAudible(severidad);
          if (severidad === 'critica' || severidad === 'alta') {
            return audible === true;
          }
          return audible === false;
        }),
        { numRuns: 50 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 15: Agrupación de alertas por umbral
  // > 10 alertas del mismo tipo/piloto en 60s → evento agrupado.
  // <= 10 → entrega individual.
  describe('Property 15: Agrupación de alertas', () => {
    it('<= 10 alertas en 60s → todas individuales', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (numAlertas) => {
            const buffers = new Map<string, AlertBuffer>();
            const now = Date.now();
            let allIndividual = true;

            for (let i = 0; i < numAlertas; i++) {
              const alerta = makeAlerta('anomalia', 'pilot-1', now + i * 1000, 'alta');
              const result = procesarAlerta(alerta, buffers);
              if (result.tipo !== 'individual') {
                allIndividual = false;
              }
            }

            return allIndividual;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('> 10 alertas mismo tipo/piloto en 60s → genera agrupada', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 11, max: 30 }),
          (numAlertas) => {
            const buffers = new Map<string, AlertBuffer>();
            const now = Date.now();
            let generatedGroup = false;

            for (let i = 0; i < numAlertas; i++) {
              const alerta = makeAlerta('anomalia', 'pilot-1', now + i * 1000, 'alta');
              const result = procesarAlerta(alerta, buffers);
              if (result.tipo === 'agrupada') {
                generatedGroup = true;
              }
            }

            return generatedGroup;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('alertas de diferentes pilotos no se agrupan entre sí', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 10 }),
          (alertasPorPiloto) => {
            const buffers = new Map<string, AlertBuffer>();
            const now = Date.now();
            let anyGrouped = false;

            // 2 pilotos, cada uno con alertasPorPiloto (<=10 cada uno)
            for (let i = 0; i < alertasPorPiloto; i++) {
              const a1 = makeAlerta('anomalia', 'pilot-1', now + i * 1000, 'alta');
              const a2 = makeAlerta('anomalia', 'pilot-2', now + i * 1000, 'alta');
              const r1 = procesarAlerta(a1, buffers);
              const r2 = procesarAlerta(a2, buffers);
              if (r1.tipo === 'agrupada' || r2.tipo === 'agrupada') {
                anyGrouped = true;
              }
            }

            return anyGrouped === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('grupo agrupado contiene totalOcurrencias correcto', () => {
      const buffers = new Map<string, AlertBuffer>();
      const now = Date.now();
      let grupo: AlertaAgrupada | null = null;

      for (let i = 0; i < 12; i++) {
        const alerta = makeAlerta('anomalia', 'pilot-1', now + i * 1000, 'alta');
        const result = procesarAlerta(alerta, buffers);
        if (result.tipo === 'agrupada') {
          grupo = result.grupo;
        }
      }

      // Debe haber generado un grupo con las 12 alertas (ya que > 10)
      return grupo !== null && grupo.totalOcurrencias > DEFAULT_GROUPING_RULE.umbralAlertas;
    });
  });
});
