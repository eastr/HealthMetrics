import type { AdherenceKind, AdherenceStats, StreakStats } from '../../utils/analytics'

interface AdherenceCardProps {
  stats: AdherenceStats
  streaks: StreakStats
}

const KIND_STYLES: Record<AdherenceKind, { label: string; bar: string; text: string }> = {
  medication: { label: 'Medications', bar: 'bg-violet-600', text: 'text-violet-700' },
  vitamin: { label: 'Vitamins', bar: 'bg-emerald-600', text: 'text-emerald-700' },
  checkin: { label: 'Check-ins', bar: 'bg-primary-600', text: 'text-primary-700' },
}

function pctColor(pct: number | null): string {
  if (pct == null) return 'text-slate-400'
  if (pct >= 90) return 'text-emerald-600'
  if (pct >= 70) return 'text-amber-600'
  return 'text-rose-600'
}

export default function AdherenceCard({ stats, streaks }: AdherenceCardProps) {
  if (stats.scheduled === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No schedules set up yet — add medication, vitamin, or check-in times to track adherence.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className={`text-4xl font-bold tabular-nums ${pctColor(stats.pct)}`}>
            {stats.pct}%
          </div>
          <div className="text-xs text-slate-400">
            {stats.taken} of {stats.scheduled} scheduled logged
          </div>
        </div>
        <div className="flex gap-2">
          <StreakBadge label="Current streak" value={streaks.currentComplete} />
          <StreakBadge label="Best streak" value={streaks.longestComplete} muted />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(KIND_STYLES) as AdherenceKind[]).map((kind) => {
          const t = stats.byKind[kind]
          return (
            <div key={kind} className="rounded-lg bg-slate-50 p-2 text-center">
              <div className="text-xs text-slate-400">{KIND_STYLES[kind].label}</div>
              <div className={`text-lg font-bold tabular-nums ${pctColor(t.pct)}`}>
                {t.pct == null ? '—' : `${t.pct}%`}
              </div>
            </div>
          )
        })}
      </div>

      <ul className="space-y-2">
        {stats.items.map((item) => (
          <li key={item.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">{item.label}</span>
              <span className={`shrink-0 tabular-nums ${KIND_STYLES[item.kind].text}`}>
                {item.taken}/{item.scheduled}
                {item.pct != null && ` · ${item.pct}%`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${KIND_STYLES[item.kind].bar}`}
                style={{ width: `${item.pct ?? 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StreakBadge({
  label,
  value,
  muted,
}: {
  label: string
  value: number
  muted?: boolean
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2 text-center ring-1 ${
        muted ? 'bg-slate-50 ring-slate-100' : 'bg-primary-50 ring-primary-100'
      }`}
    >
      <div className="text-xs text-slate-400">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums ${
          muted ? 'text-slate-600' : 'text-primary-700'
        }`}
      >
        {value} {value === 1 ? 'day' : 'days'}
      </div>
    </div>
  )
}
