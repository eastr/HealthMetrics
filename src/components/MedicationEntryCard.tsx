import type { MedicationEntry } from '../types/entry'
import { formatTime } from '../utils/analytics'

interface MedicationEntryCardProps {
  entry: MedicationEntry
  onEdit?: (entry: MedicationEntry) => void
  onDelete?: (entry: MedicationEntry) => void
}

export default function MedicationEntryCard({ entry, onEdit, onDelete }: MedicationEntryCardProps) {
  return (
    <li className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
      <div className="flex">
        <div className="w-1 shrink-0 bg-violet-500" aria-hidden />
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-slate-800">
              <span aria-hidden>💊</span>
              {formatTime(entry.timestamp)}
            </span>
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
          <div className="font-semibold text-slate-900">
            {entry.medication}
            {entry.dose && <span className="font-normal text-slate-600"> · {entry.dose}</span>}
          </div>
          {entry.notes && (
            <p className="mt-2 text-sm text-slate-600">{entry.notes}</p>
          )}
        </div>
      </div>
    </li>
  )
}
