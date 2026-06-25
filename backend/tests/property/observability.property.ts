import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  createLogEntry,
  serializeLogEntry,
  validateLogEntry,
  MAX_LOG_SIZE_BYTES,
  REQUIRED_FIELDS,
  LogLevel,
} from '../../src/observability/log-formatter';

// Arbitraries
const logLevelArb = fc.constantFrom<LogLevel>('debug', 'info', 'warn', 'error');

describe('Property Tests: Observability', () => {
  // Feature: apexvision-ai-platform, Property 18: Formato estructurado de logs
  // Para cualquier entrada de log, el formato debe ser JSON válido con campos obligatorios:
  // timestamp (ISO 8601), nivel, servicio, traceId, mensaje. Tamaño <= 256 KB.
  describe('Property 18: Formato estructurado de logs', () => {
    it('createLogEntry siempre produce JSON válido con campos obligatorios', () => {
      fc.assert(
        fc.property(
          logLevelArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 36 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (nivel, servicio, traceId, mensaje) => {
            const entry = createLogEntry(nivel, servicio, traceId, mensaje);

            // Debe tener todos los campos obligatorios
            for (const field of REQUIRED_FIELDS) {
              if (!entry[field] || entry[field] === '') return false;
            }

            // Timestamp debe ser ISO 8601 válido
            if (isNaN(Date.parse(entry.timestamp))) return false;

            // Nivel debe ser válido
            if (!['debug', 'info', 'warn', 'error'].includes(entry.nivel)) return false;

            return true;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('serializeLogEntry produce JSON parseable', () => {
      fc.assert(
        fc.property(
          logLevelArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 36 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          (nivel, servicio, traceId, mensaje) => {
            const entry = createLogEntry(nivel, servicio, traceId, mensaje);
            const serialized = serializeLogEntry(entry);

            // Debe ser JSON parseable
            try {
              const parsed = JSON.parse(serialized);
              return parsed.timestamp !== undefined && parsed.nivel !== undefined;
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('serializeLogEntry nunca excede 256 KB', () => {
      fc.assert(
        fc.property(
          logLevelArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 36 }),
          fc.string({ minLength: 1, maxLength: 300000 }), // Mensaje potencialmente grande
          (nivel, servicio, traceId, mensaje) => {
            const entry = createLogEntry(nivel, servicio, traceId, mensaje);
            const serialized = serializeLogEntry(entry);
            const size = Buffer.byteLength(serialized, 'utf-8');
            return size <= MAX_LOG_SIZE_BYTES;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validateLogEntry detecta campos vacíos', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('timestamp', 'nivel', 'servicio', 'traceId', 'mensaje'),
          (campoVacio) => {
            const entry = createLogEntry('info', 'test', 'trace-1', 'msg');
            // Vaciar un campo
            (entry as Record<string, unknown>)[campoVacio] = '';
            const { valid } = validateLogEntry(entry);
            return valid === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('entrada válida pasa validación', () => {
      fc.assert(
        fc.property(
          logLevelArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 36 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (nivel, servicio, traceId, mensaje) => {
            const entry = createLogEntry(nivel, servicio, traceId, mensaje);
            const { valid } = validateLogEntry(entry);
            return valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
