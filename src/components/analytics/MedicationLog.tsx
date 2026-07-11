import type { HealthEntry } from '../../types/entry'
import { formatTime } from '../../utils/analytics'
import {
  medicationsByDay,
  medicationFrequency,
  type MedicationDayGroup,
  type MedicationFrequency,
} from '../../utils/analytics'

interface MedicationLogProps {
  entries: HealthEntry[]
  days: number
}

function FrequencyCards({ items, days }: { items: MedicationFrequency[]; days: number }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">No medications logged in this period.</p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.name}
          className="rounded-lg bg-violet-50 px-4 py-3 ring-1 ring-violet-100"
        >
          <div className="font-semibold text-violet-900">{item.name}</div>
          <div className="text-sm text-violet-700">
            {item.count} {item.count === 1 ? 'dose' : 'doses'} in {days} days
          </div>
        </div>
      ))}
    </div>
  )
}

function DailyLog({ groups }: { groups: MedicationDayGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-400">No medication entries in this period.</p>
    )
  }

  return (
    <ul className="space-y-4">
      {groups.map((group) => (
        <li key={group.date}>
          <div className="mb-2 font-medium text-slate-800">{group.label}</div>
          <ul className="space-y-1.5 border-l-2 border-violet-200 pl-3">
            {group.entries.map((entry) => (
              <li key={entry.id} className="text-sm text-slate-700">
                <span className="tabular-nums text-slate-500">{formatTime(entry.timestamp)}</span>
                {'  '}
                <span className="font-medium">{entry.medication}</span>
                {entry.dose && <span className="text-slate-600"> {entry.dose}</span>}
                {entry.notes && (
                  <span className="text-slate-500"> — {entry.notes}</span>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export default function MedicationLog({ entries, days }: MedicationLogProps) {
  const byDay = medicationsByDay(entries, days)
  const frequency = medicationFrequency(entries, days)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Daily log</h3>
        <DailyLog groups={byDay} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Frequency</h3>
        <FrequencyCards items={frequency} days={days} />
      </div>
    </div>
  )
}
