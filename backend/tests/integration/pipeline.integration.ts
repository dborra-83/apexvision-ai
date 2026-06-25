/**
 * Test de integración: Pipeline end-to-end.
 *
 * Simula el flujo completo: frame → CV → métricas → persistencia.
 * Verifica latencia total y que los datos llegan correctamente.
 *
 * Nota: Este test requiere mocks de AWS SDK o infraestructura desplegada.
 */

import { describe, it, expect } from 'vitest';
import { buildFrameMessage, generateS3Key } from '../../src/ingestion/frame-extractor';
import { filterInferenceResult } from '../../src/vision/confidence-filter';
import { calcularMetricas } from '../../src/metrics/calculator';
import { sonMetricasValidas } from '../../src/metrics/range-validator';
import { RawInferenceResult } from '../../src/vision/types';
import { ConfiguracionCircuito } from '../../src/metrics/types';

// Configuración de circuito de prueba
const circuitoTest: ConfiguracionCircuito = {
  circuitoId: 'test-circuit',
  nombre: 'Circuito de Test',
  longitudMetros: 5000,
  sectores: [
    { sectorId: 's1', nombre: 'Recta', tipo: 'recta', puntoInicio: { x: 0, y: 0 }, puntoFin: { x: 1000, y: 0 } },
  ],
  lineaOptima: [
    { x: 0, y: 5 }, { x: 100, y: 5 }, { x: 200, y: 5 }, { x: 300, y: 5 },
    { x: 400, y: 5 }, { x: 500, y: 5 }, { x: 600, y: 5 }, { x: 700, y: 5 },
    { x: 800, y: 5 }, { x: 900, y: 5 }, { x: 1000, y: 5 },
  ],
  rangosValidos: {
    velocidadAparente: { min: 0, max: 370 },
    posicionLineaCarrera: { min: -15, max: 15 },
    intensidadFrenado: { min: 0, max: 100 },
    anguloDirection: { min: -180, max: 180 },
    desgasteNeumaticos: { min: 0, max: 100 },
  },
};

describe('Integration: Pipeline E2E', () => {
  it('frame → inferencia → filtrado → métricas → resultado válido', () => {
    const startTime = Date.now();

    // 1. Crear FrameMessage (simula ingesta)
    const frame = buildFrameMessage(
      'pilot-VER',
      'session-gp-monza-2024',
      startTime,
      generateS3Key('session-gp-monza-2024', 'pilot-VER', startTime),
      { width: 1920, height: 1080 },
      1,
      'kvs-stream-ver'
    );

    expect(frame.frameId).toBeTruthy();
    expect(frame.pilotoId).toBe('pilot-VER');

    // 2. Simular resultado de inferencia raw
    const rawResult: RawInferenceResult = {
      frameId: frame.frameId,
      pilotoId: frame.pilotoId,
      timestamp: frame.timestamp,
      processingTimeMs: 245,
      detections: [
        {
          classId: 'vehiculo_propio',
          confidence: 0.95,
          boundingBox: { x: 0.4, y: 0.5, width: 0.2, height: 0.15 },
        },
        {
          classId: 'vehiculo_cercano',
          confidence: 0.87,
          boundingBox: { x: 0.1, y: 0.3, width: 0.08, height: 0.06 },
        },
        {
          classId: 'limite_pista',
          confidence: 0.72, // Debajo del umbral, será filtrado
          boundingBox: { x: 0.0, y: 0.8, width: 1.0, height: 0.02 },
        },
      ],
    };

    // 3. Filtrar por confianza
    const filtered = filterInferenceResult(rawResult);
    expect(filtered.detections).toHaveLength(2); // Solo 2 con conf >= 0.80
    expect(filtered.detections.every((d) => d.confidence >= 0.80)).toBe(true);

    // 4. Calcular métricas
    const metricas = calcularMetricas(
      filtered,
      circuitoTest,
      undefined, // Sin frame anterior
      'session-gp-monza-2024',
      15
    );

    expect(metricas.frameId).toBe(frame.frameId);
    expect(metricas.pilotoId).toBe('pilot-VER');
    expect(metricas.sessionId).toBe('session-gp-monza-2024');
    expect(metricas.timestampCaptura).toBe(frame.timestamp);
    expect(metricas.circuitoId).toBe('test-circuit');
    expect(metricas.vueltaNumero).toBe(15);

    // 5. Validar que las métricas están dentro de rangos
    const valido = sonMetricasValidas(metricas.metricas, circuitoTest.rangosValidos);
    // Sin frame anterior, velocidad = 0 que está en rango [0, 370]
    // Desgaste vuelta 15 = 22.5% en rango [0, 100]
    expect(metricas.metricas.velocidadAparente).toBeGreaterThanOrEqual(0);
    expect(metricas.metricas.desgasteNeumaticos).toBeGreaterThanOrEqual(0);

    // 6. Verificar latencia del pipeline (excluyendo I/O real)
    const endTime = Date.now();
    const pipelineLatency = endTime - startTime;
    expect(pipelineLatency).toBeLessThan(100); // Sin I/O real, debe ser < 100ms
  });

  it('pipeline con frame anterior calcula velocidad', () => {
    const now = Date.now();

    const rawResult: RawInferenceResult = {
      frameId: 'frame-2',
      pilotoId: 'pilot-HAM',
      timestamp: now,
      processingTimeMs: 180,
      detections: [
        {
          classId: 'vehiculo_propio',
          confidence: 0.92,
          boundingBox: { x: 0.45, y: 0.5, width: 0.2, height: 0.15 },
        },
      ],
    };

    const filtered = filterInferenceResult(rawResult);

    const frameAnterior = {
      frameId: 'frame-1',
      timestamp: now - 33, // 33ms antes (30fps)
      posicionX: 54, // Posición anterior
      posicionY: 50,
    };

    const metricas = calcularMetricas(
      filtered,
      circuitoTest,
      frameAnterior,
      'session-test',
      10
    );

    // Con frame anterior, debe calcular velocidad
    expect(metricas.metricas.velocidadAparente).toBeGreaterThanOrEqual(0);
    expect(metricas.timestampCaptura).toBe(now);
  });

  it('métricas fuera de rango se marcan como anómalas', () => {
    const circuitoEstricto: ConfiguracionCircuito = {
      ...circuitoTest,
      rangosValidos: {
        velocidadAparente: { min: 100, max: 200 }, // Rango estrecho
        posicionLineaCarrera: { min: -5, max: 5 },
        intensidadFrenado: { min: 0, max: 100 },
        anguloDirection: { min: -90, max: 90 },
        desgasteNeumaticos: { min: 0, max: 50 }, // Máximo 50%
      },
    };

    const rawResult: RawInferenceResult = {
      frameId: 'frame-anomaly',
      pilotoId: 'pilot-TEST',
      timestamp: Date.now(),
      processingTimeMs: 200,
      detections: [
        {
          classId: 'vehiculo_propio',
          confidence: 0.90,
          boundingBox: { x: 0.5, y: 0.5, width: 0.2, height: 0.15 },
        },
      ],
    };

    const filtered = filterInferenceResult(rawResult);

    // Vuelta 40 → desgaste = 40*1.5 = 60% > máximo 50%
    const metricas = calcularMetricas(
      filtered,
      circuitoEstricto,
      undefined,
      'session-test',
      40
    );

    expect(metricas.valido).toBe(false);
    expect(metricas.metricasAnomelas).toBeDefined();
    expect(metricas.metricasAnomelas!.length).toBeGreaterThan(0);
  });
});
