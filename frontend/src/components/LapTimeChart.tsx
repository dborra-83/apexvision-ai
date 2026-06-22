/**
 * Gráfico de tiempos por vuelta con comparación entre pilotos.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface LapTimeDataPoint {
  vuelta: number;
  [pilotoId: string]: number;
}

interface LapTimeChartProps {
  data: LapTimeDataPoint[];
  pilotos: Array<{ id: string; color: string; nombre: string }>;
}

export function LapTimeChart({ data, pilotos }: LapTimeChartProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Tiempos por Vuelta - Comparación
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="vuelta"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            label={{ value: 'Vuelta', position: 'insideBottom', offset: -5, fill: '#9ca3af' }}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            domain={['dataMin - 0.5', 'dataMax + 0.5']}
            label={{ value: 'Tiempo (s)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563' }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number) => [`${value.toFixed(3)}s`]}
          />
          <Legend
            wrapperStyle={{ color: '#e5e7eb', fontSize: 12 }}
          />
          {pilotos.map((piloto) => (
            <Line
              key={piloto.id}
              type="monotone"
              dataKey={piloto.id}
              name={piloto.nombre}
              stroke={piloto.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              animationDuration={300}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
