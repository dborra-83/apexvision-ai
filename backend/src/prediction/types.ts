/**
 * Tipos del sistema de predicción de ApexVision AI.
 */

/** Clasificación de anomalía de rendimiento */
export type AnomaliaClasificacion = 'subviraje' | 'sobreviraje' | 'fatiga' | 'degradacion_mecanica';

/** Tipo de sector del circuito */
export type TipoSector = 'recta' | 'curva_lenta' | 'curva_rapida';

/** Anomalía de rendimiento detectada */
export interface AnomaliaRendimiento {
  anomaliaId: string;
  pilotoId: string;
  sessionId: string;
  timestamp: number;
  clasificacion: AnomaliaClasificacion;
  desviacionSigma: number;
  metricaAfectada: string;
  valorObservado: number;
  valorEsperado: number;
  ventanaVueltas: number[];
}

/** Ventana de adelantamiento identificada */
export interface VentanaAdelantamiento {
  ventanaId: string;
  pilotoAtacante: string;
  pilotoDefensor: string;
  sessionId: string;
  timestamp: number;
  sectorTipo: TipoSector;
  diferenciaSegundosSector: number;
  diferenciaDesgaste: number;
  probabilidad: number;
}

/** Predicción de pit stop */
export interface PrediccionPitStop {
  pilotoId: string;
  sessionId: string;
  timestamp: number;
  ventanaOptima: { vueltaInicio: number; vueltaFin: number };
  confianza: number;
  factores: string[];
}

/** Datos de un piloto para cálculos de predicción */
export interface DatosPiloto {
  pilotoId: string;
  tiemposSector: number[];       // Segundos por sector (últimos N)
  desgasteNeumaticos: number;    // Porcentaje actual
  vueltaActual: number;
}

/** Parámetros del detector de anomalías */
export interface ParametrosAnomalias {
  ventanaVueltas: number;        // Default: 10
  umbralSigma: number;           // Default: 2.0
}
