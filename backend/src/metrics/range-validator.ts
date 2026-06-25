/**
 * Validador de rangos físicos para métricas de ApexVision AI.
 *
 * Verifica que cada métrica calculada está dentro de los rangos
 * físicamente posibles definidos para el circuito. Marca valores
 * anómalos y los excluye de promedios.
 *
 * Validates: Requirement 3.4
 */

import { MetricValues, RangosMetricas, ValidacionMetrica } from './types';

/**
 * Valida un valor individual contra un rango definido.
 *
 * @param metrica - Nombre de la métrica
 * @param valor - Valor calculado
 * @param min - Valor mínimo permitido
 * @param max - Valor máximo permitido
 * @returns Resultado de validación
 */
export function validarValor(
  metrica: string,
  valor: number,
  min: number,
  max: number
): ValidacionMetrica {
  return {
    metrica,
    valor,
    rangoMin: min,
    rangoMax: max,
    esValido: valor >= min && valor <= max,
  };
}

/**
 * Valida todas las métricas de un frame contra los rangos del circuito.
 *
 * @param metricas - Valores de métricas calculados
 * @param rangos - Rangos válidos definidos para el circuito
 * @returns Lista de validaciones (una por métrica)
 */
export function validarMetricas(
  metricas: MetricValues,
  rangos: RangosMetricas
): ValidacionMetrica[] {
  return [
    validarValor('velocidadAparente', metricas.velocidadAparente, rangos.velocidadAparente.min, rangos.velocidadAparente.max),
    validarValor('posicionLineaCarrera', metricas.posicionLineaCarrera, rangos.posicionLineaCarrera.min, rangos.posicionLineaCarrera.max),
    validarValor('intensidadFrenado', metricas.intensidadFrenado, rangos.intensidadFrenado.min, rangos.intensidadFrenado.max),
    validarValor('anguloDirection', metricas.anguloDirection, rangos.anguloDirection.min, rangos.anguloDirection.max),
    validarValor('desgasteNeumaticos', metricas.desgasteNeumaticos, rangos.desgasteNeumaticos.min, rangos.desgasteNeumaticos.max),
  ];
}

/**
 * Determina si un conjunto de métricas es globalmente válido.
 * Retorna true solo si TODAS las métricas están dentro de rango.
 */
export function sonMetricasValidas(
  metricas: MetricValues,
  rangos: RangosMetricas
): boolean {
  const validaciones = validarMetricas(metricas, rangos);
  return validaciones.every((v) => v.esValido);
}

/**
 * Obtiene la lista de nombres de métricas que están fuera de rango.
 */
export function obtenerMetricasAnomelas(
  metricas: MetricValues,
  rangos: RangosMetricas
): string[] {
  const validaciones = validarMetricas(metricas, rangos);
  return validaciones
    .filter((v) => !v.esValido)
    .map((v) => v.metrica);
}
