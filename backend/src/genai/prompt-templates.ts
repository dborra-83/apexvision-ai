/**
 * Templates de prompts para Amazon Bedrock.
 *
 * Plantillas parametrizadas para generación de insights,
 * recomendaciones estratégicas y resúmenes de stint.
 */

import { ContextoCarrera, InsightRequest, MetricaResumen } from './types';

/**
 * Genera el prompt para insight de rendimiento en tiempo real.
 */
export function buildInsightPrompt(request: InsightRequest): string {
  const { pilotoId, contextoCarrera, metricas } = request;
  const ultimaMetrica = metricas[metricas.length - 1];

  return `Eres un ingeniero de estrategia de Fórmula 1. Analiza los siguientes datos del piloto ${pilotoId} y genera un insight conciso (máximo 3 frases) sobre su rendimiento actual.

DATOS DEL PILOTO:
- Vuelta: ${contextoCarrera.vueltaActual}/${contextoCarrera.vueltasTotales}
- Posición: P${contextoCarrera.posicionPiloto}
- Neumático: ${contextoCarrera.compuestoNeumatico} (${contextoCarrera.vueltasConCompuesto} vueltas)
- Velocidad promedio: ${ultimaMetrica?.velocidadPromedio?.toFixed(1) ?? 'N/A'} km/h
- Desgaste neumáticos: ${ultimaMetrica?.desgasteActual?.toFixed(1) ?? 'N/A'}%
- Desviación línea óptima: ${ultimaMetrica?.desviacionLineaPromedio?.toFixed(2) ?? 'N/A'} m
${contextoCarrera.pilotoAdelante ? `- Piloto adelante: ${contextoCarrera.pilotoAdelante.nombre} (+${contextoCarrera.pilotoAdelante.diferenciaTiempo.toFixed(1)}s)` : ''}
${contextoCarrera.pilotoDetras ? `- Piloto detrás: ${contextoCarrera.pilotoDetras.nombre} (-${contextoCarrera.pilotoDetras.diferenciaTiempo.toFixed(1)}s)` : ''}

Genera un insight que incluya: ritmo actual, estado de degradación y comparación con pilotos cercanos.`;
}

/**
 * Genera el prompt para recomendación de estrategia de adelantamiento.
 */
export function buildStrategyPrompt(
  pilotoId: string,
  ventanaSegundos: { inicio: number; fin: number },
  contexto: ContextoCarrera
): string {
  return `Eres un estratega de F1. El piloto ${pilotoId} tiene una ventana de adelantamiento.

SITUACIÓN:
- Vuelta: ${contexto.vueltaActual}/${contexto.vueltasTotales}
- Posición actual: P${contexto.posicionPiloto}
- Ventana estimada: ${ventanaSegundos.inicio}s - ${ventanaSegundos.fin}s
- Neumático: ${contexto.compuestoNeumatico} (${contexto.vueltasConCompuesto} vueltas)
${contexto.pilotoAdelante ? `- Objetivo: ${contexto.pilotoAdelante.nombre} (desgaste: ${contexto.pilotoAdelante.desgasteNeumaticos}%)` : ''}

Genera una recomendación estratégica concisa (máximo 2 frases) indicando si debe intentar el adelantamiento y el nivel de riesgo (bajo/medio/alto).`;
}

/**
 * Genera el prompt para resumen de stint.
 */
export function buildSummaryPrompt(
  pilotoId: string,
  stintData: {
    vueltaInicio: number;
    vueltaFin: number;
    tiemposVuelta: number[];
    desgasteInicial: number;
    desgasteFinal: number;
    incidentes: string[];
  }
): string {
  const tiempoPromedio = stintData.tiemposVuelta.length > 0
    ? (stintData.tiemposVuelta.reduce((a, b) => a + b, 0) / stintData.tiemposVuelta.length).toFixed(3)
    : 'N/A';

  return `Eres un analista de rendimiento de F1. Genera un resumen estructurado del stint del piloto ${pilotoId}.

DATOS DEL STINT:
- Vueltas: ${stintData.vueltaInicio} a ${stintData.vueltaFin}
- Tiempo promedio: ${tiempoPromedio}s
- Desgaste: ${stintData.desgasteInicial}% → ${stintData.desgasteFinal}%
- Incidentes destacados: ${stintData.incidentes.length > 0 ? stintData.incidentes.join(', ') : 'Ninguno'}
- Variación por vuelta: ${stintData.tiemposVuelta.slice(0, 5).map(t => t.toFixed(3)).join(', ')}...

Genera un resumen con: rendimiento general, tendencias de degradación, eventos destacados y recomendaciones para el siguiente stint.`;
}
