/**
 * Vista de comparación entre pilotos.
 * Permite seleccionar 2-4 pilotos y comparar métricas lado a lado.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LapTimeChart, LapTimeDataPoint } from '../components/LapTimeChart';
import { SpeedChart, SpeedDataPoint } from '../components/SpeedChart';
import { TireWearGauge } from '../components/TireWearGauge';

// --- DEMO DATA ---
// TODO: Reemplazar con datos reales del backend cuando esté disponible.
// El punto de inyección será un hook: usePilotComparison(selectedPilotos)
// que obtenga datos de métricas-store o de una API REST.

const PILOTOS_DISPONIBLES = [
  { id: 'VER', nombre: 'Verstappen', color: '#1e3a8a' },
  { id: 'HAM', nombre: 'Hamilton', color: '#00d2be' },
  { id: 'LEC', nombre: 'Leclerc', color: '#dc2626' },
  { id: 'NOR', nombre: 'Norris', color: '#f97316' },
  { id: 'SAI', nombre: 'Sainz', color: '#fbbf24' },
  { id: 'PIA', nombre: 'Piastri', color: '#fb923c' },
];

// DEMO DATA: genera tiempos de vuelta ficticios (deterministas dado el seed de pilotos)
function generateLapTimeData(pilotos: string[], vueltas: number): LapTimeDataPoint[] {
  return Array.from({ length: vueltas }, (_, i) => {
    const point: LapTimeDataPoint = { vuelta: i + 1 };
    pilotos.forEach((p, idx) => {
      // Usar un patrón determinista basado en el índice del piloto y la vuelta
      const base = 81 + idx * 0.3;
      const degradation = i > 20 ? (i - 20) * 0.05 : 0;
      const variation = Math.sin(i * (idx + 1) * 0.7) * 0.8;
      point[p] = base + variation + degradation;
    });
    return point;
  });
}

// DEMO DATA: genera velocidades ficticias (deterministas)
function generateSpeedData(pilotoIdx: number, vueltas: number): SpeedDataPoint[] {
  const now = Date.now();
  return Array.from({ length: Math.min(60, vueltas) }, (_, i) => ({
    timestamp: now - (60 - i) * 1000,
    velocidad: 280 + Math.sin(i * 0.5 + pilotoIdx) * 25 + pilotoIdx * 5,
    label: `${60 - i}s`,
  }));
}

// DEMO DATA: desgaste de neumáticos fijo por piloto
function generateTireData(pilotoIdx: number) {
  const compuestos = ['soft', 'medium', 'hard'];
  return {
    desgaste: 30 + pilotoIdx * 12,
    compuesto: compuestos[pilotoIdx % 3],
    vueltasUsadas: 10 + pilotoIdx * 5,
  };
}
// --- FIN DEMO DATA ---

export function Comparison() {
  const [selectedPilotos, setSelectedPilotos] = useState<string[]>(['VER', 'HAM']);

  const togglePiloto = (id: string) => {
    setSelectedPilotos((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= 4) return prev; // Máximo 4
      return [...prev, id];
    });
  };

  // Memoizar datos de demo para evitar regenerar en cada render
  const lapData = useMemo(
    () => generateLapTimeData(selectedPilotos, 30),
    [selectedPilotos]
  );

  const speedDataByPilot = useMemo(
    () =>
      selectedPilotos.map((pilotoId, idx) => ({
        pilotoId,
        data: generateSpeedData(idx, 30),
      })),
    [selectedPilotos]
  );

  const tireDataByPilot = useMemo(
    () =>
      selectedPilotos.map((pilotoId, idx) => ({
        pilotoId,
        ...generateTireData(idx),
      })),
    [selectedPilotos]
  );

  const pilotosChart = PILOTOS_DISPONIBLES.filter((p) => selectedPilotos.includes(p.id));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Comparación de Pilotos</h1>
          <Link to="/dashboard" className="text-sm text-blue-400 hover:text-blue-300">
            ← Volver al Dashboard
          </Link>
        </div>
      </header>

      <main className="p-6">
        {/* Selector de pilotos */}
        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-2">Selecciona hasta 4 pilotos para comparar:</p>
          <div className="flex flex-wrap gap-2">
            {PILOTOS_DISPONIBLES.map((piloto) => (
              <button
                key={piloto.id}
                onClick={() => togglePiloto(piloto.id)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  selectedPilotos.includes(piloto.id)
                    ? 'ring-2 ring-offset-1 ring-offset-gray-900'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                style={
                  selectedPilotos.includes(piloto.id)
                    ? { backgroundColor: piloto.color, color: '#fff' }
                    : undefined
                }
              >
                {piloto.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Gráfico de tiempos por vuelta */}
        <div className="mb-6">
          <LapTimeChart data={lapData} pilotos={pilotosChart} />
        </div>

        {/* Comparación de velocidad lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {speedDataByPilot.map(({ pilotoId, data }) => {
            const piloto = PILOTOS_DISPONIBLES.find((p) => p.id === pilotoId);
            return (
              <SpeedChart
                key={pilotoId}
                data={data}
                pilotoId={piloto?.nombre || pilotoId}
                color={piloto?.color}
              />
            );
          })}
        </div>

        {/* Comparación de neumáticos */}
        <h2 className="text-lg font-semibold mb-3">Estado de Neumáticos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tireDataByPilot.map(({ pilotoId, desgaste, compuesto, vueltasUsadas }) => {
            const piloto = PILOTOS_DISPONIBLES.find((p) => p.id === pilotoId);
            return (
              <div key={pilotoId}>
                <p className="text-sm text-gray-300 mb-1 font-medium">
                  {piloto?.nombre || pilotoId}
                </p>
                <TireWearGauge
                  desgaste={desgaste}
                  compuesto={compuesto}
                  vueltasUsadas={vueltasUsadas}
                />
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
