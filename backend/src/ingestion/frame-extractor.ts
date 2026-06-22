/**
 * Lambda Frame Extractor para ApexVision AI.
 *
 * Se activa por fragmentos de Kinesis Video Streams, extrae frames
 * individuales, los almacena en S3 y publica FrameMessages en
 * Kinesis Data Streams para procesamiento downstream.
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { v4 as uuidv4 } from 'uuid';
import { FrameMessage, KVSFragmentEvent } from './types';

/** Configuración del extractor */
export interface FrameExtractorConfig {
  frameStreamName: string;
  dataBucketName: string;
  maxPilotos: number;
}

/**
 * Construye un FrameMessage a partir de un fragmento de video procesado.
 *
 * @param pilotoId - ID del piloto
 * @param sessionId - ID de la sesión activa
 * @param timestamp - Timestamp de captura del frame
 * @param s3Key - Clave del frame almacenado en S3
 * @param resolution - Resolución del frame
 * @param sequenceNumber - Número de secuencia en el stream
 * @param streamName - Nombre del stream de origen
 * @returns Mensaje de frame estructurado
 */
export function buildFrameMessage(
  pilotoId: string,
  sessionId: string,
  timestamp: number,
  s3Key: string,
  resolution: { width: number; height: number },
  sequenceNumber: number,
  streamName: string
): FrameMessage {
  return {
    frameId: uuidv4(),
    pilotoId,
    sessionId,
    timestamp,
    s3Key,
    resolution,
    sequenceNumber,
    streamName,
  };
}

/**
 * Genera la clave S3 para almacenar un frame raw.
 *
 * @param sessionId - ID de la sesión
 * @param pilotoId - ID del piloto
 * @param timestamp - Timestamp del frame
 * @returns Clave S3 siguiendo la convención: raw-frames/{sessionId}/{pilotoId}/{timestamp}.jpg
 */
export function generateS3Key(sessionId: string, pilotoId: string, timestamp: number): string {
  return `raw-frames/${sessionId}/${pilotoId}/${timestamp}.jpg`;
}

/**
 * Valida que un frame cumple con los requisitos mínimos de calidad.
 *
 * @param resolution - Resolución del frame
 * @returns true si cumple requisitos mínimos (720p)
 */
export function validateFrameResolution(resolution: { width: number; height: number }): boolean {
  // Mínimo 720p: 1280×720
  return resolution.width >= 1280 && resolution.height >= 720;
}

/**
 * Handler Lambda para extracción de frames.
 * En producción, este handler se dispara por eventos de KVS.
 */
export async function handler(event: {
  Records?: Array<{ kinesis: { data: string } }>;
}): Promise<{ statusCode: number; processedFrames: number }> {
  const config: FrameExtractorConfig = {
    frameStreamName: process.env.FRAME_STREAM_NAME || '',
    dataBucketName: process.env.DATA_BUCKET_NAME || '',
    maxPilotos: parseInt(process.env.MAX_PILOTOS || '20', 10),
  };

  if (!config.frameStreamName || !config.dataBucketName) {
    throw new Error('Missing required environment variables: FRAME_STREAM_NAME, DATA_BUCKET_NAME');
  }

  let processedFrames = 0;

  for (const record of event.Records || []) {
    try {
      const payload = JSON.parse(
        Buffer.from(record.kinesis.data, 'base64').toString()
      ) as KVSFragmentEvent;

      // En producción aquí se extraerían los frames del fragmento de video
      // y se publicarían en KDS. Por ahora, construimos el mensaje.
      const timestamp = payload.producerTimestamp;
      const sessionId = 'current-session'; // En producción: lookup de sesión activa
      const s3Key = generateS3Key(sessionId, payload.pilotoId, timestamp);

      const frameMessage = buildFrameMessage(
        payload.pilotoId,
        sessionId,
        timestamp,
        s3Key,
        { width: 1920, height: 1080 },
        0,
        payload.streamName
      );

      // TODO: Publicar frameMessage en Kinesis Data Streams
      // TODO: Almacenar frame en S3

      processedFrames++;
    } catch (error) {
      console.error('Error processing record:', error);
    }
  }

  return { statusCode: 200, processedFrames };
}
