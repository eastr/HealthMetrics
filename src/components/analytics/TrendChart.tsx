import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { DailyAverage } from '../../utils/analytics'
import { METRICS } from '../../types/entry'
import type { MetricKey } from '../../types/entry'

interface TrendChartProps {
  data: DailyAverage[]
}

export default function TrendChart({ data }: TrendChartProps) {
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>(() =>
    Object.fromEntries(METRICS.map((m) => [m.key, true])) as Record<MetricKey, boolean>,
  )

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Not enough data for trend chart
      </p>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setVisible((v) => ({ ...v, [m.key]: !v[m.key] }))}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
              visible[m.key] ? 'opacity-100' : 'opacity-40'
            }`}
            style={{ backgroundColor: m.color + '22', color: m.color }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[1, 10]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {METRICS.map(
              (m) =>
                visible[m.key] && (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
