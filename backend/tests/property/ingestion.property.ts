import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateDelay,
  createReconnectionState,
  processReconnectionAttempt,
  DEFAULT_BACKOFF_CONFIG,
} from '../../src/ingestion/reconnection';
import { BackoffConfig, ReconnectionState } from '../../src/ingestion/types';

describe('Property Tests: Ingestion', () => {
  // Feature: apexvision-ai-platform, Property 1: Máquina de estados de reconexión con backoff exponencial
  // Para cualquier flujo de video y cualquier secuencia de desconexiones, los intervalos
  // de reintento deben seguir la fórmula intervalo = base × factor^intento (base=1s, factor=2),
  // ejecutando exactamente 3 reintentos. Si los 3 reintentos fallan, el flujo debe
  // transicionar al estado 'inactivo' y no se deben intentar más reconexiones automáticas.
  describe('Property 1: Backoff exponencial + estado inactivo', () => {
    it('delay sigue fórmula base × factor^intento para cualquier intento', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 100, max: 5000 }),
          fc.integer({ min: 2, max: 4 }),
          (attempt, baseDelay, factor) => {
            const config: BackoffConfig = { baseDelayMs: baseDelay, factor, maxAttempts: 5 };
            const expected = baseDelay * Math.pow(factor, attempt);
            return calculateDelay(attempt, config) === expected;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('exactamente 3 fallos consecutivos → estado inactive', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1000000000000, max: 2000000000000 }),
          (streamName, pilotoId, disconnectTime) => {
            let state = createReconnectionState(streamName, pilotoId, disconnectTime);
            let time = disconnectTime;

            // Ejecutar exactamente 3 fallos
            for (let i = 0; i < 3; i++) {
              time += calculateDelay(i);
              const result = processReconnectionAttempt(state, false, time);
              state = result.state;
            }

            // Después de 3 fallos: inactivo
            return state.status === 'inactive';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('menos de 3 fallos NO transiciona a inactive', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1 }),
          fc.integer({ min: 1000000000000, max: 2000000000000 }),
          (numFailures, disconnectTime) => {
            let state = createReconnectionState('stream', 'pilot', disconnectTime);
            let time = disconnectTime;

            for (let i = 0; i < numFailures; i++) {
              time += calculateDelay(i);
              const result = processReconnectionAttempt(state, false, time);
              state = result.state;
            }

            return state.status !== 'inactive';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('éxito en cualquier intento → estado active', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          fc.integer({ min: 1000000000000, max: 2000000000000 }),
          (successAttempt, disconnectTime) => {
            let state = createReconnectionState('stream', 'pilot', disconnectTime);
            let time = disconnectTime;

            // Fallar hasta el intento de éxito
            for (let i = 0; i < successAttempt; i++) {
              time += calculateDelay(i);
              const result = processReconnectionAttempt(state, false, time);
              state = result.state;
            }

            // Éxito
            time += calculateDelay(successAttempt);
            const result = processReconnectionAttempt(state, true, time);

            return result.state.status === 'active';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('después de inactive, no se intentan más reconexiones', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1000000000000, max: 2000000000000 }),
          (extraAttempts, disconnectTime) => {
            let state = createReconnectionState('stream', 'pilot', disconnectTime);
            let time = disconnectTime;

            // Agotar los 3 intentos
            for (let i = 0; i < 3; i++) {
              time += calculateDelay(i);
              const result = processReconnectionAttempt(state, false, time);
              state = result.state;
            }

            // Intentar más reconexiones: todas deben retornar shouldRetry=false
            for (let i = 0; i < extraAttempts; i++) {
              time += 1000;
              const result = processReconnectionAttempt(state, false, time);
              if (result.shouldRetry) return false;
              if (result.state.status !== 'inactive') return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('los delays son estrictamente crecientes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000 }),
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 2, max: 10 }),
          (baseDelay, factor, maxAttempts) => {
            const config: BackoffConfig = { baseDelayMs: baseDelay, factor, maxAttempts };
            for (let i = 0; i < maxAttempts - 1; i++) {
              if (calculateDelay(i + 1, config) <= calculateDelay(i, config)) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
