/**
 * Identificador de ventanas de adelantamiento de ApexVision AI.
 *
 * Evalúa diferencias de velocidad relativa entre pilotos, desgaste de
 * neumáticos y tipo de sector para identificar oportunidades de adelantamiento.
 *
 * Validates: Requirement 5.4
 */

import { DatosPiloto, TipoSector, VentanaAdelantamiento } from './types';

/** Umbral mínimo de diferencia en segundos por sector para considerar ventana */
export const UMBRAL_DIFERENCIA_SECTOR = 0.3;

/**
 * Evalúa si existe una ventana de adelantamiento entre dos pilotos.
 *
 * Criterios:
 * 1. Diferencia de tiempo por sector >= 0.3 segundos
 * 2. Se evalúa la diferencia de desgaste de neumáticos
 * 3. Se considera el tipo de sector
 *
 * @param atacante - Datos del piloto que intenta adelantar
 * @param defensor - Datos del piloto que defiende posición
 * @param sectorTipo - Tipo del sector actual
 * @param umbralSegundos - Umbral mínimo de diferencia (default: 0.3s)
 * @returns Datos de la ventana si existe, o null si no hay oportunidad
 */
export function evaluarVentanaAdelantamiento(
  atacante: DatosPiloto,
  defensor: DatosPiloto,
  sectorTipo: TipoSector,
  umbralSegundos: number = UMBRAL_DIFERENCIA_SECTOR
): { esVentana: boolean; diferenciaSegundos: number; probabilidad: number } {
  // Calcular diferencia de tiempo promedio en sector
  const tiempoPromedioAtacante = calcularPromedio(atacante.tiemposSector);
  const tiempoPromedioDefensor = calcularPromedio(defensor.tiemposSector);

  // Diferencia positiva = atacante más rápido
  const diferenciaSegundos = tiempoPromedioDefensor - tiempoPromedioAtacante;

  // Evaluar si cumple umbral
  const cumpleUmbral = diferenciaSegundos >= umbralSegundos;

  if (!cumpleUmbral) {
    return { esVentana: false, diferenciaSegundos, probabilidad: 0 };
  }

  // Calcular probabilidad basada en múltiples factores
  const probabilidad = calcularProbabilidadAdelantamiento(
    diferenciaSegundos,
    atacante.desgasteNeumaticos,
    defensor.desgasteNeumaticos,
    sectorTipo
  );

  return {
    esVentana: true,
    diferenciaSegundos,
    probabilidad,
  };
}

/**
 * Calcula la probabilidad de adelantamiento considerando múltiples factores.
 *
 * @param diferenciaTiempo - Diferencia de tiempo en sector (s)
 * @param desgasteAtacante - Desgaste de neumáticos del atacante (%)
 * @param desgasteDefensor - Desgaste de neumáticos del defensor (%)
 * @param sectorTipo - Tipo de sector
 * @returns Probabilidad [0.0, 1.0]
 */
export function calcularProbabilidadAdelantamiento(
  diferenciaTiempo: number,
  desgasteAtacante: number,
  desgasteDefensor: number,
  sectorTipo: TipoSector
): number {
  let probabilidad = 0;

  // Factor 1: diferencia de tiempo (más diferencia = más probabilidad)
  // Normalizado: 0.3s = base, cada 0.1s adicional suma 0.1
  probabilidad += Math.min(0.5, (diferenciaTiempo - UMBRAL_DIFERENCIA_SECTOR) / 1.0 * 0.5 + 0.2);

  // Factor 2: diferencia de desgaste (defensor más desgastado = más probabilidad)
  const difDesgaste = desgasteDefensor - desgasteAtacante;
  if (difDesgaste > 0) {
    probabilidad += Math.min(0.25, difDesgaste / 100 * 0.5);
  }

  // Factor 3: tipo de sector
  switch (sectorTipo) {
    case 'recta':
      probabilidad += 0.2; // Rectas son mejores para adelantar
      break;
    case 'curva_lenta':
      probabilidad += 0.1; // Curvas lentas son posibles
      break;
    case 'curva_rapida':
      probabilidad += 0.05; // Curvas rápidas son difíciles
      break;
  }

  // Limitar a [0, 1]
  return Math.max(0, Math.min(1, probabilidad));
}

/**
 * Calcula el promedio de un array de números.
 */
function calcularPromedio(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((sum, v) => sum + v, 0) / valores.length;
}
