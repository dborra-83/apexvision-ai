/**
 * Cálculo de desviación respecto a línea óptima de carrera.
 *
 * Calcula la distancia perpendicular mínima entre la posición
 * del vehículo y la línea óptima teórica del circuito.
 *
 * Validates: Requirement 3.3
 */

import { PuntoLineaOptima } from './types';

/**
 * Calcula la distancia euclidiana entre dos puntos.
 */
export function distanciaEuclidiana(
  p1: PuntoLineaOptima,
  p2: PuntoLineaOptima
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calcula la distancia perpendicular de un punto a un segmento de línea.
 *
 * Proyecta el punto sobre el segmento y calcula la distancia mínima.
 * Si la proyección cae fuera del segmento, usa la distancia al extremo más cercano.
 *
 * @param punto - Posición del vehículo
 * @param segmentoInicio - Inicio del segmento de línea óptima
 * @param segmentoFin - Fin del segmento de línea óptima
 * @returns Distancia perpendicular en metros
 */
export function distanciaPerpendicularASegmento(
  punto: PuntoLineaOptima,
  segmentoInicio: PuntoLineaOptima,
  segmentoFin: PuntoLineaOptima
): number {
  const dx = segmentoFin.x - segmentoInicio.x;
  const dy = segmentoFin.y - segmentoInicio.y;
  const longitudSegmento2 = dx * dx + dy * dy;

  // Si el segmento es un punto, retornar distancia al punto
  if (longitudSegmento2 === 0) {
    return distanciaEuclidiana(punto, segmentoInicio);
  }

  // Parámetro t de la proyección sobre el segmento [0, 1]
  let t = ((punto.x - segmentoInicio.x) * dx + (punto.y - segmentoInicio.y) * dy) / longitudSegmento2;
  t = Math.max(0, Math.min(1, t));

  // Punto proyectado sobre el segmento
  const proyeccion: PuntoLineaOptima = {
    x: segmentoInicio.x + t * dx,
    y: segmentoInicio.y + t * dy,
  };

  return distanciaEuclidiana(punto, proyeccion);
}

/**
 * Calcula la desviación mínima de un punto respecto a la línea óptima completa.
 *
 * Itera sobre todos los segmentos de la línea óptima y retorna la
 * distancia perpendicular mínima encontrada.
 *
 * @param posicionVehiculo - Posición del vehículo en coordenadas de pista (metros)
 * @param lineaOptima - Array de puntos que definen la línea óptima (≥ 2 puntos)
 * @returns Desviación en metros (≥ 0), redondeada a resolución 0.01m
 */
export function calcularDesviacionLineaOptima(
  posicionVehiculo: PuntoLineaOptima,
  lineaOptima: PuntoLineaOptima[]
): number {
  if (lineaOptima.length < 2) {
    // Si solo hay un punto, distancia directa
    if (lineaOptima.length === 1) {
      return roundToResolution(distanciaEuclidiana(posicionVehiculo, lineaOptima[0]), 0.01);
    }
    return 0;
  }

  let minDistancia = Infinity;

  for (let i = 0; i < lineaOptima.length - 1; i++) {
    const distancia = distanciaPerpendicularASegmento(
      posicionVehiculo,
      lineaOptima[i],
      lineaOptima[i + 1]
    );
    if (distancia < minDistancia) {
      minDistancia = distancia;
    }
  }

  return roundToResolution(minDistancia, 0.01);
}

/**
 * Redondea un valor a la resolución especificada.
 *
 * @param value - Valor a redondear
 * @param resolution - Resolución (e.g., 0.01 para centímetros)
 * @returns Valor redondeado
 */
export function roundToResolution(value: number, resolution: number): number {
  return Math.round(value / resolution) * resolution;
}
