import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DailyAverage } from '../../utils/analytics'
import type { MetricKey } from '../../types/entry'
import { useMetrics } from '../../hooks/useMetricColors'
import { useCoarsePointer } from '../../hooks/useCoarsePointer'
import OrderedLegend from './OrderedLegend'

interface TrendChartProps {
  data: DailyAverage[]
}

export default function TrendChart({ data }: TrendChartProps) {
  const isCoarse = useCoarsePointer()
  const { metrics } = useMetrics()
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>(() =>
    Object.fromEntries(metrics.map((m) => [m.key, true])) as Record<MetricKey, boolean>,
  )
  const [selectedDay, setSelectedDay] = useState<DailyAverage | null>(null)

  useEffect(() => {
    setSelectedDay((prev) =>
      prev && data.some((d) => d.date === prev.date) ? prev : null,
    )
  }, [data])

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Not enough data for trend chart
      </p>
    )
  }

  const visibleMetrics = metrics.filter((m) => visible[m.key])

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setVisible((v) => ({ ...v, [m.key]: !v[m.key] }))}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
              visible[m.key] ? 'opacity-100' : 'opacity-40'
            }`}
            style={{ backgroundColor: m.color + '22', color: m.color }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {isCoarse && (
        <p className="mb-2 text-xs text-slate-400">Tap a point to see that day&apos;s averages</p>
      )}

      <div className="h-64 w-full touch-pan-y">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[1, 10]} tick={{ fontSize: 11 }} />
            {!isCoarse && (
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                wrapperStyle={{ outline: 'none' }}
              />
            )}
            <OrderedLegend />
            {visibleMetrics.map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                connectNulls
                dot={(props) => {
                  const { cx, cy, index, key, stroke } = props
                  if (cx == null || cy == null || index == null) return null
                  const isSelected = selectedDay?.date === data[index]?.date
                  return (
                    <circle
                      key={key}
                      cx={cx}
                      cy={cy}
                      r={isCoarse ? (isSelected ? 7 : 5) : 3}
                      fill={stroke}
                      stroke={isSelected ? '#0f766e' : '#fff'}
                      strokeWidth={isSelected ? 2 : 1}
                      onClick={
                        isCoarse
                          ? (e) => {
                              e.stopPropagation()
                              setSelectedDay(data[index])
                            }
                          : undefined
                      }
                      style={isCoarse ? { cursor: 'pointer' } : undefined}
                    />
                  )
                }}
                activeDot={isCoarse ? false : { r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {isCoarse && selectedDay && (
        <div className="mt-3 flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
          <div className="min-w-0">
            <div className="font-medium text-slate-800">{selectedDay.label}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {visibleMetrics.map((m) => (
                <span key={m.key} style={{ color: m.color }}>
                  {m.label} {selectedDay[m.key]}
                </span>
              ))}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {selectedDay.count} {selectedDay.count === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            aria-label="Dismiss day details"
            className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
