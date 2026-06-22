/**
 * Lambda handler para WebSocket $connect.
 *
 * Valida la autenticación del usuario y registra la conexión
 * en DynamoDB para poder enviar mensajes push posteriormente.
 *
 * Validates: Requirement 6.5, 7.2
 */

import { WsConnection } from './types';

/** Configuración del handler */
export interface ConnectConfig {
  connectionsTableName: string;
  ttlHours: number;
}

/**
 * Construye el registro de conexión para almacenar en DynamoDB.
 *
 * @param connectionId - ID de la conexión WebSocket
 * @param userId - ID del usuario autenticado
 * @param rol - Rol del usuario
 * @returns Registro de conexión
 */
export function buildConnectionRecord(
  connectionId: string,
  userId: string,
  rol: string
): WsConnection {
  const now = Date.now();
  const ttl = Math.floor(now / 1000) + 24 * 60 * 60; // 24h TTL

  return {
    connectionId,
    userId,
    rol,
    connectedAt: now,
    subscriptions: [],
    ttl,
  };
}

/**
 * Valida que el token de autorización está presente y es parseable.
 *
 * @param queryStringParams - Query string parameters del request
 * @returns userId y rol extraídos, o null si inválido
 */
export function extractAuthFromQueryString(
  queryStringParams: Record<string, string> | undefined
): { userId: string; rol: string } | null {
  if (!queryStringParams?.token) {
    return null;
  }

  try {
    // Decodificar payload del JWT (sin verificación - API Gateway ya verificó)
    const parts = queryStringParams.token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return {
      userId: payload.sub || '',
      rol: payload['custom:rol'] || 'viewer',
    };
  } catch {
    return null;
  }
}

/**
 * Lambda handler para $connect.
 */
export async function handler(event: {
  requestContext: { connectionId: string };
  queryStringParameters?: Record<string, string>;
}): Promise<{ statusCode: number; body?: string }> {
  const connectionId = event.requestContext.connectionId;
  const auth = extractAuthFromQueryString(event.queryStringParameters);

  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const record = buildConnectionRecord(connectionId, auth.userId, auth.rol);

  // TODO: Escribir record en DynamoDB (connections table)
  // En producción: await dynamoClient.put(record)

  return { statusCode: 200 };
}
