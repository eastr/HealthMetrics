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
import type { WeekdayAverage } from '../../utils/analytics'
import type { MetricKey } from '../../types/entry'
import { useMetrics } from '../../hooks/useMetricColors'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'
import OrderedLegend from './OrderedLegend'

interface WeekdayChartProps {
  data: WeekdayAverage[]
}

export default function WeekdayChart({ data }: WeekdayChartProps) {
  const isCoarse = useCoarsePointer()
  const { metrics } = useMetrics()
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>(() =>
    Object.fromEntries(metrics.map((m) => [m.key, true])) as Record<MetricKey, boolean>,
  )

  useEffect(() => {
    setVisible((prev) => {
      const next = { ...prev }
      for (const m of metrics) {
        if (next[m.key] === undefined) next[m.key] = true
      }
      return next
    })
  }, [metrics])

  if (!data.some((d) => d.count > 0)) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Not enough data for day-of-week patterns
      </p>
    )
  }

  const visibleMetrics = metrics.filter((m) => visible[m.key])
  const chartData = data.map((d) => {
    const row: Record<string, string | number | null> = { label: d.label, count: d.count }
    for (const m of metrics) {
      const v = d[m.key]
      row[m.key] = d.count > 0 && typeof v === 'number' ? v : null
    }
    return row
  })

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {metrics.map((m) => (
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

      <div className="h-64 w-full touch-pan-y">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
            {!isCoarse && <Tooltip contentStyle={{ fontSize: 12 }} />}
            <OrderedLegend />
            {visibleMetrics.map((m) => (
              <Bar
                key={m.key}
                dataKey={m.key}
                name={m.label}
                fill={m.color}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
