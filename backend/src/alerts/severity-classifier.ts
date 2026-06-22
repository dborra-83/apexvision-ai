/**
 * Clasificador de severidad de alertas de ApexVision AI.
 *
 * Asigna exactamente una severidad a cada alerta según su tipo y contexto.
 * Define el TTL de entrega máximo por severidad.
 *
 * Validates: Requirements 9.2, 9.3
 */

import { Severidad, SLA_ENTREGA_MS } from './types';

/** Tipos de alerta conocidos */
export type TipoAlerta =
  | 'anomalia_rendimiento'
  | 'pit_stop_inminente'
  | 'ventana_adelantamiento'
  | 'degradacion_neumaticos'
  | 'desconexion_stream'
  | 'degradacion_servicio'
  | 'metrica_fuera_rango';

/** Configuración de clasificación por tipo */
interface ClasificacionConfig {
  severidadBase: Severidad;
  condicionEscalado?: (context: AlertContext) => boolean;
  severidadEscalada?: Severidad;
}

/** Contexto para evaluación de severidad */
export interface AlertContext {
  tipo: TipoAlerta;
  pilotoId: string;
  desviacionSigma?: number;
  vueltasParaPit?: number;
  esUltimasVueltas?: boolean;
}

/** Mapa de clasificación por tipo de alerta */
const CLASIFICACIONES: Record<TipoAlerta, ClasificacionConfig> = {
  anomalia_rendimiento: {
    severidadBase: 'alta',
    condicionEscalado: (ctx) => (ctx.desviacionSigma ?? 0) > 3.0,
    severidadEscalada: 'critica',
  },
  pit_stop_inminente: {
    severidadBase: 'alta',
  },
  ventana_adelantamiento: {
    severidadBase: 'media',
    condicionEscalado: (ctx) => ctx.esUltimasVueltas === true,
    severidadEscalada: 'alta',
  },
  degradacion_neumaticos: {
    severidadBase: 'media',
    condicionEscalado: (ctx) => (ctx.vueltasParaPit ?? Infinity) <= 3,
    severidadEscalada: 'alta',
  },
  desconexion_stream: {
    severidadBase: 'alta',
  },
  degradacion_servicio: {
    severidadBase: 'critica',
  },
  metrica_fuera_rango: {
    severidadBase: 'informativa',
  },
};

/**
 * Clasifica la severidad de una alerta.
 *
 * @param context - Contexto de la alerta
 * @returns Severidad asignada (exactamente una)
 */
export function clasificarSeveridad(context: AlertContext): Severidad {
  const config = CLASIFICACIONES[context.tipo];

  if (!config) {
    return 'informativa';
  }

  // Verificar si se debe escalar
  if (config.condicionEscalado && config.severidadEscalada) {
    if (config.condicionEscalado(context)) {
      return config.severidadEscalada;
    }
  }

  return config.severidadBase;
}

/**
 * Obtiene el TTL de entrega máximo para una severidad dada.
 *
 * @param severidad - Nivel de severidad
 * @returns TTL en milisegundos
 */
export function obtenerTtlEntrega(severidad: Severidad): number {
  return SLA_ENTREGA_MS[severidad];
}

/**
 * Determina si una alerta requiere notificación audible.
 * Solo alertas críticas y altas tienen notificación audible.
 *
 * @param severidad - Nivel de severidad
 * @returns true si requiere notificación audible
 */
export function requiereNotificacionAudible(severidad: Severidad): boolean {
  return severidad === 'critica' || severidad === 'alta';
}
