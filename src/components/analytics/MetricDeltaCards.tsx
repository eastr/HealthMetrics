import type { MetricDelta } from '../../utils/analytics'
import { useMetrics } from '../../hooks/useMetricColors'

interface MetricDeltaCardsProps {
  deltas: MetricDelta[]
  rangeLabel: string
}

export default function MetricDeltaCards({ deltas, rangeLabel }: MetricDeltaCardsProps) {
  const { metrics } = useMetrics()
  const byKey = new Map(deltas.map((d) => [d.key, d]))
  const hasComparison = deltas.some((d) => d.delta != null)

  if (!hasComparison) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Not enough history yet to compare with {rangeLabel}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {metrics.map((m) => {
        const d = byKey.get(m.key)
        return (
          <div key={m.key} className="rounded-xl bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-400">{m.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: m.color }}>
              {d?.current ?? '—'}
            </div>
            <DeltaBadge delta={d?.delta ?? null} previous={d?.previous ?? null} />
          </div>
        )
      })}
    </div>
  )
}

/** Scores are severity scales, so a rise is a worsening. */
function DeltaBadge({ delta, previous }: { delta: number | null; previous: number | null }) {
  if (delta == null) {
    return <div className="mt-1 text-xs text-slate-300">no prior data</div>
  }

  if (delta === 0) {
    return <div className="mt-1 text-xs text-slate-400">no change · was {previous}</div>
  }

  const worse = delta > 0
  return (
    <div
      className={`mt-1 text-xs font-medium ${worse ? 'text-rose-600' : 'text-emerald-600'}`}
      title={`Previous period average: ${previous}`}
    >
      {worse ? '▲' : '▼'} {Math.abs(delta)} · was {previous}
    </div>
  )
}
