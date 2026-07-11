import type { MetricKey } from '../types/entry'
import { METRICS } from '../types/entry'

interface MetricSliderProps {
  metric: MetricKey
  value: number
  onChange: (value: number) => void
}

const MIN = 1
const MAX = 10

export default function MetricSlider({ metric, value, onChange }: MetricSliderProps) {
  const config = METRICS.find((m) => m.key === metric)!
  const intensity =
    value <= 3 ? 'Low' : value <= 6 ? 'Moderate' : value <= 8 ? 'High' : 'Severe'

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

      <div className="flex justify-between text-xs text-slate-400">
        <span>1</span>
        <span className="font-medium" style={{ color: config.color }}>
          {intensity}
        </span>
        <span>10</span>
      </div>
    </div>
  )
}
