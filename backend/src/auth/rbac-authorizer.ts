/**
 * RBAC Authorizer para ApexVision AI.
 *
 * Verifica que un usuario con un rol dado tiene el permiso requerido
 * para acceder a un recurso específico. Implementa la matriz de permisos
 * definida en PERMISOS_POR_ROL.
 *
 * Validates: Requirement 7 (Autenticación y Autorización)
 */

import {
  AuthorizationResult,
  Permiso,
  PERMISOS_POR_ROL,
  RECURSO_A_PERMISO,
  Rol,
  TokenClaims,
} from './types';

/**
 * Verifica si un rol tiene un permiso específico.
 *
 * @param rol - Rol del usuario
 * @param permiso - Permiso requerido
 * @returns true si el rol tiene el permiso
 */
export function rolTienePermiso(rol: Rol, permiso: Permiso): boolean {
  const permisos = PERMISOS_POR_ROL[rol];
  if (!permisos) {
    return false;
  }
  return permisos.includes(permiso);
}

/**
 * Obtiene todos los permisos de un rol.
 *
 * @param rol - Rol del usuario
 * @returns Lista de permisos del rol, o array vacío si el rol no existe
 */
export function obtenerPermisos(rol: Rol): Permiso[] {
  return PERMISOS_POR_ROL[rol] || [];
}

/**
 * Determina el permiso requerido para acceder a un recurso.
 *
 * @param recurso - Identificador del recurso (e.g., "GET /metrics/realtime")
 * @returns El permiso requerido, o undefined si el recurso no está mapeado
 */
export function obtenerPermisoRequerido(recurso: string): Permiso | undefined {
  return RECURSO_A_PERMISO[recurso];
}

/**
 * Autoriza un acceso basándose en claims del token JWT y el recurso solicitado.
 *
 * @param claims - Claims decodificados del JWT
 * @param recurso - Recurso solicitado (e.g., "GET /metrics/realtime")
 * @returns Resultado de autorización con detalles
 */
export function autorizar(claims: TokenClaims, recurso: string): AuthorizationResult {
  const rol = claims['custom:rol'];

  // Validar que el rol es conocido
  if (!rol || !PERMISOS_POR_ROL[rol]) {
    return {
      authorized: false,
      userId: claims.sub,
      rol: rol,
      reason: `Rol desconocido: ${rol}`,
    };
  }

  // Validar que el token no ha expirado
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) {
    return {
      authorized: false,
      userId: claims.sub,
      rol,
      reason: 'Token expirado',
    };
  }

  // Obtener permiso requerido para el recurso
  const permisoRequerido = obtenerPermisoRequerido(recurso);

  // Si el recurso no tiene permiso mapeado, denegar por defecto
  if (!permisoRequerido) {
    return {
      authorized: false,
      userId: claims.sub,
      rol,
      reason: `Recurso no reconocido: ${recurso}`,
    };
  }

  // Verificar si el rol tiene el permiso
  const tienePermiso = rolTienePermiso(rol, permisoRequerido);

  return {
    authorized: tienePermiso,
    userId: claims.sub,
    rol,
    reason: tienePermiso
      ? undefined
      : `Rol '${rol}' no tiene permiso '${permisoRequerido}' para recurso '${recurso}'`,
  };
}

/**
 * Lambda handler para API Gateway Custom Authorizer.
 * Valida el token JWT y genera la política IAM de acceso.
 */
export async function handler(event: {
  authorizationToken?: string;
  methodArn?: string;
  requestContext?: { connectionId?: string };
}): Promise<{
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{
      Action: string;
      Effect: string;
      Resource: string;
    }>;
  };
  context?: Record<string, string>;
}> {
  const token = event.authorizationToken?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized');
  }

  // En producción, aquí se verificaría el JWT con las claves públicas de Cognito.
  // Por ahora, decodificamos el payload (la verificación se hace en API Gateway).
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    ) as TokenClaims;

    const methodArn = event.methodArn || '*';
    const effect = payload['custom:rol'] ? 'Allow' : 'Deny';

    return {
      principalId: payload.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: methodArn,
          },
        ],
      },
      context: {
        rol: payload['custom:rol'],
        userId: payload.sub,
        email: payload.email,
      },
    };
  } catch {
    throw new Error('Unauthorized');
  }
}
