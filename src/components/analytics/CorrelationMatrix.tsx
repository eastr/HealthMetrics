import type { MetricCorrelation } from '../../utils/analytics'
import { useMetrics } from '../../hooks/useMetricColors'

interface CorrelationMatrixProps {
  correlations: MetricCorrelation[]
}

/** Blue for negative, red for positive, fading to neutral near zero. */
function cellColor(r: number | null): string {
  if (r == null) return '#f8fafc'
  const alpha = Math.min(1, Math.abs(r)) * 0.85
  return r >= 0 ? `rgba(220, 38, 38, ${alpha})` : `rgba(37, 99, 235, ${alpha})`
}

function textColor(r: number | null): string {
  if (r == null) return '#cbd5e1'
  return Math.abs(r) > 0.5 ? '#ffffff' : '#334155'
}

export default function CorrelationMatrix({ correlations }: CorrelationMatrixProps) {
  const { metrics } = useMetrics()
  const usable = correlations.filter((c) => c.r != null)

  if (metrics.length < 2 || usable.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Need at least three days with two or more metrics logged
      </p>
    )
  }

  const lookup = new Map<string, MetricCorrelation>()
  for (const c of correlations) {
    lookup.set(`${c.a}|${c.b}`, c)
    lookup.set(`${c.b}|${c.a}`, c)
  }

  const strongest = [...usable].sort((a, b) => Math.abs(b.r!) - Math.abs(a.r!))[0]
  const labelFor = (key: string) => metrics.find((m) => m.key === key)?.label ?? key

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th />
              {metrics.map((m) => (
                <th key={m.key} className="px-1 pb-1 font-medium" style={{ color: m.color }}>
                  {m.label.slice(0, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((row) => (
              <tr key={row.key}>
                <th
                  className="whitespace-nowrap pr-2 text-right font-medium"
                  style={{ color: row.color }}
                >
                  {row.label}
                </th>
                {metrics.map((col) => {
                  if (row.key === col.key) {
                    return (
                      <td
                        key={col.key}
                        className="h-9 w-9 rounded bg-slate-100 text-center text-slate-300"
                      >
                        —
                      </td>
                    )
                  }
                  const c = lookup.get(`${row.key}|${col.key}`)
                  const r = c?.r ?? null
                  return (
                    <td
                      key={col.key}
                      title={
                        r == null
                          ? 'Not enough overlapping days'
                          : `${labelFor(row.key)} vs ${labelFor(col.key)}: r = ${r} over ${c?.n} days`
                      }
                      className="h-9 w-9 rounded text-center font-medium tabular-nums"
                      style={{ backgroundColor: cellColor(r), color: textColor(r) }}
                    >
                      {r == null ? '·' : r.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        <span className="font-medium text-slate-700">Strongest link:</span>{' '}
        {labelFor(strongest.a)} and {labelFor(strongest.b)} move{' '}
        {strongest.r! >= 0 ? 'together' : 'in opposite directions'} (r ={' '}
        {strongest.r!.toFixed(2)} over {strongest.n} days).
      </p>
      <p className="mt-1 text-[11px] text-slate-400">
        Red means the two rise together, blue means one rises as the other falls. Correlation is
        not causation.
      </p>
    </div>
  )
}
