import { useState } from 'react'
import { useEntries } from '../hooks/useEntries'
import EntryForm from '../components/EntryForm'
import MedicationForm from '../components/MedicationForm'
import ActivityList from '../components/ActivityList'
import { entriesForDate } from '../utils/analytics'
import type { HealthEntry } from '../types/entry'
import { isMedicationEntry, isSymptomEntry } from '../types/entry'

type LogMode = 'symptoms' | 'medication'

export default function LogPage() {
  const { entries, addSymptomEntry, addMedication, editEntry, removeEntry } = useEntries()
  const [mode, setMode] = useState<LogMode>('symptoms')
  const [editing, setEditing] = useState<HealthEntry | null>(null)
  const todayEntries = entriesForDate(entries, new Date())

  const handleDelete = async (entry: HealthEntry) => {
    if (confirm('Delete this entry?')) {
      await removeEntry(entry)
      if (editing?.id === entry.id) setEditing(null)
    }
  }

  const handleEdit = (entry: HealthEntry) => {
    setEditing(entry)
    setMode(isMedicationEntry(entry) ? 'medication' : 'symptoms')
  }

  const editingSymptom = editing && isSymptomEntry(editing) ? editing : undefined
  const editingMedication = editing && isMedicationEntry(editing) ? editing : undefined

  return (
    <div className="space-y-6">
      <div className="flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            if (!editing) setMode('symptoms')
          }}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            mode === 'symptoms'
              ? 'bg-white text-primary-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Symptoms
        </button>
        <button
          type="button"
          onClick={() => {
            if (!editing) setMode('medication')
          }}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            mode === 'medication'
              ? 'bg-white text-violet-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Medication
        </button>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          {editing
            ? 'Edit entry'
            : mode === 'symptoms'
              ? 'Log symptoms'
              : 'Log medication'}
        </h2>
        {mode === 'symptoms' ? (
          <EntryForm
            key={editingSymptom?.id ?? 'symptom-new'}
            initial={editingSymptom}
            onSubmit={async (data) => {
              if (editingSymptom) {
                await editEntry({ ...editingSymptom, ...data })
                setEditing(null)
              } else {
                await addSymptomEntry({
                  fatigue: data.fatigue,
                  mood: data.mood,
                  nausea: data.nausea,
                  pain: data.pain,
                  stiffness: data.stiffness,
                  dizziness: data.dizziness,
                  notes: data.notes,
                  timestamp: data.timestamp,
                })
              }
            }}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        ) : (
          <MedicationForm
            key={editingMedication?.id ?? 'med-new'}
            initial={editingMedication}
            onSubmit={async (data) => {
              if (editingMedication) {
                await editEntry({ ...editingMedication, ...data })
                setEditing(null)
              } else {
                await addMedication(data)
              }
            }}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          Today&apos;s activity ({todayEntries.length})
        </h2>
        <ActivityList
          entries={todayEntries}
          onEdit={handleEdit}
          onDelete={handleDelete}
          emptyMessage="Nothing logged today yet."
        />
      </section>
    </div>
  )
}
