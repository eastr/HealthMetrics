import type { HealthEntry } from '../types/entry'
import { isMedicationEntry } from '../types/entry'
import { SymptomEntryCard } from './EntryList'
import MedicationEntryCard from './MedicationEntryCard'

interface ActivityListProps {
  entries: HealthEntry[]
  onEdit?: (entry: HealthEntry) => void
  onDelete?: (entry: HealthEntry) => void
  emptyMessage?: string
}

export default function ActivityList({
  entries,
  onEdit,
  onDelete,
  emptyMessage = 'No entries yet',
}: ActivityListProps) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">{emptyMessage}</p>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id}>
          {isMedicationEntry(entry) ? (
            <MedicationEntryCard entry={entry} onEdit={onEdit} onDelete={onDelete} />
          ) : (
            <SymptomEntryCard entry={entry} onEdit={onEdit} onDelete={onDelete} />
          )}
        </li>
      ))}
    </ul>
  )
}
