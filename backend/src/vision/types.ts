/**
 * Tipos del sistema de visión por computadora de ApexVision AI.
 */

/** Clases de objetos detectables */
export type DetectionClass =
  | 'vehiculo_propio'
  | 'vehiculo_cercano'
  | 'limite_pista'
  | 'sector';

/** Bounding box normalizada [0,1] */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Detección individual */
export interface Detection {
  classId: DetectionClass;
  confidence: number;
  boundingBox: BoundingBox;
  attributes?: Record<string, string>;
}

/** Máscara de segmentación */
export interface SegmentationMask {
  width: number;
  height: number;
  classes: string[];
  maskData: Uint8Array;
}

/** Request de inferencia */
export interface InferenceRequest {
  frameId: string;
  pilotoId: string;
  imagePayload: Buffer;
  timestamp: number;
  modelVersion: string;
}

/** Resultado de inferencia */
export interface InferenceResult {
  frameId: string;
  pilotoId: string;
  timestamp: number;
  processingTimeMs: number;
  detections: Detection[];
  segmentation?: SegmentationMask;
}

/** Resultado de inferencia raw (antes de filtrado) */
export interface RawInferenceResult {
  frameId: string;
  pilotoId: string;
  timestamp: number;
  processingTimeMs: number;
  detections: RawDetection[];
  segmentation?: SegmentationMask;
}

/** Detección raw sin filtrar */
export interface RawDetection {
  classId: DetectionClass;
  confidence: number;
  boundingBox: BoundingBox;
  attributes?: Record<string, string>;
}
