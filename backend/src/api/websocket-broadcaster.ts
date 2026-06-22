/**
 * WebSocket Broadcaster de ApexVision AI.
 *
 * Envía mensajes a clientes WebSocket conectados filtrados
 * por sus suscripciones a pilotos específicos.
 *
 * Validates: Requirements 6.1, 6.3
 */

import { WsConnection, WsMessage } from './types';

/** Resultado del broadcast */
export interface BroadcastResult {
  totalConnections: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  staleConnections: string[];  // connectionIds con error 410 (Gone)
}

/**
 * Filtra conexiones que deben recibir un mensaje para un piloto específico.
 *
 * @param connections - Todas las conexiones activas
 * @param pilotoId - ID del piloto del mensaje
 * @returns Conexiones suscritas a ese piloto (o sin filtro si no hay suscripciones)
 */
export function filterConnectionsByPiloto(
  connections: WsConnection[],
  pilotoId: string
): WsConnection[] {
  return connections.filter((conn) => {
    // Si no tiene suscripciones específicas, recibe todo
    if (conn.subscriptions.length === 0) return true;
    // Si tiene suscripciones, solo recibe del piloto suscrito
    return conn.subscriptions.includes(pilotoId);
  });
}

/**
 * Filtra conexiones por rol para alertas que requieren permisos específicos.
 *
 * @param connections - Conexiones candidatas
 * @param rolesPermitidos - Roles que pueden ver este tipo de alerta
 * @returns Conexiones con roles válidos
 */
export function filterConnectionsByRole(
  connections: WsConnection[],
  rolesPermitidos: string[]
): WsConnection[] {
  return connections.filter((conn) => rolesPermitidos.includes(conn.rol));
}

/**
 * Construye el payload de mensaje WebSocket.
 *
 * @param message - Mensaje a enviar
 * @returns JSON string del mensaje
 */
export function buildMessagePayload(message: WsMessage): string {
  return JSON.stringify(message);
}

/**
 * Simula el envío de un mensaje a una conexión WebSocket.
 * En producción usa ApiGatewayManagementApi.postToConnection().
 *
 * @param connectionId - ID de la conexión
 * @param payload - Mensaje serializado
 * @returns true si el envío fue exitoso
 */
export async function sendToConnection(
  connectionId: string,
  payload: string
): Promise<{ success: boolean; isGone: boolean }> {
  // En producción:
  // const client = new ApiGatewayManagementApiClient({ endpoint });
  // await client.send(new PostToConnectionCommand({ ConnectionId, Data: payload }));
  // Catch GoneException → { success: false, isGone: true }

  // Placeholder: siempre exitoso en dev
  return { success: true, isGone: false };
}

/**
 * Ejecuta el broadcast de un mensaje a todas las conexiones relevantes.
 *
 * @param message - Mensaje a enviar
 * @param connections - Conexiones activas
 * @param pilotoId - ID del piloto (para filtrado)
 * @returns Resultado del broadcast
 */
export async function broadcast(
  message: WsMessage,
  connections: WsConnection[],
  pilotoId: string
): Promise<BroadcastResult> {
  const targetConnections = filterConnectionsByPiloto(connections, pilotoId);
  const payload = buildMessagePayload(message);

  const result: BroadcastResult = {
    totalConnections: targetConnections.length,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    staleConnections: [],
  };

  const deliveryPromises = targetConnections.map(async (conn) => {
    const { success, isGone } = await sendToConnection(conn.connectionId, payload);
    if (success) {
      result.successfulDeliveries++;
    } else {
      result.failedDeliveries++;
      if (isGone) {
        result.staleConnections.push(conn.connectionId);
      }
    }
  });

  await Promise.all(deliveryPromises);

  return result;
}
