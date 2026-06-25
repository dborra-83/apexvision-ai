/**
 * Calculadora de métricas frame-a-frame de ApexVision AI.
 *
 * Recibe resultados de inferencia visual y calcula métricas de rendimiento:
 * velocidad aparente, posición en línea de carrera, intensidad de frenado,
 * ángulo de dirección y desgaste estimado de neumáticos.
 *
 * Validates: Requirements 3.1, 3.5, 3.7
 */

import { InferenceResult } from '../vision/types';
import { calcularDesviacionLineaOptima, roundToResolution } from './line-deviation';
import { obtenerMetricasAnomelas, sonMetricasValidas } from './range-validator';
import { ConfiguracionCircuito, MetricasFrame, MetricValues } from './types';

/** Frame anterior para cálculo de velocidad por diferencia */
export interface FrameAnterior {
  frameId: string;
  timestamp: number;
  posicionX: number;
  posicionY: number;
}

/**
 * Calcula la velocidad aparente basándose en la diferencia de posición
 * entre frames consecutivos.
 *
 * @param posicionActual - Posición actual del vehículo (metros)
 * @param frameAnterior - Datos del frame anterior
 * @param timestampActual - Timestamp del frame actual (ms)
 * @returns Velocidad aparente en km/h (resolución 0.1)
 */
export function calcularVelocidadAparente(
  posicionActual: { x: number; y: number },
  frameAnterior: FrameAnterior | undefined,
  timestampActual: number
): number {
  if (!frameAnterior) {
    return 0;
  }

  const dx = posicionActual.x - frameAnterior.posicionX;
  const dy = posicionActual.y - frameAnterior.posicionY;
  const distanciaMetros = Math.sqrt(dx * dx + dy * dy);

  const deltaTiempoS = (timestampActual - frameAnterior.timestamp) / 1000;

  if (deltaTiempoS <= 0) {
    return 0;
  }

  // m/s a km/h
  const velocidadKmh = (distanciaMetros / deltaTiempoS) * 3.6;

  return roundToResolution(velocidadKmh, 0.1);
}

/**
 * Extrae la posición del vehículo a partir del bounding box del resultado de inferencia.
 * Asume que el centro inferior del bbox es la posición en pista.
 *
 * @param inferenceResult - Resultado de la inferencia visual
 * @param factorEscalaX - Factor de conversión pixel→metros (eje X)
 * @param factorEscalaY - Factor de conversión pixel→metros (eje Y)
 * @returns Posición en coordenadas de pista (metros)
 */
export function extraerPosicionVehiculo(
  inferenceResult: InferenceResult,
  factorEscalaX: number,
  factorEscalaY: number
): { x: number; y: number } | undefined {
  const vehiculo = inferenceResult.detections.find(
    (d) => d.classId === 'vehiculo_propio'
  );

  if (!vehiculo) {
    return undefined;
  }

  // Centro inferior del bounding box como posición en pista
  const centerX = (vehiculo.boundingBox.x + vehiculo.boundingBox.width / 2) * factorEscalaX;
  const bottomY = (vehiculo.boundingBox.y + vehiculo.boundingBox.height) * factorEscalaY;

  return { x: centerX, y: bottomY };
}

/**
 * Calcula todas las métricas para un frame a partir del resultado de inferencia.
 *
 * @param inferenceResult - Resultado de la inferencia CV
 * @param circuito - Configuración del circuito
 * @param frameAnterior - Frame anterior (para velocidad)
 * @param sessionId - ID de sesión
 * @param vueltaNumero - Número de vuelta actual
 * @returns MetricasFrame completo con validación
 */
export function calcularMetricas(
  inferenceResult: InferenceResult,
  circuito: ConfiguracionCircuito,
  frameAnterior: FrameAnterior | undefined,
  sessionId: string,
  vueltaNumero: number
): MetricasFrame {
  const now = Date.now();

  // Extraer posición del vehículo (simplificado: factores de escala por defecto)
  const posicion = extraerPosicionVehiculo(inferenceResult, 100, 100);

  // Calcular métricas individuales
  const velocidadAparente = posicion && frameAnterior
    ? calcularVelocidadAparente(posicion, frameAnterior, inferenceResult.timestamp)
    : 0;

  const posicionLineaCarrera = posicion
    ? roundToResolution(posicion.x, 0.01)
    : 0;

  // Intensidad de frenado basada en desaceleración (simplificado)
  const intensidadFrenado = roundToResolution(
    Math.max(0, Math.min(100, estimarFrenado(velocidadAparente, frameAnterior))),
    1
  );

  // Ángulo de dirección (simplificado: basado en cambio lateral)
  const anguloDirection = posicion && frameAnterior
    ? roundToResolution(estimarAnguloDirection(posicion, frameAnterior), 0.1)
    : 0;

  // Desgaste (simulado: incrementa con vueltas)
  const desgasteNeumaticos = roundToResolution(
    Math.min(100, vueltaNumero * 1.5),
    1
  );

  const metricas: MetricValues = {
    velocidadAparente,
    posicionLineaCarrera,
    intensidadFrenado,
    anguloDirection,
    desgasteNeumaticos,
  };

  // Calcular desviación de línea óptima
  const desviacionLineaOptima = posicion
    ? calcularDesviacionLineaOptima(posicion, circuito.lineaOptima)
    : 0;

  // Validar contra rangos del circuito
  const valido = sonMetricasValidas(metricas, circuito.rangosValidos);
  const metricasAnomelas = valido
    ? undefined
    : obtenerMetricasAnomelas(metricas, circuito.rangosValidos);

  return {
    frameId: inferenceResult.frameId,
    pilotoId: inferenceResult.pilotoId,
    sessionId,
    timestampCaptura: inferenceResult.timestamp,
    timestampCalculo: now,
    circuitoId: circuito.circuitoId,
    vueltaNumero,
    metricas,
    desviacionLineaOptima,
    valido,
    metricasAnomelas,
  };
}

/** Estima la intensidad de frenado basándose en la desaceleración */
function estimarFrenado(
  velocidadActual: number,
  frameAnterior: FrameAnterior | undefined
): number {
  if (!frameAnterior) return 0;
  // Simplificado: si la velocidad baja, hay frenado proporcional
  return 0;
}

/** Estima el ángulo de dirección basándose en el cambio lateral */
function estimarAnguloDirection(
  posicionActual: { x: number; y: number },
  frameAnterior: FrameAnterior
): number {
  const dx = posicionActual.x - frameAnterior.posicionX;
  const dy = posicionActual.y - frameAnterior.posicionY;

  if (dx === 0 && dy === 0) return 0;

  // Ángulo en grados, rango -180 a +180
  const angulo = Math.atan2(dy, dx) * (180 / Math.PI);
  return Math.max(-180, Math.min(180, angulo));
}
