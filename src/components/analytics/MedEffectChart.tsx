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
import type { DoseKind } from '../../types/entry'
import type { MedEffect } from '../../utils/analytics'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'

interface MedEffectChartProps {
  effects: MedEffect[]
  kind: DoseKind
}

const TAKEN_COLOR: Record<DoseKind, string> = {
  medication: '#7c3aed',
  vitamin: '#059669',
}

export default function MedEffectChart({ effects, kind }: MedEffectChartProps) {
  const isCoarse = useCoarsePointer()
  const comparable = effects.filter((e) => e.takenAvg != null && e.notTakenAvg != null)

  if (comparable.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Need days both with and without a logged {kind === 'vitamin' ? 'vitamin' : 'medication'} to
        compare
      </p>
    )
  }

  const chartData = comparable.map((e) => ({
    name: e.name,
    taken: e.takenAvg,
    notTaken: e.notTakenAvg,
  }))

  const notable = [...comparable].sort(
    (a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0),
  )[0]

  return (
    <div>
      <div className="h-64 w-full touch-pan-y">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
            {!isCoarse && <Tooltip contentStyle={{ fontSize: 12 }} />}
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="taken"
              name="Days taken"
              fill={TAKEN_COLOR[kind]}
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="notTaken" name="Days not taken" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        {comparable.map((e) => (
          <li key={e.name} className="flex items-baseline justify-between gap-2">
            <span className="truncate text-slate-700">{e.name}</span>
            <span className="shrink-0 tabular-nums">
              <span className={(e.delta ?? 0) < 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {(e.delta ?? 0) > 0 ? '+' : ''}
                {e.delta}
              </span>{' '}
              · {e.takenDays} vs {e.notTakenDays} days
            </span>
          </li>
        ))}
      </ul>

      {notable?.delta != null && notable.delta !== 0 && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Biggest difference:</span> {notable.name} —
          severity averaged {Math.abs(notable.delta)} {notable.delta < 0 ? 'lower' : 'higher'} on
          days it was logged.
        </p>
      )}
      <p className="mt-1 text-[11px] text-slate-400">
        Observational only: items taken in response to bad days will look worse than they are.
      </p>
    </div>
  )
}
