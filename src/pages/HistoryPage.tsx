import { useState } from 'react'
import { addDays, subDays, format, parseISO } from 'date-fns'
import { useEntries } from '../hooks/useEntries'
import ActivityList from '../components/ActivityList'
import EntryForm from '../components/EntryForm'
import MedicationForm from '../components/MedicationForm'
import { entriesForDate, formatDate } from '../utils/analytics'
import type { ActivityFilter, HealthEntry } from '../types/entry'
import { filterEntries, isMedicationEntry, isSymptomEntry } from '../types/entry'

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'symptoms', label: 'Symptoms' },
  { value: 'medication', label: 'Medications' },
]

export default function HistoryPage() {
  const { entries, editEntry, removeEntry } = useEntries()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [editing, setEditing] = useState<HealthEntry | null>(null)

  const dayEntries = filterEntries(entriesForDate(entries, selectedDate), filter)
  const dateLabel = formatDate(selectedDate.toISOString())

  const handleDelete = async (entry: HealthEntry) => {
    if (confirm('Delete this entry?')) {
      await removeEntry(entry)
      if (editing?.id === entry.id) setEditing(null)
    }
  }

  const editingSymptom = editing && isSymptomEntry(editing) ? editing : undefined
  const editingMedication = editing && isMedicationEntry(editing) ? editing : undefined

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

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
              filter === value
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {editingSymptom && (
        <div className="rounded-xl bg-primary-50 p-4 ring-1 ring-primary-100">
          <h3 className="mb-3 font-semibold text-primary-800">Edit symptom entry</h3>
          <EntryForm
            initial={editingSymptom}
            onSubmit={async (data) => {
              await editEntry({ ...editingSymptom, ...data })
              setSelectedDate(parseISO(data.timestamp))
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {editingMedication && (
        <div className="rounded-xl bg-violet-50 p-4 ring-1 ring-violet-100">
          <h3 className="mb-3 font-semibold text-violet-800">Edit medication</h3>
          <MedicationForm
            initial={editingMedication}
            onSubmit={async (data) => {
              await editEntry({ ...editingMedication, ...data })
              setSelectedDate(parseISO(data.timestamp))
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      <ActivityList
        entries={dayEntries}
        onEdit={setEditing}
        onDelete={handleDelete}
        emptyMessage="No entries for this day"
      />
    </div>
  )
}
