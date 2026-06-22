/**
 * Tipos del sistema de extracción de métricas de ApexVision AI.
 */

/** Métricas calculadas para un frame */
export interface MetricasFrame {
  frameId: string;
  pilotoId: string;
  sessionId: string;
  timestampCaptura: number;
  timestampCalculo: number;
  circuitoId: string;
  vueltaNumero: number;
  metricas: MetricValues;
  desviacionLineaOptima: number;
  valido: boolean;
  metricasAnomelas?: string[];
}

/** Valores de métricas individuales */
export interface MetricValues {
  velocidadAparente: number;      // km/h, resolución 0.1
  posicionLineaCarrera: number;   // metros desviación lateral, resolución 0.01
  intensidadFrenado: number;      // porcentaje 0-100
  anguloDirection: number;        // grados -180 a +180, resolución 0.1
  desgasteNeumaticos: number;     // porcentaje degradación 0-100
}

/** Rangos válidos para métricas de un circuito */
export interface RangosMetricas {
  velocidadAparente: { min: number; max: number };
  posicionLineaCarrera: { min: number; max: number };
  intensidadFrenado: { min: number; max: number };
  anguloDirection: { min: number; max: number };
  desgasteNeumaticos: { min: number; max: number };
}

/** Punto en la línea óptima del circuito */
export interface PuntoLineaOptima {
  x: number;  // Coordenada X en metros
  y: number;  // Coordenada Y en metros
}

/** Sector del circuito */
export interface Sector {
  sectorId: string;
  nombre: string;
  tipo: 'recta' | 'curva_lenta' | 'curva_rapida';
  puntoInicio: PuntoLineaOptima;
  puntoFin: PuntoLineaOptima;
}

/** Configuración completa de un circuito */
export interface ConfiguracionCircuito {
  circuitoId: string;
  nombre: string;
  longitudMetros: number;
  sectores: Sector[];
  lineaOptima: PuntoLineaOptima[];
  rangosValidos: RangosMetricas;
}

/** Resultado de validación de una métrica */
export interface ValidacionMetrica {
  metrica: string;
  valor: number;
  rangoMin: number;
  rangoMax: number;
  esValido: boolean;
}
