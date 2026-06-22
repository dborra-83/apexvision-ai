/**
 * Card individual por piloto mostrando métricas en tiempo real.
 */

import { PilotMetrics } from '../store/metrics-store';

interface PilotCardProps {
  metrics: PilotMetrics;
}

export function PilotCard({ metrics }: PilotCardProps) {
  const isStale = Date.now() - metrics.lastUpdate > 10000;

  return (
    <div
      className={`bg-gray-800 rounded-lg p-4 border ${
        isStale ? 'border-yellow-500 opacity-70' : 'border-gray-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-lg">{metrics.pilotoId}</span>
        <span className="text-xs text-gray-400">
          P{metrics.posicionCarrera}
        </span>
      </div>

      {isStale && (
        <div className="text-xs text-yellow-400 mb-2">⚠ Dato obsoleto</div>
      )}

      {/* Métricas */}
      <div className="space-y-2 text-sm">
        <MetricRow label="Velocidad" value={`${metrics.velocidadAparente.toFixed(1)} km/h`} />
        <MetricRow label="Frenado" value={`${metrics.intensidadFrenado.toFixed(0)}%`} />
        <MetricRow
          label="Neumáticos"
          value={`${metrics.compuestoNeumatico} - ${metrics.desgasteNeumaticos.toFixed(0)}%`}
        />
        <MetricRow label="Vueltas compuesto" value={`${metrics.vueltasConCompuesto}`} />
        {metrics.prediccionPitStop && (
          <MetricRow
            label="Pit estimado"
            value={`Vuelta ${metrics.prediccionPitStop}`}
            highlight
          />
        )}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={highlight ? 'text-blue-400 font-semibold' : 'text-white'}>
        {value}
      </span>
    </div>
  );
}
