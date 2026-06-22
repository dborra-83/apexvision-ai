/**
 * Tipos del sistema de alertas de ApexVision AI.
 */

/** Niveles de severidad de alertas */
export type Severidad = 'critica' | 'alta' | 'media' | 'informativa';

/** Alerta individual */
export interface Alerta {
  alertaId: string;
  tipo: string;
  severidad: Severidad;
  pilotoId: string;
  sessionId: string;
  timestamp: number;
  payload: Record<string, unknown>;
  destinatarios: string[];
  ttlEntrega: number;
}

/** Alerta agrupada (consolidación de múltiples alertas del mismo tipo) */
export interface AlertaAgrupada {
  alertaId: string;
  tipo: string;
  pilotoId: string;
  totalOcurrencias: number;
  timestampPrimera: number;
  timestampUltima: number;
  severidad: Severidad;
}

/** Regla de agrupación */
export interface ReglaAgrupacion {
  umbralAlertas: number;
  ventanaSegundos: number;
  claveAgrupacion: string[];
}

/** SLA de entrega por severidad (milisegundos) */
export const SLA_ENTREGA_MS: Record<Severidad, number> = {
  critica: 500,
  alta: 500,
  media: 2000,
  informativa: 5000,
};

/** Resultado de intento de entrega */
export interface DeliveryResult {
  success: boolean;
  attempt: number;
  timestamp: number;
  error?: string;
}
