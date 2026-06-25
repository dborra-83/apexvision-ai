/**
 * Detector de anomalías de rendimiento de ApexVision AI.
 *
 * Calcula Z-score sobre una ventana de 10 vueltas y genera alertas
 * cuando la desviación supera 2 desviaciones estándar.
 * Clasifica anomalías en: subviraje, sobreviraje, fatiga, degradación mecánica.
 *
 * Validates: Requirement 5.3
 */

import { AnomaliaClasificacion, ParametrosAnomalias } from './types';

/** Parámetros por defecto */
export const DEFAULT_PARAMS: ParametrosAnomalias = {
  ventanaVueltas: 10,
  umbralSigma: 2.0,
};

/**
 * Calcula la media de un array de valores.
 */
export function calcularMedia(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((sum, v) => sum + v, 0) / valores.length;
}

/**
 * Calcula la desviación estándar de un array de valores.
 */
export function calcularDesviacionEstandar(valores: number[]): number {
  if (valores.length < 2) return 0;
  const media = calcularMedia(valores);
  const sumaCuadrados = valores.reduce((sum, v) => sum + (v - media) ** 2, 0);
  return Math.sqrt(sumaCuadrados / (valores.length - 1));
}

/**
 * Calcula el Z-score de un valor dado su serie histórica.
 *
 * @param valorActual - Valor del frame/vuelta actual
 * @param historico - Valores de las últimas N vueltas
 * @returns Z-score (|valor - media| / desviación estándar)
 */
export function calcularZScore(valorActual: number, historico: number[]): number {
  if (historico.length < 2) return 0;

  const media = calcularMedia(historico);
  const desviacion = calcularDesviacionEstandar(historico);

  if (desviacion === 0) return 0;

  return (valorActual - media) / desviacion;
}

/**
 * Detecta si un valor actual representa una anomalía basándose en Z-score.
 *
 * @param valorActual - Valor actual de la métrica
 * @param historico - Valores de las últimas N vueltas
 * @param umbralSigma - Umbral de Z-score para considerar anomalía (default: 2.0)
 * @returns { esAnomalia, zScore }
 */
export function detectarAnomalia(
  valorActual: number,
  historico: number[],
  umbralSigma: number = DEFAULT_PARAMS.umbralSigma
): { esAnomalia: boolean; zScore: number } {
  const zScore = calcularZScore(valorActual, historico);
  return {
    esAnomalia: Math.abs(zScore) > umbralSigma,
    zScore,
  };
}

/**
 * Clasifica una anomalía según la métrica afectada y la dirección de la desviación.
 *
 * Reglas de clasificación:
 * - anguloDirection + Z positivo grande → sobreviraje
 * - anguloDirection + Z negativo grande → subviraje
 * - velocidadAparente + degradación progresiva → fatiga
 * - Cambio abrupto en múltiples métricas → degradación mecánica
 * - posicionLineaCarrera + Z positivo → subviraje (se abre)
 * - posicionLineaCarrera + Z negativo → sobreviraje (se cierra)
 *
 * @param metricaAfectada - Nombre de la métrica con anomalía
 * @param zScore - Z-score calculado (con signo)
 * @returns Clasificación de la anomalía
 */
export function clasificarAnomalia(
  metricaAfectada: string,
  zScore: number
): AnomaliaClasificacion {
  switch (metricaAfectada) {
    case 'anguloDirection':
      return zScore > 0 ? 'sobreviraje' : 'subviraje';

    case 'posicionLineaCarrera':
      return zScore > 0 ? 'subviraje' : 'sobreviraje';

    case 'velocidadAparente':
      // Velocidad baja → posible fatiga o degradación
      return zScore < 0 ? 'fatiga' : 'degradacion_mecanica';

    case 'desgasteNeumaticos':
      return 'degradacion_mecanica';

    case 'intensidadFrenado':
      // Frenado excesivo → posible problema mecánico
      return zScore > 0 ? 'degradacion_mecanica' : 'fatiga';

    default:
      return 'degradacion_mecanica';
  }
}
