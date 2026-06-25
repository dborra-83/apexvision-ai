import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  containsWildcard,
  validatePolicy,
  validateStatement,
  IamPolicyDocument,
  IamStatement,
} from '../../src/security/iam-validator';
import {
  evaluateIpBlock,
  DEFAULT_IP_BLOCK_CONFIG,
  IpAuthAttempt,
} from '../../src/security/ip-blocker';

// Arbitraries
const specificActionArb = fc.constantFrom(
  's3:GetObject', 's3:PutObject', 'dynamodb:PutItem', 'dynamodb:Query',
  'lambda:InvokeFunction', 'sagemaker:InvokeEndpoint', 'kinesis:PutRecord'
);

const specificResourceArb = fc.constantFrom(
  'arn:aws:s3:::my-bucket/*',
  'arn:aws:dynamodb:us-east-1:123456:table/my-table',
  'arn:aws:lambda:us-east-1:123456:function:my-func'
);

describe('Property Tests: Security', () => {
  // Feature: apexvision-ai-platform, Property 16: Detección de wildcards en políticas IAM
  // Si se detecta wildcard en Action o Resource de un Allow, la política se rechaza.
  // Si no contiene wildcards, se aprueba.
  describe('Property 16: Detección wildcards IAM', () => {
    it('política sin wildcards → valid=true', () => {
      fc.assert(
        fc.property(
          fc.array(specificActionArb, { minLength: 1, maxLength: 5 }),
          fc.array(specificResourceArb, { minLength: 1, maxLength: 3 }),
          (actions, resources) => {
            const policy: IamPolicyDocument = {
              Version: '2012-10-17',
              Statement: [{
                Effect: 'Allow',
                Action: actions,
                Resource: resources,
              }],
            };
            const result = validatePolicy(policy);
            return result.valid === true && result.violations.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Action = "*" → valid=false', () => {
      fc.assert(
        fc.property(specificResourceArb, (resource) => {
          const policy: IamPolicyDocument = {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: '*',
              Resource: resource,
            }],
          };
          const result = validatePolicy(policy);
          return result.valid === false && result.violations.some((v) => v.field === 'Action');
        }),
        { numRuns: 50 }
      );
    });

    it('Resource = "*" → valid=false', () => {
      fc.assert(
        fc.property(specificActionArb, (action) => {
          const policy: IamPolicyDocument = {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: action,
              Resource: '*',
            }],
          };
          const result = validatePolicy(policy);
          return result.valid === false && result.violations.some((v) => v.field === 'Resource');
        }),
        { numRuns: 50 }
      );
    });

    it('Deny con wildcard NO genera violación (es aceptable)', () => {
      fc.assert(
        fc.property(fc.boolean(), (_) => {
          const policy: IamPolicyDocument = {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Deny',
              Action: '*',
              Resource: '*',
            }],
          };
          const result = validatePolicy(policy);
          return result.valid === true;
        }),
        { numRuns: 10 }
      );
    });

    it('containsWildcard detecta correctamente', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant('*'), specificActionArb),
          (value) => {
            const isWild = containsWildcard(value);
            return isWild === (value === '*');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: apexvision-ai-platform, Property 17: Bloqueo de IP por intentos fallidos
  // 3 fallos consecutivos en 5 minutos → bloqueo 15 min.
  // Si no son consecutivos (éxito intermedio) o separados > 5min → no bloqueo.
  describe('Property 17: Bloqueo de IP', () => {
    it('3 fallos consecutivos en 5 min → IP bloqueada', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (numFailures) => {
            const now = Date.now();
            const attempts: IpAuthAttempt[] = Array.from({ length: numFailures }, (_, i) => ({
              ip: '192.168.1.1',
              timestamp: now - (numFailures - i) * 30000, // Cada 30s, dentro de 5min
              success: false,
            }));

            const result = evaluateIpBlock(attempts, now);
            return result.blocked === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('< 3 fallos → NO bloqueada', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          (numFailures) => {
            const now = Date.now();
            const attempts: IpAuthAttempt[] = Array.from({ length: numFailures }, (_, i) => ({
              ip: '192.168.1.1',
              timestamp: now - (numFailures - i) * 30000,
              success: false,
            }));

            const result = evaluateIpBlock(attempts, now);
            return result.blocked === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('éxito intermedio resetea conteo de fallos', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 2 }),
          fc.integer({ min: 1, max: 2 }),
          (failsBefore, failsAfter) => {
            const now = Date.now();
            const attempts: IpAuthAttempt[] = [];

            // Fallos antes
            for (let i = 0; i < failsBefore; i++) {
              attempts.push({
                ip: '192.168.1.1',
                timestamp: now - (failsBefore + failsAfter + 1 - i) * 30000,
                success: false,
              });
            }
            // Éxito
            attempts.push({
              ip: '192.168.1.1',
              timestamp: now - (failsAfter + 1) * 30000,
              success: true,
            });
            // Fallos después
            for (let i = 0; i < failsAfter; i++) {
              attempts.push({
                ip: '192.168.1.1',
                timestamp: now - (failsAfter - i) * 30000,
                success: false,
              });
            }

            const result = evaluateIpBlock(attempts, now);
            // Solo los fallos después del éxito cuentan (< 3)
            return result.blocked === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('bloqueo expira después de 15 minutos', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 60 }),
          (minutesAfter) => {
            const now = Date.now();
            // 3 fallos hace > 15 minutos
            const failTime = now - minutesAfter * 60 * 1000;
            const attempts: IpAuthAttempt[] = [
              { ip: '10.0.0.1', timestamp: failTime, success: false },
              { ip: '10.0.0.1', timestamp: failTime + 1000, success: false },
              { ip: '10.0.0.1', timestamp: failTime + 2000, success: false },
            ];

            const result = evaluateIpBlock(attempts, now);
            // Si los fallos están fuera de la ventana de 5 min, no cuentan
            // O si el bloqueo ya expiró (>15 min desde el último fallo)
            return result.blocked === false;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
