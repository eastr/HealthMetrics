import type { HealthEntry } from '../types/entry'
import { useMetrics } from '../hooks/useMetricColors'
import { formatTime } from '../utils/analytics'

interface EntryListProps {
  entries: HealthEntry[]
  onEdit?: (entry: HealthEntry) => void
  onDelete?: (entry: HealthEntry) => void
  emptyMessage?: string
}

export default function EntryList({
  entries,
  onEdit,
  onDelete,
  emptyMessage = 'No entries yet',
}: EntryListProps) {
  const { metrics } = useMetrics()

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">{emptyMessage}</p>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-slate-800">{formatTime(entry.timestamp)}</span>
            <div className="flex items-center gap-2">
              {entry.syncStatus === 'pending' && (
                <span className="text-xs text-amber-600">Pending sync</span>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(entry)}
                  className="text-xs font-medium text-primary-600 hover:text-primary-800"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(entry)}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {metrics.map((m) => (
              <div key={m.key} className="text-center">
                <div className="text-xs text-slate-400">{m.label}</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: m.color }}>
                  {entry[m.key]}
                </div>
              </div>
            ))}
          </div>
          {entry.notes && (
            <p className="mt-3 border-t border-slate-100 pt-2 text-sm text-slate-600">
              {entry.notes}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
