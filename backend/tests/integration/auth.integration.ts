/**
 * Test de integración: Autenticación y autorización.
 *
 * Verifica el flujo completo de autorización RBAC:
 * token → rol → recurso → permiso → allow/deny.
 */

import { describe, it, expect } from 'vitest';
import { autorizar } from '../../src/auth/rbac-authorizer';
import { evaluateLoginBlock, evaluateMfaBlock, evaluateIpBlock } from '../../src/auth/rate-limiter';
import { TokenClaims, AuthAttempt, Rol } from '../../src/auth/types';

function makeToken(rol: Rol, expireInSeconds: number = 900): TokenClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: `user-${rol}-001`,
    email: `${rol}@apexvision.ai`,
    'custom:rol': rol,
    'cognito:groups': [rol],
    exp: now + expireInSeconds,
    iat: now,
  };
}

describe('Integration: Auth', () => {
  describe('Flujo completo RBAC por rol', () => {
    const recursos = [
      'GET /metrics/realtime',
      'GET /metrics/historical',
      'GET /predictions',
      'GET /alerts',
      'POST /alerts/acknowledge',
      'GET /reports',
      'POST /reports/export',
      'GET /users',
      'POST /users',
      'PUT /config',
      'GET /dashboard',
    ];

    it('admin puede acceder a todos los recursos', () => {
      const token = makeToken('admin');
      for (const recurso of recursos) {
        const result = autorizar(token, recurso);
        expect(result.authorized).toBe(true);
      }
    });

    it('ingeniero_pista: acceso real-time, sin histórico ni reportes', () => {
      const token = makeToken('ingeniero_pista');

      expect(autorizar(token, 'GET /metrics/realtime').authorized).toBe(true);
      expect(autorizar(token, 'GET /predictions').authorized).toBe(true);
      expect(autorizar(token, 'GET /alerts').authorized).toBe(true);
      expect(autorizar(token, 'POST /alerts/acknowledge').authorized).toBe(true);
      expect(autorizar(token, 'GET /dashboard').authorized).toBe(true);

      expect(autorizar(token, 'GET /metrics/historical').authorized).toBe(false);
      expect(autorizar(token, 'GET /reports').authorized).toBe(false);
      expect(autorizar(token, 'POST /reports/export').authorized).toBe(false);
      expect(autorizar(token, 'GET /users').authorized).toBe(false);
      expect(autorizar(token, 'PUT /config').authorized).toBe(false);
    });

    it('analista: acceso histórico y reportes, sin real-time', () => {
      const token = makeToken('analista');

      expect(autorizar(token, 'GET /metrics/historical').authorized).toBe(true);
      expect(autorizar(token, 'GET /reports').authorized).toBe(true);
      expect(autorizar(token, 'POST /reports/export').authorized).toBe(true);
      expect(autorizar(token, 'GET /dashboard').authorized).toBe(true);

      expect(autorizar(token, 'GET /metrics/realtime').authorized).toBe(false);
      expect(autorizar(token, 'GET /predictions').authorized).toBe(false);
      expect(autorizar(token, 'POST /alerts/acknowledge').authorized).toBe(false);
    });

    it('viewer: solo dashboard', () => {
      const token = makeToken('viewer');

      expect(autorizar(token, 'GET /dashboard').authorized).toBe(true);

      expect(autorizar(token, 'GET /metrics/realtime').authorized).toBe(false);
      expect(autorizar(token, 'GET /metrics/historical').authorized).toBe(false);
      expect(autorizar(token, 'GET /reports').authorized).toBe(false);
      expect(autorizar(token, 'GET /users').authorized).toBe(false);
    });
  });

  describe('Token expirado', () => {
    it('deniega acceso con token expirado hace 1 minuto', () => {
      const token = makeToken('admin', -60);
      const result = autorizar(token, 'GET /dashboard');
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('Token expirado');
    });
  });

  describe('Rate limiting integrado', () => {
    it('escenario: usuario hace 5 intentos fallidos y es bloqueado', () => {
      const now = Date.now();
      const attempts: AuthAttempt[] = [];

      // 5 intentos fallidos en 8 minutos
      for (let i = 0; i < 5; i++) {
        attempts.push({
          identifier: 'user-test',
          timestamp: now - (5 - i) * 90 * 1000, // Cada 1.5 min
          success: false,
          type: 'login',
        });
      }

      const result = evaluateLoginBlock(attempts, now);
      expect(result.blocked).toBe(true);
      expect(result.unblockAt).toBeGreaterThan(now);
    });

    it('escenario: usuario hace login exitoso entre fallos, no se bloquea', () => {
      const now = Date.now();
      const attempts: AuthAttempt[] = [
        { identifier: 'user', timestamp: now - 8 * 60 * 1000, success: false, type: 'login' },
        { identifier: 'user', timestamp: now - 6 * 60 * 1000, success: false, type: 'login' },
        { identifier: 'user', timestamp: now - 4 * 60 * 1000, success: true, type: 'login' },
        { identifier: 'user', timestamp: now - 2 * 60 * 1000, success: false, type: 'login' },
        { identifier: 'user', timestamp: now - 1 * 60 * 1000, success: false, type: 'login' },
      ];

      const result = evaluateLoginBlock(attempts, now);
      expect(result.blocked).toBe(false); // Solo 2 fallos después del éxito
    });

    it('escenario: IP bloqueada por 3 fallos rápidos', () => {
      const now = Date.now();
      const attempts: AuthAttempt[] = [
        { identifier: '192.168.1.100', timestamp: now - 120000, success: false, type: 'login' },
        { identifier: '192.168.1.100', timestamp: now - 60000, success: false, type: 'login' },
        { identifier: '192.168.1.100', timestamp: now - 30000, success: false, type: 'login' },
      ];

      const result = evaluateIpBlock(attempts, now);
      expect(result.blocked).toBe(true);
    });
  });
});
