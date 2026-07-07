import { useState } from 'react'
import type { HealthEntry, MetricKey } from '../types/entry'
import { METRICS } from '../types/entry'
import MetricSlider from './MetricSlider'

interface EntryFormProps {
  initial?: HealthEntry
  onSubmit: (data: {
    fatigue: number
    mood: number
    nausea: number
    pain: number
    notes: string
  }) => Promise<void>
  onCancel?: () => void
}

const DEFAULTS: Record<MetricKey, number> = {
  fatigue: 5,
  mood: 5,
  nausea: 1,
  pain: 1,
}

export default function EntryForm({ initial, onSubmit, onCancel }: EntryFormProps) {
  const [values, setValues] = useState<Record<MetricKey, number>>({
    fatigue: initial?.fatigue ?? DEFAULTS.fatigue,
    mood: initial?.mood ?? DEFAULTS.mood,
    nausea: initial?.nausea ?? DEFAULTS.nausea,
    pain: initial?.pain ?? DEFAULTS.pain,
  })
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ ...values, notes })
      if (!initial) {
        setValues({ ...DEFAULTS })
        setNotes('')
      }
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {METRICS.map((m) => (
        <MetricSlider
          key={m.key}
          metric={m.key}
          value={values[m.key]}
          onChange={(v) => setValues((prev) => ({ ...prev, [m.key]: v }))}
        />
      ))}

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="notes">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="How are you feeling?"
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
          disabled={saving}
          className="flex-1 rounded-xl bg-primary-700 py-3 font-semibold text-white shadow-sm hover:bg-primary-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Update entry' : 'Log now'}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary-800 px-4 py-2 text-sm font-medium text-white shadow-lg">
          Entry saved
        </div>
      )}
    </form>
  )
}
