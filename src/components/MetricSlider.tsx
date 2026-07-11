import type { MetricKey } from '../types/entry'
import { getMetricScaleLabel, METRIC_SCALE_LABELS } from '../types/entry'
import { useMetrics } from '../hooks/useMetricColors'

interface MetricSliderProps {
  metric: MetricKey
  value: number
  onChange: (value: number) => void
}

const MIN = 1
const MAX = 10

export default function MetricSlider({ metric, value, onChange }: MetricSliderProps) {
  const { metrics } = useMetrics()
  const config = metrics.find((m) => m.key === metric)!
  const scale = METRIC_SCALE_LABELS[metric]
  const intensity = getMetricScaleLabel(metric, value)

  const decrement = () => onChange(Math.max(MIN, value - 1))
  const increment = () => onChange(Math.min(MAX, value + 1))

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-slate-800">{config.label}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: config.color }}
          >
            {value}
          </span>
          <span className="text-xs text-slate-400">/ 10</span>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= MIN}
          aria-label={`Decrease ${config.label}`}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>
        <span
          className="min-w-[3rem] text-center text-3xl font-bold tabular-nums"
          style={{ color: config.color }}
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={increment}
          disabled={value >= MAX}
          aria-label={`Increase ${config.label}`}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
      </div>

      <div className="flex justify-between gap-2 text-xs text-slate-400">
        <span className="max-w-[30%] truncate" title={scale[0]}>
          {scale[0]}
        </span>
        <span className="font-medium" style={{ color: config.color }}>
          {intensity}
        </span>
        <span className="max-w-[30%] truncate text-right" title={scale[9]}>
          {scale[9]}
        </span>
      </div>
    </div>
  )
}
