import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MedicationDoseDay } from '../../utils/analytics'

interface MedicationDoseChartProps {
  data: MedicationDoseDay[]
}

export default function MedicationDoseChart({ data }: MedicationDoseChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        No medication data for chart
      </p>
    )
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => [`${value} doses`, 'Total']}
          />
          <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
