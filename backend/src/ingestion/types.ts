/**
 * Tipos del sistema de ingesta de video de ApexVision AI.
 */

/** Evento recibido desde Kinesis Video Streams (fragmento) */
export interface KVSFragmentEvent {
  streamName: string;
  fragmentNumber: string;
  producerTimestamp: number;
  serverTimestamp: number;
  pilotoId: string;
}

/** Mensaje publicado en Kinesis Data Streams */
export interface FrameMessage {
  frameId: string;
  pilotoId: string;
  sessionId: string;
  timestamp: number;
  s3Key: string;
  resolution: { width: number; height: number };
  sequenceNumber: number;
  streamName: string;
}

/** Estado de un flujo de video */
export type StreamStatus = 'active' | 'reconnecting' | 'inactive';

/** Estado de reconexión para un flujo */
export interface ReconnectionState {
  streamName: string;
  pilotoId: string;
  status: StreamStatus;
  currentAttempt: number;
  maxAttempts: number;
  lastAttemptTimestamp?: number;
  nextRetryTimestamp?: number;
  disconnectTimestamp?: number;
}

/** Configuración de backoff exponencial */
export interface BackoffConfig {
  baseDelayMs: number;
  factor: number;
  maxAttempts: number;
}

/** Resultado de un intento de reconexión */
export interface ReconnectionResult {
  success: boolean;
  state: ReconnectionState;
  shouldRetry: boolean;
  nextDelayMs?: number;
}
