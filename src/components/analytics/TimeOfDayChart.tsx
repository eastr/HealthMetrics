import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { BucketAverage } from '../../utils/analytics'
import { useMetrics } from '../../hooks/useMetricColors'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'
import OrderedLegend from './OrderedLegend'

interface TimeOfDayChartProps {
  data: BucketAverage[]
}

export default function TimeOfDayChart({ data }: TimeOfDayChartProps) {
  const isCoarse = useCoarsePointer()
  const { metrics } = useMetrics()
  const hasData = data.some((d) => d.count > 0)

  if (!hasData) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Not enough data for time-of-day breakdown
      </p>
    )
  }

  const chartData = data.map((d) => {
    const row: Record<string, string | number | null> = {
      name: d.bucket === 'morning' ? 'Morning' : d.bucket === 'afternoon' ? 'Afternoon' : 'Evening',
      count: d.count,
    }
    for (const m of metrics) {
      const v = d[m.key]
      row[m.key] = d.count > 0 && typeof v === 'number' ? v : null
    }
    return row
  })

  return (
    <div className="h-64 w-full touch-pan-y">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
          {!isCoarse && <Tooltip contentStyle={{ fontSize: 12 }} />}
          <OrderedLegend />
          {metrics.map((m) => (
            <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
