/**
 * Timeline visual de estrategia de carrera por piloto.
 * Muestra stints con compuestos de neumáticos y predicción de pit stops.
 */

export interface Stint {
  compuesto: string;
  vueltaInicio: number;
  vueltaFin: number | null;  // null = stint actual
  desgasteFinal?: number;
}

interface StrategyTimelineProps {
  pilotoId: string;
  stints: Stint[];
  vueltaActual: number;
  vueltasTotales: number;
  prediccionPit?: number;
}

const compuestoColorMap: Record<string, string> = {
  soft: '#ef4444',
  medium: '#eab308',
  hard: '#f3f4f6',
  inter: '#22c55e',
  wet: '#3b82f6',
};

export function StrategyTimeline({
  pilotoId,
  stints,
  vueltaActual,
  vueltasTotales,
  prediccionPit,
}: StrategyTimelineProps) {
  const totalWidth = vueltasTotales;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">
          Estrategia - {pilotoId}
        </h3>
        <span className="text-xs text-gray-400">
          Vuelta {vueltaActual}/{vueltasTotales}
        </span>
      </div>

      {/* Barra de timeline */}
      <div className="relative w-full h-6 bg-gray-700 rounded overflow-hidden">
        {stints.map((stint, index) => {
          const start = ((stint.vueltaInicio - 1) / totalWidth) * 100;
          const end = stint.vueltaFin
            ? (stint.vueltaFin / totalWidth) * 100
            : (vueltaActual / totalWidth) * 100;
          const width = end - start;

          return (
            <div
              key={index}
              className="absolute h-full opacity-80"
              style={{
                left: `${start}%`,
                width: `${width}%`,
                backgroundColor: compuestoColorMap[stint.compuesto] || '#6b7280',
              }}
              title={`${stint.compuesto}: V${stint.vueltaInicio}-${stint.vueltaFin || 'actual'}`}
            />
          );
        })}

        {/* Marcador de vuelta actual */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white z-10"
          style={{ left: `${(vueltaActual / totalWidth) * 100}%` }}
        />

        {/* Predicción de pit stop */}
        {prediccionPit && prediccionPit > vueltaActual && (
          <div
            className="absolute top-0 h-full w-0.5 bg-cyan-400 z-10 animate-pulse"
            style={{ left: `${(prediccionPit / totalWidth) * 100}%` }}
            title={`Pit estimado: Vuelta ${prediccionPit}`}
          />
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
        {stints.map((stint, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: compuestoColorMap[stint.compuesto] || '#6b7280' }}
            />
            <span>{stint.compuesto} (V{stint.vueltaInicio})</span>
          </div>
        ))}
        {prediccionPit && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Pit est. V{prediccionPit}</span>
          </div>
        )}
      </div>
    </div>
  );
}
