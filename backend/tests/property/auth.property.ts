import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  rolTienePermiso,
  autorizar,
} from '../../src/auth/rbac-authorizer';
import {
  evaluateBlock,
  LOGIN_CONFIG,
  MFA_CONFIG,
  IP_BLOCK_CONFIG,
} from '../../src/auth/rate-limiter';
import {
  PERMISOS_POR_ROL,
  Permiso,
  Rol,
  TokenClaims,
  AuthAttempt,
} from '../../src/auth/types';

// Arbitraries
const rolArb = fc.constantFrom<Rol>('admin', 'ingeniero_pista', 'analista', 'viewer');

const allPermisos: Permiso[] = [
  'dashboard:read', 'metricas:realtime', 'metricas:historicas',
  'estrategia:read', 'alertas:read', 'alertas:acknowledge',
  'reportes:generar', 'reportes:exportar', 'usuarios:gestionar', 'config:modificar',
];
const permisoArb = fc.constantFrom<Permiso>(...allPermisos);

const authAttemptArb = (now: number): fc.Arbitrary<AuthAttempt> =>
  fc.record({
    identifier: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.integer({ min: now - 20 * 60 * 1000, max: now }),
    success: fc.boolean(),
    type: fc.constantFrom<'login' | 'mfa'>('login', 'mfa'),
  });

describe('Property Tests: Auth', () => {
  // Feature: apexvision-ai-platform, Property 12: RBAC Authorization
  // Para cualquier combinación de (rol, recurso), el sistema debe conceder acceso
  // si y solo si el permiso requerido está incluido en PERMISOS_POR_ROL para ese rol.
  describe('Property 12: RBAC Authorization', () => {
    it('acceso concedido iff permiso en PERMISOS_POR_ROL', () => {
      fc.assert(
        fc.property(rolArb, permisoArb, (rol, permiso) => {
          const result = rolTienePermiso(rol, permiso);
          const expected = PERMISOS_POR_ROL[rol].includes(permiso);
          return result === expected;
        }),
        { numRuns: 200 }
      );
    });

    it('ningún rol obtiene permisos no asignados', () => {
      fc.assert(
        fc.property(rolArb, permisoArb, (rol, permiso) => {
          if (!PERMISOS_POR_ROL[rol].includes(permiso)) {
            return rolTienePermiso(rol, permiso) === false;
          }
          return true;
        }),
        { numRuns: 200 }
      );
    });

    it('viewer solo tiene dashboard:read', () => {
      fc.assert(
        fc.property(permisoArb, (permiso) => {
          const result = rolTienePermiso('viewer', permiso);
          if (permiso === 'dashboard:read') {
            return result === true;
          }
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    it('admin tiene todos los permisos', () => {
      fc.assert(
        fc.property(permisoArb, (permiso) => {
          return rolTienePermiso('admin', permiso) === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 13: Rate Limiting Authentication
  // Para cualquier secuencia de intentos, si N fallos consecutivos en ventana T,
  // la cuenta se bloquea por D. (N=5, T=10min, D=30min) para login,
  // (N=3, T=sesión, D=15min) para MFA.
  describe('Property 13: Rate Limiting', () => {
    it('login: N fallos consecutivos en ventana T → bloqueo', () => {
      const now = Date.now();

      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          (numFailures) => {
            // Generar N fallos dentro de la ventana de 10 minutos
            const attempts: AuthAttempt[] = Array.from({ length: numFailures }, (_, i) => ({
              identifier: 'user-test',
              timestamp: now - (numFailures - i) * 60 * 1000, // Espaciados 1 min
              success: false,
              type: 'login' as const,
            }));

            // Solo los que caen dentro de la ventana cuentan
            const windowStart = now - LOGIN_CONFIG.windowMs;
            const inWindow = attempts.filter((a) => a.timestamp >= windowStart);

            const result = evaluateBlock(attempts, LOGIN_CONFIG, now);

            if (inWindow.length >= LOGIN_CONFIG.maxAttempts) {
              // Debe estar bloqueado (si no ha expirado)
              return result.blocked === true;
            }
            return true; // No aplica
          }
        ),
        { numRuns: 100 }
      );
    });

    it('login: un éxito intermedio resetea el conteo', () => {
      const now = Date.now();

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 4 }),
          fc.integer({ min: 1, max: 4 }),
          (failsBefore, failsAfter) => {
            const attempts: AuthAttempt[] = [];

            // Fallos antes del éxito
            for (let i = 0; i < failsBefore; i++) {
              attempts.push({
                identifier: 'user-test',
                timestamp: now - (failsBefore + failsAfter + 1 - i) * 30 * 1000,
                success: false,
                type: 'login',
              });
            }

            // Un éxito
            attempts.push({
              identifier: 'user-test',
              timestamp: now - (failsAfter + 1) * 30 * 1000,
              success: true,
              type: 'login',
            });

            // Fallos después del éxito
            for (let i = 0; i < failsAfter; i++) {
              attempts.push({
                identifier: 'user-test',
                timestamp: now - (failsAfter - i) * 30 * 1000,
                success: false,
                type: 'login',
              });
            }

            const result = evaluateBlock(attempts, LOGIN_CONFIG, now);

            // Solo cuentan los fallos DESPUÉS del éxito
            if (failsAfter < LOGIN_CONFIG.maxAttempts) {
              return result.blocked === false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('MFA: 3 fallos consecutivos → bloqueo 15 min', () => {
      const now = Date.now();

      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (numFailures) => {
            const attempts: AuthAttempt[] = Array.from({ length: numFailures }, (_, i) => ({
              identifier: 'user-test',
              timestamp: now - (numFailures - i) * 5000,
              success: false,
              type: 'mfa' as const,
            }));

            const result = evaluateBlock(attempts, MFA_CONFIG, now);
            return result.blocked === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('MFA: menos de 3 fallos → no bloqueo', () => {
      const now = Date.now();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          (numFailures) => {
            const attempts: AuthAttempt[] = Array.from({ length: numFailures }, (_, i) => ({
              identifier: 'user-test',
              timestamp: now - (numFailures - i) * 5000,
              success: false,
              type: 'mfa' as const,
            }));

            const result = evaluateBlock(attempts, MFA_CONFIG, now);
            return result.blocked === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('bloqueo expira después de la duración configurada', () => {
      const now = Date.now();

      fc.assert(
        fc.property(
          fc.integer({ min: 31, max: 120 }), // Minutos después del bloqueo
          (minutesAfter) => {
            // 5 fallos hace mucho tiempo
            const attemptTime = now - minutesAfter * 60 * 1000;
            const attempts: AuthAttempt[] = Array.from({ length: 5 }, (_, i) => ({
              identifier: 'user-test',
              timestamp: attemptTime + i * 1000,
              success: false,
              type: 'login' as const,
            }));

            const result = evaluateBlock(attempts, LOGIN_CONFIG, now);
            // Si han pasado más de 30 min desde el bloqueo, debe estar desbloqueado
            // Pero también los intentos deben estar dentro de la ventana de 10 min
            // Si attemptTime < windowStart, no están en la ventana → no blocked
            return result.blocked === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
