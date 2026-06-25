/**
 * Tipos del sistema de IA Generativa de ApexVision AI.
 */

/** Request para generación de insight */
export interface InsightRequest {
  pilotoId: string;
  sessionId: string;
  intervaloSegundos: number;
  metricas: MetricaResumen[];
  contextoCarrera: ContextoCarrera;
}

/** Resumen de métricas para un intervalo */
export interface MetricaResumen {
  velocidadPromedio: number;
  desgasteActual: number;
  desviacionLineaPromedio: number;
  intensidadFrenadoPromedio: number;
}

/** Contexto de carrera para el modelo */
export interface ContextoCarrera {
  vueltaActual: number;
  vueltasTotales: number;
  posicionPiloto: number;
  pilotoAdelante?: PilotoResumen;
  pilotoDetras?: PilotoResumen;
  compuestoNeumatico: string;
  vueltasConCompuesto: number;
}

/** Resumen de un piloto cercano */
export interface PilotoResumen {
  pilotoId: string;
  nombre: string;
  diferenciaTiempo: number;
  desgasteNeumaticos: number;
}

/** Respuesta de insight generado */
export interface InsightResponse {
  insightId: string;
  pilotoId: string;
  timestamp: number;
  tipo: 'rendimiento' | 'estrategia' | 'resumen';
  texto: string;
  confianza: number;
  contextosUtilizados: string[];
  tiempoGeneracionMs: number;
}

/** Recomendación estratégica */
export interface RecomendacionEstrategia {
  insightId: string;
  pilotoId: string;
  timestamp: number;
  ventanaTemporal: { inicioSegundos: number; finSegundos: number };
  nivelRiesgo: 'bajo' | 'medio' | 'alto';
  texto: string;
  fundamentacion: string[];
}

/** Estado del retry handler */
export interface RetryState {
  intentos: number;
  maxIntentos: number;
  ultimoInsightValido?: InsightResponse;
  fallosPersistentes: boolean;
}
