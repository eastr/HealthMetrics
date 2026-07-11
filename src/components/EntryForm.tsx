import { useState } from 'react'
import type { SymptomEntry, MetricKey } from '../types/entry'
import { METRIC_KEYS } from '../types/entry'
import { useMetrics } from '../hooks/useMetricColors'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/analytics'
import MetricSlider from './MetricSlider'

export interface EntryFormData {
  timestamp: string
  fatigue: number
  mood: number
  nausea: number
  pain: number
  stiffness: number
  dizziness: number
  notes: string
}

interface EntryFormProps {
  initial?: SymptomEntry
  onSubmit: (data: EntryFormData) => Promise<void>
  onCancel?: () => void
}

const DEFAULTS = Object.fromEntries(METRIC_KEYS.map((k) => [k, 1])) as Record<
  MetricKey,
  number
>

export default function EntryForm({ initial, onSubmit, onCancel }: EntryFormProps) {
  const { metrics } = useMetrics()
  const [values, setValues] = useState<Record<MetricKey, number>>({
    fatigue: initial?.fatigue ?? DEFAULTS.fatigue,
    mood: initial?.mood ?? DEFAULTS.mood,
    nausea: initial?.nausea ?? DEFAULTS.nausea,
    pain: initial?.pain ?? DEFAULTS.pain,
    stiffness: initial?.stiffness ?? DEFAULTS.stiffness,
    dizziness: initial?.dizziness ?? DEFAULTS.dizziness,
  })
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [datetimeLocal, setDatetimeLocal] = useState(() =>
    toDatetimeLocalValue(initial?.timestamp),
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)

  const resetForm = () => {
    setValues({ ...DEFAULTS })
    setNotes('')
    setDatetimeLocal(toDatetimeLocalValue())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        ...values,
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
          <label className="text-sm font-medium text-slate-700" htmlFor="entry-datetime">
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
          id="entry-datetime"
          type="datetime-local"
          value={datetimeLocal}
          onChange={(e) => setDatetimeLocal(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {metrics.map((m) => (
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
