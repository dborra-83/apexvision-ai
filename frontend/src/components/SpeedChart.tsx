/**
 * Gráfico de velocidad en tiempo real por piloto.
 * Muestra las últimas 60 muestras (aprox 1 minuto a 1 sample/s).
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface SpeedDataPoint {
  timestamp: number;
  velocidad: number;
  label: string;
}

interface SpeedChartProps {
  data: SpeedDataPoint[];
  pilotoId: string;
  color?: string;
}

export function SpeedChart({ data, pilotoId, color = '#3b82f6' }: SpeedChartProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">
        Velocidad - {pilotoId}
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            domain={['dataMin - 10', 'dataMax + 10']}
            unit=" km/h"
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563' }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Line
            type="monotone"
            dataKey="velocidad"
            stroke={color}
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
