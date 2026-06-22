/**
 * Test de integración: Sistema de alertas end-to-end.
 *
 * Verifica el flujo completo: detección anomalía → clasificación severidad
 * → agrupación → broadcast WebSocket.
 */

import { describe, it, expect } from 'vitest';
import { detectarAnomalia, clasificarAnomalia } from '../../src/prediction/anomaly-detector';
import { clasificarSeveridad, obtenerTtlEntrega } from '../../src/alerts/severity-classifier';
import { procesarAlerta, AlertBuffer } from '../../src/alerts/alert-grouper';
import { broadcast, filterConnectionsByPiloto } from '../../src/api/websocket-broadcaster';
import { Alerta, SLA_ENTREGA_MS } from '../../src/alerts/types';
import { WsConnection } from '../../src/api/types';

describe('Integration: Alerts E2E', () => {
  it('anomalía detectada → clasificada → entregada vía WebSocket', () => {
    // 1. Detectar anomalía
    const historico = [85, 87, 86, 84, 88, 85, 86, 87, 84, 85]; // Velocidades normales
    const valorAnomalo = 72; // Caída brusca
    const { esAnomalia, zScore } = detectarAnomalia(valorAnomalo, historico);

    expect(esAnomalia).toBe(true);
    expect(Math.abs(zScore)).toBeGreaterThan(2.0);

    // 2. Clasificar anomalía
    const clasificacion = clasificarAnomalia('velocidadAparente', zScore);
    expect(clasificacion).toBe('fatiga'); // Velocidad baja = fatiga

    // 3. Clasificar severidad de la alerta
    const severidad = clasificarSeveridad({
      tipo: 'anomalia_rendimiento',
      pilotoId: 'pilot-HAM',
      desviacionSigma: Math.abs(zScore),
    });

    // Si sigma > 3.0, es crítica; sino es alta
    if (Math.abs(zScore) > 3.0) {
      expect(severidad).toBe('critica');
    } else {
      expect(severidad).toBe('alta');
    }

    // 4. Obtener TTL de entrega
    const ttl = obtenerTtlEntrega(severidad);
    expect(ttl).toBe(500); // Critica/alta = 500ms

    // 5. Simular broadcast a conexiones WebSocket
    const connections: WsConnection[] = [
      { connectionId: 'conn-1', userId: 'user-1', rol: 'ingeniero_pista', connectedAt: Date.now(), subscriptions: ['pilot-HAM'], ttl: 0 },
      { connectionId: 'conn-2', userId: 'user-2', rol: 'viewer', connectedAt: Date.now(), subscriptions: [], ttl: 0 },
      { connectionId: 'conn-3', userId: 'user-3', rol: 'ingeniero_pista', connectedAt: Date.now(), subscriptions: ['pilot-VER'], ttl: 0 },
    ];

    const targeted = filterConnectionsByPiloto(connections, 'pilot-HAM');
    // conn-1 (suscrito a HAM) + conn-2 (sin filtro, recibe todo)
    expect(targeted).toHaveLength(2);
  });

  it('flujo de agrupación: > 10 alertas se consolidan', () => {
    const buffers = new Map<string, AlertBuffer>();
    const now = Date.now();
    const results: Array<'individual' | 'agrupada'> = [];

    // Generar 15 alertas del mismo tipo/piloto en < 60s
    for (let i = 0; i < 15; i++) {
      const alerta: Alerta = {
        alertaId: `alert-${i}`,
        tipo: 'degradacion_neumaticos',
        severidad: 'media',
        pilotoId: 'pilot-LEC',
        sessionId: 'session-1',
        timestamp: now + i * 3000, // Cada 3 segundos
        payload: {},
        destinatarios: ['ingeniero_pista'],
        ttlEntrega: 2000,
      };

      const result = procesarAlerta(alerta, buffers);
      results.push(result.tipo);
    }

    // Las primeras 10 deben ser individuales
    expect(results.slice(0, 10).every((r) => r === 'individual')).toBe(true);

    // A partir de la 11ª se agrupan
    expect(results.slice(10).some((r) => r === 'agrupada')).toBe(true);
  });

  it('alertas de diferentes tipos NO se agrupan entre sí', () => {
    const buffers = new Map<string, AlertBuffer>();
    const now = Date.now();
    let anyGrouped = false;

    // 6 alertas tipo A + 6 alertas tipo B para mismo piloto
    for (let i = 0; i < 6; i++) {
      const alertaA: Alerta = {
        alertaId: `a-${i}`, tipo: 'anomalia', severidad: 'alta',
        pilotoId: 'pilot-1', sessionId: 's1', timestamp: now + i * 1000,
        payload: {}, destinatarios: [], ttlEntrega: 500,
      };
      const alertaB: Alerta = {
        alertaId: `b-${i}`, tipo: 'degradacion', severidad: 'media',
        pilotoId: 'pilot-1', sessionId: 's1', timestamp: now + i * 1000,
        payload: {}, destinatarios: [], ttlEntrega: 2000,
      };

      const rA = procesarAlerta(alertaA, buffers);
      const rB = procesarAlerta(alertaB, buffers);
      if (rA.tipo === 'agrupada' || rB.tipo === 'agrupada') anyGrouped = true;
    }

    // 6 de cada tipo (< 10 umbral) → ninguna agrupada
    expect(anyGrouped).toBe(false);
  });
});
