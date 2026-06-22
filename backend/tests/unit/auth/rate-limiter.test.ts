import { describe, it, expect } from 'vitest';
import {
  evaluateBlock,
  evaluateLoginBlock,
  evaluateMfaBlock,
  evaluateIpBlock,
  remainingBlockTime,
  LOGIN_CONFIG,
  MFA_CONFIG,
  IP_BLOCK_CONFIG,
} from '../../../src/auth/rate-limiter';
import { AuthAttempt } from '../../../src/auth/types';

describe('Rate Limiter', () => {
  const now = Date.now();

  const makeAttempt = (
    success: boolean,
    offsetMs: number = 0,
    type: 'login' | 'mfa' = 'login'
  ): AuthAttempt => ({
    identifier: 'user-123',
    timestamp: now - offsetMs,
    success,
    type,
  });

  describe('evaluateLoginBlock', () => {
    it('no bloquea con 0 intentos', () => {
      const result = evaluateLoginBlock([], now);
      expect(result.blocked).toBe(false);
    });

    it('no bloquea con 4 fallos en 10 minutos', () => {
      const attempts = [
        makeAttempt(false, 8 * 60 * 1000),
        makeAttempt(false, 6 * 60 * 1000),
        makeAttempt(false, 4 * 60 * 1000),
        makeAttempt(false, 2 * 60 * 1000),
      ];
      const result = evaluateLoginBlock(attempts, now);
      expect(result.blocked).toBe(false);
    });

    it('bloquea con 5 fallos consecutivos en 10 minutos', () => {
      const attempts = [
        makeAttempt(false, 9 * 60 * 1000),
        makeAttempt(false, 7 * 60 * 1000),
        makeAttempt(false, 5 * 60 * 1000),
        makeAttempt(false, 3 * 60 * 1000),
        makeAttempt(false, 1 * 60 * 1000),
      ];
      const result = evaluateLoginBlock(attempts, now);
      expect(result.blocked).toBe(true);
    });

    it('no bloquea si un éxito rompe la racha de fallos', () => {
      const attempts = [
        makeAttempt(false, 9 * 60 * 1000),
        makeAttempt(false, 7 * 60 * 1000),
        makeAttempt(true, 5 * 60 * 1000),  // Éxito interrumpe
        makeAttempt(false, 3 * 60 * 1000),
        makeAttempt(false, 1 * 60 * 1000),
      ];
      const result = evaluateLoginBlock(attempts, now);
      expect(result.blocked).toBe(false);
    });

    it('no bloquea si los fallos están fuera de la ventana de 10 min', () => {
      const attempts = [
        makeAttempt(false, 15 * 60 * 1000),
        makeAttempt(false, 14 * 60 * 1000),
        makeAttempt(false, 13 * 60 * 1000),
        makeAttempt(false, 12 * 60 * 1000),
        makeAttempt(false, 11 * 60 * 1000),
      ];
      const result = evaluateLoginBlock(attempts, now);
      expect(result.blocked).toBe(false);
    });

    it('el bloqueo dura 30 minutos', () => {
      const attempts = [
        makeAttempt(false, 9 * 60 * 1000),
        makeAttempt(false, 7 * 60 * 1000),
        makeAttempt(false, 5 * 60 * 1000),
        makeAttempt(false, 3 * 60 * 1000),
        makeAttempt(false, 1 * 60 * 1000),
      ];
      const result = evaluateLoginBlock(attempts, now);
      expect(result.blocked).toBe(true);
      expect(result.unblockAt).toBeDefined();
      // Bloqueo = último fallo + 30 min
      const expectedUnblock = (now - 1 * 60 * 1000) + 30 * 60 * 1000;
      expect(result.unblockAt).toBe(expectedUnblock);
    });
  });

  describe('evaluateMfaBlock', () => {
    it('no bloquea con 2 fallos MFA', () => {
      const attempts = [
        makeAttempt(false, 30000, 'mfa'),
        makeAttempt(false, 15000, 'mfa'),
      ];
      const result = evaluateMfaBlock(attempts, now);
      expect(result.blocked).toBe(false);
    });

    it('bloquea con 3 fallos MFA consecutivos', () => {
      const attempts = [
        makeAttempt(false, 30000, 'mfa'),
        makeAttempt(false, 20000, 'mfa'),
        makeAttempt(false, 10000, 'mfa'),
      ];
      const result = evaluateMfaBlock(attempts, now);
      expect(result.blocked).toBe(true);
    });

    it('bloqueo MFA dura 15 minutos', () => {
      const attempts = [
        makeAttempt(false, 30000, 'mfa'),
        makeAttempt(false, 20000, 'mfa'),
        makeAttempt(false, 10000, 'mfa'),
      ];
      const result = evaluateMfaBlock(attempts, now);
      expect(result.unblockAt).toBeDefined();
      const remaining = remainingBlockTime(result, now);
      expect(remaining).toBeGreaterThan(14 * 60 * 1000);
      expect(remaining).toBeLessThanOrEqual(15 * 60 * 1000);
    });
  });

  describe('evaluateIpBlock', () => {
    it('bloquea IP tras 3 fallos en 5 minutos', () => {
      const attempts = [
        makeAttempt(false, 4 * 60 * 1000),
        makeAttempt(false, 2 * 60 * 1000),
        makeAttempt(false, 1 * 60 * 1000),
      ];
      const result = evaluateIpBlock(attempts, now);
      expect(result.blocked).toBe(true);
    });

    it('no bloquea IP si fallos separados por más de 5 min', () => {
      const attempts = [
        makeAttempt(false, 12 * 60 * 1000),
        makeAttempt(false, 8 * 60 * 1000),
        makeAttempt(false, 1 * 60 * 1000),
      ];
      // Solo 1 fallo dentro de la ventana de 5 minutos
      const result = evaluateIpBlock(attempts, now);
      expect(result.blocked).toBe(false);
    });
  });

  describe('remainingBlockTime', () => {
    it('retorna 0 si no está bloqueado', () => {
      expect(remainingBlockTime({ blocked: false }, now)).toBe(0);
    });

    it('retorna tiempo restante correcto', () => {
      const status = { blocked: true, unblockAt: now + 5 * 60 * 1000 };
      expect(remainingBlockTime(status, now)).toBe(5 * 60 * 1000);
    });

    it('retorna 0 si el bloqueo ya expiró', () => {
      const status = { blocked: true, unblockAt: now - 1000 };
      expect(remainingBlockTime(status, now)).toBe(0);
    });
  });
});
