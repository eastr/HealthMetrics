import type { MetricKey } from '../types/entry'
import { METRICS } from '../types/entry'

interface MetricSliderProps {
  metric: MetricKey
  value: number
  onChange: (value: number) => void
}

export default function MetricSlider({ metric, value, onChange }: MetricSliderProps) {
  const config = METRICS.find((m) => m.key === metric)!
  const intensity =
    value <= 3 ? 'Low' : value <= 6 ? 'Moderate' : value <= 8 ? 'High' : 'Severe'

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <label className="font-semibold text-slate-800" htmlFor={metric}>
          {config.label}
        </label>
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
      <input
        id={metric}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mb-2"
        style={{ accentColor: config.color }}
      />
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
