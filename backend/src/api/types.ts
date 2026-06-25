/**
 * Tipos de la capa de API de ApexVision AI.
 */

/** Mensaje WebSocket: actualización de métrica */
export interface WsMetricaUpdate {
  action: 'metrica_update';
  pilotoId: string;
  timestamp: number;
  metricas: Record<string, number>;
}

/** Mensaje WebSocket: alerta */
export interface WsAlerta {
  action: 'alerta';
  alertaId: string;
  tipo: string;
  severidad: string;
  pilotoId: string;
  texto?: string;
  audible: boolean;
}

/** Mensaje WebSocket: insight GenAI */
export interface WsInsight {
  action: 'insight';
  insightId: string;
  pilotoId: string;
  texto: string;
  tipo: string;
  timestamp: number;
}

/** Mensaje WebSocket: predicción */
export interface WsPrediccion {
  action: 'prediccion';
  pilotoId: string;
  tipo: 'pit_stop' | 'adelantamiento';
  datos: Record<string, unknown>;
}

/** Registro de conexión WebSocket */
export interface WsConnection {
  connectionId: string;
  userId: string;
  rol: string;
  connectedAt: number;
  subscriptions: string[];  // pilotoIds suscritos
  ttl: number;
}

/** Tipo de mensaje WebSocket */
export type WsMessage = WsMetricaUpdate | WsAlerta | WsInsight | WsPrediccion;
