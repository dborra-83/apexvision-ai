/**
 * Panel de insights generados por IA (Bedrock).
 * Muestra recomendaciones con nivel de riesgo y timestamp.
 */

export interface Insight {
  insightId: string;
  texto: string;
  tipo: 'rendimiento' | 'estrategia' | 'resumen';
  timestamp: number;
  nivelRiesgo?: 'bajo' | 'medio' | 'alto';
  fundamentacion?: string[];
}

interface InsightPanelProps {
  insights: Insight[];
  pilotoId: string;
}

const tipoIcons: Record<string, string> = {
  rendimiento: '📊',
  estrategia: '🏎️',
  resumen: '📋',
};

const riesgoColors: Record<string, string> = {
  bajo: 'text-green-400 bg-green-900/30',
  medio: 'text-yellow-400 bg-yellow-900/30',
  alto: 'text-red-400 bg-red-900/30',
};

export function InsightPanel({ insights, pilotoId }: InsightPanelProps) {
  if (insights.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">
          🤖 Insights IA - {pilotoId}
        </h3>
        <p className="text-xs text-gray-500 italic">Esperando análisis...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        🤖 Insights IA - {pilotoId}
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {insights.map((insight) => (
          <div
            key={insight.insightId}
            className="bg-gray-750 rounded p-3 border border-gray-600"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span>{tipoIcons[insight.tipo] || '💡'}</span>
                <span className="text-xs text-gray-400 capitalize">{insight.tipo}</span>
              </div>
              <div className="flex items-center gap-2">
                {insight.nivelRiesgo && (
                  <span className={`text-xs px-2 py-0.5 rounded ${riesgoColors[insight.nivelRiesgo]}`}>
                    Riesgo: {insight.nivelRiesgo}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {new Date(insight.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-200">{insight.texto}</p>
            {insight.fundamentacion && insight.fundamentacion.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                  Ver fundamentación
                </summary>
                <ul className="mt-1 text-xs text-gray-400 list-disc list-inside">
                  {insight.fundamentacion.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
