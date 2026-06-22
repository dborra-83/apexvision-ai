import { describe, it, expect } from 'vitest';
import {
  calculateDelay,
  createReconnectionState,
  processReconnectionAttempt,
  executeReconnection,
  DEFAULT_BACKOFF_CONFIG,
} from '../../../src/ingestion/reconnection';

describe('Reconnection Module', () => {
  const now = Date.now();

  describe('calculateDelay', () => {
    it('intento 0: base × 2^0 = 1000ms', () => {
      expect(calculateDelay(0)).toBe(1000);
    });

    it('intento 1: base × 2^1 = 2000ms', () => {
      expect(calculateDelay(1)).toBe(2000);
    });

    it('intento 2: base × 2^2 = 4000ms', () => {
      expect(calculateDelay(2)).toBe(4000);
    });

    it('usa config personalizada', () => {
      expect(calculateDelay(0, { baseDelayMs: 500, factor: 3, maxAttempts: 5 })).toBe(500);
      expect(calculateDelay(1, { baseDelayMs: 500, factor: 3, maxAttempts: 5 })).toBe(1500);
      expect(calculateDelay(2, { baseDelayMs: 500, factor: 3, maxAttempts: 5 })).toBe(4500);
    });
  });

  describe('createReconnectionState', () => {
    it('crea estado inicial en reconnecting', () => {
      const state = createReconnectionState('stream-1', 'pilot-1', now);
      expect(state.status).toBe('reconnecting');
      expect(state.currentAttempt).toBe(0);
      expect(state.maxAttempts).toBe(3);
      expect(state.disconnectTimestamp).toBe(now);
      expect(state.nextRetryTimestamp).toBe(now + 1000);
    });
  });

  describe('processReconnectionAttempt', () => {
    it('transiciona a active en éxito', () => {
      const state = createReconnectionState('stream-1', 'pilot-1', now);
      const result = processReconnectionAttempt(state, true, now + 1000);
      expect(result.success).toBe(true);
      expect(result.state.status).toBe('active');
      expect(result.shouldRetry).toBe(false);
    });

    it('primer fallo: sigue en reconnecting con delay 2s', () => {
      const state = createReconnectionState('stream-1', 'pilot-1', now);
      const result = processReconnectionAttempt(state, false, now + 1000);
      expect(result.success).toBe(false);
      expect(result.state.status).toBe('reconnecting');
      expect(result.state.currentAttempt).toBe(1);
      expect(result.shouldRetry).toBe(true);
      expect(result.nextDelayMs).toBe(2000);
    });

    it('segundo fallo: sigue en reconnecting con delay 4s', () => {
      const state = createReconnectionState('stream-1', 'pilot-1', now);
      state.currentAttempt = 1;
      const result = processReconnectionAttempt(state, false, now + 3000);
      expect(result.success).toBe(false);
      expect(result.state.status).toBe('reconnecting');
      expect(result.state.currentAttempt).toBe(2);
      expect(result.shouldRetry).toBe(true);
      expect(result.nextDelayMs).toBe(4000);
    });

    it('tercer fallo: transiciona a inactive', () => {
      const state = createReconnectionState('stream-1', 'pilot-1', now);
      state.currentAttempt = 2;
      const result = processReconnectionAttempt(state, false, now + 7000);
      expect(result.success).toBe(false);
      expect(result.state.status).toBe('inactive');
      expect(result.shouldRetry).toBe(false);
    });

    it('no reintenta si ya está inactive', () => {
      const state = createReconnectionState('stream-1', 'pilot-1', now);
      state.status = 'inactive';
      const result = processReconnectionAttempt(state, false, now + 10000);
      expect(result.shouldRetry).toBe(false);
      expect(result.state.status).toBe('inactive');
    });
  });

  describe('executeReconnection', () => {
    it('éxito en primer intento', async () => {
      const connectFn = async () => true;
      const { finalState, delays } = await executeReconnection(
        'stream-1', 'pilot-1', connectFn, now
      );
      expect(finalState.status).toBe('active');
      expect(delays).toHaveLength(1);
      expect(delays[0]).toBe(1000);
    });

    it('éxito en segundo intento', async () => {
      let attempt = 0;
      const connectFn = async () => {
        attempt++;
        return attempt >= 2;
      };
      const { finalState, delays } = await executeReconnection(
        'stream-1', 'pilot-1', connectFn, now
      );
      expect(finalState.status).toBe('active');
      expect(delays).toHaveLength(2);
      expect(delays).toEqual([1000, 2000]);
    });

    it('todos los intentos fallan → inactive', async () => {
      const connectFn = async () => false;
      const { finalState, delays } = await executeReconnection(
        'stream-1', 'pilot-1', connectFn, now
      );
      expect(finalState.status).toBe('inactive');
      expect(delays).toHaveLength(3);
      expect(delays).toEqual([1000, 2000, 4000]);
    });
  });
});
