/**
 * Formateador de logs estructurados de ApexVision AI.
 *
 * Produce logs en formato JSON con campos obligatorios:
 * timestamp (ISO 8601), nivel, servicio, traceId, mensaje.
 * Tamaño máximo: 256 KB por entrada.
 *
 * Validates: Requirement 11.1
 */

/** Niveles de log válidos */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Estructura de una entrada de log */
export interface LogEntry {
  timestamp: string;
  nivel: LogLevel;
  servicio: string;
  traceId: string;
  mensaje: string;
  datos?: Record<string, unknown>;
}

/** Tamaño máximo de entrada de log en bytes (256 KB) */
export const MAX_LOG_SIZE_BYTES = 256 * 1024;

/** Campos obligatorios que debe tener toda entrada de log */
export const REQUIRED_FIELDS: (keyof LogEntry)[] = ['timestamp', 'nivel', 'servicio', 'traceId', 'mensaje'];

/**
 * Crea una entrada de log estructurada.
 *
 * @param nivel - Nivel de log
 * @param servicio - Identificador del componente/servicio
 * @param traceId - ID de correlación distribuida (X-Ray)
 * @param mensaje - Mensaje descriptivo
 * @param datos - Datos adicionales opcionales
 * @returns Entrada de log formateada
 */
export function createLogEntry(
  nivel: LogLevel,
  servicio: string,
  traceId: string,
  mensaje: string,
  datos?: Record<string, unknown>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    nivel,
    servicio,
    traceId,
    mensaje,
    ...(datos && { datos }),
  };
}

/**
 * Serializa una entrada de log a JSON string.
 * Trunca si excede el tamaño máximo.
 *
 * @param entry - Entrada de log
 * @returns JSON string (máximo 256 KB)
 */
export function serializeLogEntry(entry: LogEntry): string {
  const json = JSON.stringify(entry);

  if (Buffer.byteLength(json, 'utf-8') > MAX_LOG_SIZE_BYTES) {
    // Truncar el mensaje para cumplir el límite
    const truncatedEntry: LogEntry = {
      ...entry,
      mensaje: entry.mensaje.substring(0, 1000) + '... [TRUNCATED]',
      datos: undefined,
    };
    return JSON.stringify(truncatedEntry);
  }

  return json;
}

/**
 * Valida que una entrada de log tiene todos los campos obligatorios
 * y cumple con el formato requerido.
 *
 * @param entry - Entrada de log a validar
 * @returns { valid, errors }
 */
export function validateLogEntry(entry: LogEntry): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Verificar campos obligatorios
  for (const field of REQUIRED_FIELDS) {
    if (!entry[field] || entry[field] === '') {
      errors.push(`Campo obligatorio vacío: ${field}`);
    }
  }

  // Validar formato timestamp (ISO 8601)
  if (entry.timestamp && isNaN(Date.parse(entry.timestamp))) {
    errors.push('Timestamp no es ISO 8601 válido');
  }

  // Validar nivel
  const nivelesValidos: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (entry.nivel && !nivelesValidos.includes(entry.nivel)) {
    errors.push(`Nivel inválido: ${entry.nivel}`);
  }

  // Validar tamaño
  const size = Buffer.byteLength(JSON.stringify(entry), 'utf-8');
  if (size > MAX_LOG_SIZE_BYTES) {
    errors.push(`Tamaño excede 256KB: ${size} bytes`);
  }

  return { valid: errors.length === 0, errors };
}
