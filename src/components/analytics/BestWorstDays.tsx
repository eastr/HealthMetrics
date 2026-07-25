import type { DayScore } from '../../utils/analytics'

interface BestWorstDaysProps {
  best: DayScore[]
  worst: DayScore[]
}

export default function BestWorstDays({ best, worst }: BestWorstDaysProps) {
  if (best.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No scored days in this range</p>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DayList title="Best days" subtitle="Lowest average severity" days={best} tone="emerald" />
      <DayList title="Worst days" subtitle="Highest average severity" days={worst} tone="rose" />
    </div>
  )
}

const TONES = {
  emerald: { shell: 'bg-emerald-50 ring-emerald-100', title: 'text-emerald-900', score: 'text-emerald-700' },
  rose: { shell: 'bg-rose-50 ring-rose-100', title: 'text-rose-900', score: 'text-rose-700' },
}

function DayList({
  title,
  subtitle,
  days,
  tone,
}: {
  title: string
  subtitle: string
  days: DayScore[]
  tone: keyof typeof TONES
}) {
  const styles = TONES[tone]

  return (
    <div className={`rounded-xl p-3 ring-1 ${styles.shell}`}>
      <h3 className={`text-sm font-semibold ${styles.title}`}>{title}</h3>
      <p className="mb-2 text-xs text-slate-400">{subtitle}</p>
      <ul className="space-y-1.5">
        {days.map((day) => (
          <li
            key={day.date}
            className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-800">{day.label}</div>
              <div className="text-xs text-slate-400">
                {day.count} {day.count === 1 ? 'entry' : 'entries'}
              </div>
            </div>
            <span className={`shrink-0 text-lg font-bold tabular-nums ${styles.score}`}>
              {day.score}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
