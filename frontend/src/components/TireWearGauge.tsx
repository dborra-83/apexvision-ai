/**
 * Indicador visual de desgaste de neumáticos.
 * Barra de progreso con colores según nivel de desgaste.
 */

interface TireWearGaugeProps {
  desgaste: number;         // 0-100%
  compuesto: string;        // 'soft' | 'medium' | 'hard' | 'inter' | 'wet'
  vueltasUsadas: number;
}

const compuestoColors: Record<string, string> = {
  soft: 'bg-red-500',
  medium: 'bg-yellow-500',
  hard: 'bg-white',
  inter: 'bg-green-500',
  wet: 'bg-blue-500',
};

const compuestoLabels: Record<string, string> = {
  soft: 'Blando',
  medium: 'Medio',
  hard: 'Duro',
  inter: 'Intermedio',
  wet: 'Lluvia',
};

function getWearColor(desgaste: number): string {
  if (desgaste < 30) return 'bg-green-500';
  if (desgaste < 60) return 'bg-yellow-500';
  if (desgaste < 80) return 'bg-orange-500';
  return 'bg-red-500';
}

export function TireWearGauge({ desgaste, compuesto, vueltasUsadas }: TireWearGaugeProps) {
  const wearColor = getWearColor(desgaste);
  const compColor = compuestoColors[compuesto] || 'bg-gray-500';

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${compColor}`} />
          <span className="text-xs text-gray-300 font-medium">
            {compuestoLabels[compuesto] || compuesto}
          </span>
        </div>
        <span className="text-xs text-gray-400">{vueltasUsadas} vueltas</span>
      </div>

      {/* Barra de desgaste */}
      <div className="w-full bg-gray-700 rounded-full h-3 mb-1">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${wearColor}`}
          style={{ width: `${Math.min(100, desgaste)}%` }}
        />
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Desgaste</span>
        <span className={desgaste > 70 ? 'text-red-400 font-bold' : 'text-gray-300'}>
          {desgaste.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
