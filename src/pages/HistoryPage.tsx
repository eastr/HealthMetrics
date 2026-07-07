import { useState } from 'react'
import { addDays, subDays, format } from 'date-fns'
import { useEntries } from '../hooks/useEntries'
import EntryList from '../components/EntryList'
import EntryForm from '../components/EntryForm'
import { entriesForDate, formatDate } from '../utils/analytics'
import type { HealthEntry } from '../types/entry'

export default function HistoryPage() {
  const { entries, editEntry, removeEntry } = useEntries()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [editing, setEditing] = useState<HealthEntry | null>(null)

  const dayEntries = entriesForDate(entries, selectedDate)
  const dateLabel = formatDate(selectedDate.toISOString())

  const handleDelete = async (entry: HealthEntry) => {
    if (confirm('Delete this entry?')) {
      await removeEntry(entry)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
        <button
          onClick={() => setSelectedDate((d) => subDays(d, 1))}
          className="rounded-lg px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
        >
          ← Prev
        </button>
        <div className="text-center">
          <div className="font-semibold text-slate-800">{dateLabel}</div>
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(new Date(e.target.value + 'T12:00:00'))
            }}
            className="mt-1 text-xs text-slate-500"
          />
        </div>
        <button
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          disabled={format(selectedDate, 'yyyy-MM-dd') >= format(new Date(), 'yyyy-MM-dd')}
          className="rounded-lg px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {editing && entriesForDate(entries, selectedDate).some((e) => e.id === editing.id) && (
        <div className="rounded-xl bg-primary-50 p-4 ring-1 ring-primary-100">
          <h3 className="mb-3 font-semibold text-primary-800">Edit entry</h3>
          <EntryForm
            initial={editing}
            onSubmit={async (data) => {
              await editEntry({ ...editing, ...data })
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      <EntryList
        entries={dayEntries}
        onEdit={setEditing}
        onDelete={handleDelete}
        emptyMessage="No entries for this day"
      />
    </div>
  )
}
