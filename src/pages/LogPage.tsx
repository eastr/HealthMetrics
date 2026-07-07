import { useState } from 'react'
import { useEntries } from '../hooks/useEntries'
import EntryForm from '../components/EntryForm'
import EntryList from '../components/EntryList'
import { entriesForDate } from '../utils/analytics'
import type { HealthEntry } from '../types/entry'

export default function LogPage() {
  const { entries, addEntry, editEntry, removeEntry } = useEntries()
  const [editing, setEditing] = useState<HealthEntry | null>(null)
  const todayEntries = entriesForDate(entries, new Date())

  const handleDelete = async (entry: HealthEntry) => {
    if (confirm('Delete this entry?')) {
      await removeEntry(entry)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          {editing ? 'Edit entry' : 'Log symptoms'}
        </h2>
        <EntryForm
          key={editing?.id ?? 'new'}
          initial={editing ?? undefined}
          onSubmit={async (data) => {
            if (editing) {
              await editEntry({ ...editing, ...data })
              setEditing(null)
            } else {
              await addEntry({
                fatigue: data.fatigue,
                mood: data.mood,
                nausea: data.nausea,
                pain: data.pain,
                notes: data.notes,
                timestamp: data.timestamp,
              })
            }
          }}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          Today&apos;s entries ({todayEntries.length})
        </h2>
        <EntryList
          entries={todayEntries}
          onEdit={setEditing}
          onDelete={handleDelete}
          emptyMessage="No entries logged today. Use the form above to log your first entry."
        />
      </section>
    </div>
  )
}
