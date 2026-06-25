/**
 * Agrupador de alertas de ApexVision AI.
 *
 * Agrupa alertas del mismo tipo para el mismo piloto cuando se superan
 * 10 alertas en un período de 60 segundos, consolidándolas en un único
 * evento para evitar saturación del operador.
 *
 * Validates: Requirement 9.5
 */

import { Alerta, AlertaAgrupada, ReglaAgrupacion } from './types';

/** Regla de agrupación por defecto */
export const DEFAULT_GROUPING_RULE: ReglaAgrupacion = {
  umbralAlertas: 10,
  ventanaSegundos: 60,
  claveAgrupacion: ['tipo', 'pilotoId'],
};

/** Buffer interno de alertas por clave de agrupación */
export interface AlertBuffer {
  clave: string;
  alertas: Alerta[];
  primeraTimestamp: number;
  ultimaTimestamp: number;
}

/**
 * Genera la clave de agrupación para una alerta.
 *
 * @param alerta - Alerta a agrupar
 * @param campos - Campos para generar la clave
 * @returns Clave string (e.g., "anomalia_rendimiento|pilot-1")
 */
export function generarClaveAgrupacion(
  alerta: Alerta,
  campos: string[] = DEFAULT_GROUPING_RULE.claveAgrupacion
): string {
  return campos
    .map((campo) => (alerta as Record<string, unknown>)[campo] ?? '')
    .join('|');
}

/**
 * Evalúa si un buffer de alertas debe ser agrupado.
 *
 * @param buffer - Buffer de alertas acumuladas
 * @param regla - Regla de agrupación
 * @returns true si se debe agrupar (> umbral alertas en la ventana)
 */
export function debeAgrupar(
  buffer: AlertBuffer,
  regla: ReglaAgrupacion = DEFAULT_GROUPING_RULE
): boolean {
  return buffer.alertas.length > regla.umbralAlertas;
}

/**
 * Filtra las alertas del buffer que están dentro de la ventana temporal.
 *
 * @param alertas - Lista de alertas
 * @param now - Timestamp actual
 * @param ventanaSegundos - Ventana temporal en segundos
 * @returns Alertas dentro de la ventana
 */
export function filtrarPorVentana(
  alertas: Alerta[],
  now: number,
  ventanaSegundos: number = DEFAULT_GROUPING_RULE.ventanaSegundos
): Alerta[] {
  const windowStart = now - ventanaSegundos * 1000;
  return alertas.filter((a) => a.timestamp >= windowStart);
}

/**
 * Procesa una nueva alerta y decide si entregarla individualmente
 * o consolidarla en un grupo.
 *
 * @param nuevaAlerta - Alerta entrante
 * @param buffers - Map de buffers por clave de agrupación
 * @param regla - Regla de agrupación
 * @returns { tipo: 'individual' | 'agrupada', resultado }
 */
export function procesarAlerta(
  nuevaAlerta: Alerta,
  buffers: Map<string, AlertBuffer>,
  regla: ReglaAgrupacion = DEFAULT_GROUPING_RULE
): { tipo: 'individual'; alerta: Alerta } | { tipo: 'agrupada'; grupo: AlertaAgrupada } {
  const clave = generarClaveAgrupacion(nuevaAlerta, regla.claveAgrupacion);
  const now = nuevaAlerta.timestamp;

  // Obtener o crear buffer
  let buffer = buffers.get(clave);
  if (!buffer) {
    buffer = {
      clave,
      alertas: [],
      primeraTimestamp: now,
      ultimaTimestamp: now,
    };
    buffers.set(clave, buffer);
  }

  // Limpiar alertas fuera de la ventana
  buffer.alertas = filtrarPorVentana(buffer.alertas, now, regla.ventanaSegundos);

  // Agregar nueva alerta al buffer
  buffer.alertas.push(nuevaAlerta);
  buffer.ultimaTimestamp = now;
  if (buffer.alertas.length === 1) {
    buffer.primeraTimestamp = now;
  } else {
    buffer.primeraTimestamp = buffer.alertas[0].timestamp;
  }

  // Evaluar si se debe agrupar
  if (debeAgrupar(buffer, regla)) {
    const grupo: AlertaAgrupada = {
      alertaId: `group-${clave}-${now}`,
      tipo: nuevaAlerta.tipo,
      pilotoId: nuevaAlerta.pilotoId,
      totalOcurrencias: buffer.alertas.length,
      timestampPrimera: buffer.primeraTimestamp,
      timestampUltima: buffer.ultimaTimestamp,
      severidad: nuevaAlerta.severidad,
    };

    // Limpiar el buffer después de agrupar
    buffer.alertas = [];

    return { tipo: 'agrupada', grupo };
  }

  // Entregar individualmente
  return { tipo: 'individual', alerta: nuevaAlerta };
}
