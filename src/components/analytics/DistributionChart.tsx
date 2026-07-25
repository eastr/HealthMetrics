import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { HealthEntry } from '../../types/entry'
import { getMetricScaleLabel } from '../../types/entry'
import { scoreDistribution } from '../../utils/analytics'
import { useMetrics } from '../../hooks/useMetricColors'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'

interface DistributionChartProps {
  entries: HealthEntry[]
}

export default function DistributionChart({ entries }: DistributionChartProps) {
  const isCoarse = useCoarsePointer()
  const { metrics } = useMetrics()
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? '')

  useEffect(() => {
    if (metrics.length > 0 && !metrics.some((m) => m.key === metricKey)) {
      setMetricKey(metrics[0].key)
    }
  }, [metrics, metricKey])

  const metric = metrics.find((m) => m.key === metricKey)
  const buckets = metric ? scoreDistribution(entries, metric.key) : []
  const total = buckets.reduce((acc, b) => acc + b.count, 0)

  if (!metric || total === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No scores recorded for this range yet
      </p>
    )
  }

  const chartData = buckets.map((b) => ({
    ...b,
    name: getMetricScaleLabel(metric, b.score, metrics),
    pct: Math.round((b.count / total) * 100),
  }))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetricKey(m.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
              m.key === metricKey ? 'opacity-100' : 'opacity-40'
            }`}
            style={{ backgroundColor: m.color + '22', color: m.color }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="h-56 w-full touch-pan-y">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            {!isCoarse && (
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value) => [`${value} entries`, 'Count']}
                labelFormatter={(score) =>
                  `${score} · ${chartData.find((d) => d.label === score)?.name ?? ''}`
                }
              />
            )}
            <Bar dataKey="count" name="Entries" fill={metric.color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-center text-xs text-slate-400">
        {total} {total === 1 ? 'entry' : 'entries'} scored for {metric.label}
      </p>
    </div>
  )
}
