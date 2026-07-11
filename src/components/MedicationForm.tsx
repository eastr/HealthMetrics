import { useState } from 'react'
import type { MedicationEntry } from '../types/entry'
import { useMedicationPresets } from '../hooks/useMedicationPresets'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/analytics'

export interface MedicationFormData {
  timestamp: string
  medication: string
  dose: string
  notes: string
}

interface MedicationFormProps {
  initial?: MedicationEntry
  onSubmit: (data: MedicationFormData) => Promise<void>
  onCancel?: () => void
}

export default function MedicationForm({ initial, onSubmit, onCancel }: MedicationFormProps) {
  const { presets } = useMedicationPresets()
  const [medication, setMedication] = useState(initial?.medication ?? '')
  const [dose, setDose] = useState(initial?.dose ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [datetimeLocal, setDatetimeLocal] = useState(() =>
    toDatetimeLocalValue(initial?.timestamp),
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)

  const selectPreset = (id: string) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    setSelectedPresetId(id)
    setMedication(preset.name)
    setDose(preset.defaultDose ?? '')
  }

  const resetForm = () => {
    setMedication('')
    setDose('')
    setNotes('')
    setSelectedPresetId(null)
    setDatetimeLocal(toDatetimeLocalValue())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!medication.trim()) return
    setSaving(true)
    try {
      await onSubmit({
        medication: medication.trim(),
        dose: dose.trim(),
        notes,
        timestamp: fromDatetimeLocalValue(datetimeLocal),
      })
      if (!initial) {
        resetForm()
      }
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700" htmlFor="med-datetime">
            Date & time
          </label>
          <button
            type="button"
            onClick={() => setDatetimeLocal(toDatetimeLocalValue())}
            className="text-xs font-medium text-primary-600 hover:text-primary-800"
          >
            Use now
          </button>
        </div>
        <input
          id="med-datetime"
          type="datetime-local"
          value={datetimeLocal}
          onChange={(e) => setDatetimeLocal(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {presets.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-2 text-sm font-medium text-slate-700">Your medications</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedPresetId === preset.id
                    ? 'bg-violet-700 text-white'
                    : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
                }`}
              >
                {preset.name}
                {preset.defaultDose ? ` · ${preset.defaultDose}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 text-sm font-medium text-slate-700">Or custom</div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="med-name">
              Medication name
            </label>
            <input
              id="med-name"
              type="text"
              value={medication}
              onChange={(e) => {
                setMedication(e.target.value)
                setSelectedPresetId(null)
              }}
              placeholder="e.g. Ibuprofen"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="med-dose">
              Dose (optional)
            </label>
            <input
              id="med-dose"
              type="text"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="e.g. 200mg"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="med-notes">
          Notes (optional)
        </label>
        <textarea
          id="med-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. with food"
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving || !medication.trim()}
          className="flex-1 rounded-xl bg-violet-700 py-3 font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Update medication' : 'Log medication'}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-violet-800 px-4 py-2 text-sm font-medium text-white shadow-lg">
          Medication saved
        </div>
      )}
    </form>
  )
}
