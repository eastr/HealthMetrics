import type { MetricKey } from '../../types/entry'
import { METRICS } from '../../types/entry'

interface SummaryCardsProps {
  today: Record<MetricKey, number | null>
  week: Record<MetricKey, number | null>
}

export default function SummaryCards({ today, week }: SummaryCardsProps) {
  return (
    <div className="space-y-4">
      <CardGroup title="Today" averages={today} />
      <CardGroup title="7-day average" averages={week} />
    </div>
  )
}

function CardGroup({
  title,
  averages,
}: {
  title: string
  averages: Record<MetricKey, number | null>
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-500">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {METRICS.map((m) => (
          <div
            key={m.key}
            className="rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-100"
          >
            <div className="text-xs text-slate-400">{m.label}</div>
            <div
              className="mt-1 text-2xl font-bold tabular-nums"
              style={{ color: m.color }}
            >
              {averages[m.key] ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
