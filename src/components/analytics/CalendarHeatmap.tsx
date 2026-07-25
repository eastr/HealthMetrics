import { useState } from 'react'
import { addDays, differenceInCalendarDays, format, getDay, startOfDay, subDays } from 'date-fns'
import type { DayScore } from '../../utils/analytics'

type HeatmapMode = 'severity' | 'adherence'

export interface AdherenceDay {
  scheduled: number
  taken: number
  pct: number
}

interface CalendarHeatmapProps {
  severity: Map<string, DayScore>
  adherence: Map<string, AdherenceDay>
  days: number
}

const EMPTY_COLOR = '#f1f5f9'

const SEVERITY_SCALE = [
  { max: 2, color: '#a7f3d0', label: '1–2' },
  { max: 4, color: '#6ee7b7', label: '3–4' },
  { max: 6, color: '#fcd34d', label: '5–6' },
  { max: 8, color: '#fb923c', label: '7–8' },
  { max: 10, color: '#ef4444', label: '9–10' },
]

const ADHERENCE_SCALE = [
  { min: 100, color: '#059669', label: '100%' },
  { min: 80, color: '#34d399', label: '80–99%' },
  { min: 50, color: '#fbbf24', label: '50–79%' },
  { min: 1, color: '#fb7185', label: '1–49%' },
  { min: 0, color: '#e11d48', label: '0%' },
]

function severityColor(score: number): string {
  return SEVERITY_SCALE.find((s) => score <= s.max)?.color ?? EMPTY_COLOR
}

function adherenceColor(pct: number): string {
  return ADHERENCE_SCALE.find((s) => pct >= s.min)?.color ?? EMPTY_COLOR
}

export default function CalendarHeatmap({ severity, adherence, days }: CalendarHeatmapProps) {
  const [mode, setMode] = useState<HeatmapMode>('severity')
  const [selected, setSelected] = useState<string | null>(null)

  const hasSeverity = severity.size > 0
  const hasAdherence = adherence.size > 0

  if (!hasSeverity && !hasAdherence) {
    return <p className="py-8 text-center text-sm text-slate-400">No data to map yet</p>
  }

  const active: HeatmapMode = mode === 'adherence' && !hasAdherence ? 'severity' : mode

  const today = startOfDay(new Date())
  const rangeStart = subDays(today, days - 1)
  const gridStart = subDays(rangeStart, getDay(rangeStart))
  const weeks = Math.ceil((differenceInCalendarDays(today, gridStart) + 1) / 7)

  const colorFor = (dateKey: string): string => {
    if (active === 'severity') {
      const day = severity.get(dateKey)
      return day ? severityColor(day.score) : EMPTY_COLOR
    }
    const day = adherence.get(dateKey)
    return day ? adherenceColor(day.pct) : EMPTY_COLOR
  }

  const selectedSeverity = selected ? severity.get(selected) : undefined
  const selectedAdherence = selected ? adherence.get(selected) : undefined

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <ModeButton current={active} value="severity" onSelect={setMode}>
          Severity
        </ModeButton>
        {hasAdherence && (
          <ModeButton current={active} value="adherence" onSelect={setMode}>
            Adherence
          </ModeButton>
        )}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1">
          <div className="mr-1 flex shrink-0 flex-col gap-1 pt-0.5 text-[9px] leading-[14px] text-slate-400">
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
              <div key={i} className="h-3.5">
                {label}
              </div>
            ))}
          </div>

          {Array.from({ length: weeks }, (_, week) => (
            <div key={week} className="flex shrink-0 flex-col gap-1">
              {Array.from({ length: 7 }, (_, weekday) => {
                const date = addDays(gridStart, week * 7 + weekday)
                if (date < rangeStart || date > today) {
                  return <div key={weekday} className="h-3.5 w-3.5" />
                }
                const dateKey = format(date, 'yyyy-MM-dd')
                const isSelected = selected === dateKey
                return (
                  <button
                    key={weekday}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : dateKey)}
                    title={format(date, 'EEE, MMM d')}
                    aria-label={format(date, 'EEE, MMM d')}
                    className={`h-3.5 w-3.5 rounded-[3px] ${
                      isSelected ? 'ring-2 ring-slate-700' : 'ring-1 ring-black/5'
                    }`}
                    style={{ backgroundColor: colorFor(dateKey) }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
        {(active === 'severity' ? SEVERITY_SCALE : ADHERENCE_SCALE).map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: EMPTY_COLOR }}
          />
          no data
        </span>
      </div>

      {selected && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs ring-1 ring-slate-100">
          <div className="font-medium text-slate-800">
            {format(new Date(selected + 'T12:00:00'), 'EEE, MMM d')}
          </div>
          <div className="mt-1 text-slate-500">
            {selectedSeverity
              ? `Severity ${selectedSeverity.score} across ${selectedSeverity.count} ${
                  selectedSeverity.count === 1 ? 'entry' : 'entries'
                }`
              : 'No symptom entries'}
          </div>
          {selectedAdherence && (
            <div className="text-slate-500">
              Adherence {selectedAdherence.pct}% ({selectedAdherence.taken}/
              {selectedAdherence.scheduled} scheduled)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ModeButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: HeatmapMode
  value: HeatmapMode
  onSelect: (mode: HeatmapMode) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-lg px-3 py-1 text-xs font-medium ${
        current === value
          ? 'bg-primary-700 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}
