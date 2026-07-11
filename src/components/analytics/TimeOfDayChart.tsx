import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { BucketAverage } from '../../utils/analytics'
import { METRICS } from '../../types/entry'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'

interface TimeOfDayChartProps {
  data: BucketAverage[]
}

export default function TimeOfDayChart({ data }: TimeOfDayChartProps) {
  const isCoarse = useCoarsePointer()
  const hasData = data.some((d) => d.count > 0)

  if (!hasData) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Not enough data for time-of-day breakdown
      </p>
    )
  }

  const chartData = data.map((d) => ({
    name: d.bucket === 'morning' ? 'Morning' : d.bucket === 'afternoon' ? 'Afternoon' : 'Evening',
    fatigue: d.count > 0 ? d.fatigue : null,
    mood: d.count > 0 ? d.mood : null,
    nausea: d.count > 0 ? d.nausea : null,
    pain: d.count > 0 ? d.pain : null,
    stiffness: d.count > 0 ? d.stiffness : null,
    dizziness: d.count > 0 ? d.dizziness : null,
    count: d.count,
  }))

  return (
    <div className="h-64 w-full touch-pan-y">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
          {!isCoarse && <Tooltip contentStyle={{ fontSize: 12 }} />}
          <Legend />
          {METRICS.map((m) => (
            <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
