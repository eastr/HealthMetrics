import { useEffect, useMemo, useState } from 'react'
import type { SymptomEntry } from '../types/entry'
import { defaultMetricValues, getMetricValue } from '../types/entry'
import { useMetrics } from '../hooks/useMetricColors'
import { useCheckInSchedules } from '../hooks/useCheckInSchedules'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/analytics'
import MetricSlider from './MetricSlider'

export interface EntryFormData {
  timestamp: string
  values: Record<string, number>
  notes: string
}

export interface EntryFormDraft {
  timestamp?: string
  scheduledTime?: string
  label?: string
  notes?: string
}

interface EntryFormProps {
  initial?: SymptomEntry
  draft?: EntryFormDraft | null
  onSubmit: (data: EntryFormData) => Promise<void>
  onCancel?: () => void
}

function draftToDatetimeLocal(draft?: EntryFormDraft | null): string {
  if (draft?.timestamp) return toDatetimeLocalValue(draft.timestamp)
  if (draft?.scheduledTime) {
    const now = new Date()
    const [h, m] = draft.scheduledTime.split(':').map(Number)
    now.setHours(h || 0, m || 0, 0, 0)
    return toDatetimeLocalValue(now.toISOString())
  }
  return toDatetimeLocalValue()
}

export default function EntryForm({ initial, draft, onSubmit, onCancel }: EntryFormProps) {
  const { metrics } = useMetrics()
  const { schedules } = useCheckInSchedules()
  const defaults = useMemo(() => defaultMetricValues(metrics), [metrics])

  const [values, setValues] = useState<Record<string, number>>(() => {
    const base = { ...defaults }
    if (initial) {
      for (const m of metrics) {
        base[m.key] = getMetricValue(initial, m.key)
      }
    }
    return base
  })
  const [notes, setNotes] = useState(initial?.notes ?? draft?.notes ?? '')
  const [scheduledSlot, setScheduledSlot] = useState<string | null>(
    draft?.scheduledTime ?? null,
  )
  const [datetimeLocal, setDatetimeLocal] = useState(() =>
    initial?.timestamp
      ? toDatetimeLocalValue(initial.timestamp)
      : draftToDatetimeLocal(draft),
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev }
      for (const m of metrics) {
        if (next[m.key] == null) next[m.key] = 1
      }
      return next
    })
  }, [metrics])

  useEffect(() => {
    if (initial || !draft) return
    setNotes(draft.notes ?? '')
    setScheduledSlot(draft.scheduledTime ?? null)
    setDatetimeLocal(draftToDatetimeLocal(draft))
  }, [initial, draft])

  const scheduleTimes = [
    ...new Set(schedules.filter((s) => s.active).flatMap((s) => s.times)),
  ].sort()

  const applyScheduledTime = (time: string) => {
    setScheduledSlot(time)
    const now = new Date()
    const [h, m] = time.split(':').map(Number)
    now.setHours(h || 0, m || 0, 0, 0)
    setDatetimeLocal(toDatetimeLocalValue(now.toISOString()))
  }

  const resetForm = () => {
    setValues({ ...defaultMetricValues(metrics) })
    setNotes('')
    setScheduledSlot(null)
    setDatetimeLocal(toDatetimeLocalValue())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: Record<string, number> = {}
      for (const m of metrics) {
        payload[m.key] = values[m.key] ?? 1
      }
      await onSubmit({
        values: payload,
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
      {scheduledSlot && !initial && (
        <div className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800 ring-1 ring-primary-100">
          Logging check-in for <strong>{scheduledSlot}</strong>
          {draft?.label ? ` · ${draft.label}` : ''}
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700" htmlFor="entry-datetime">
            Date & time
          </label>
          <button
            type="button"
            onClick={() => {
              setScheduledSlot(null)
              setDatetimeLocal(toDatetimeLocalValue())
            }}
            className="text-xs font-medium text-primary-600 hover:text-primary-800"
          >
            Use now
          </button>
        </div>
        <input
          id="entry-datetime"
          type="datetime-local"
          value={datetimeLocal}
          onChange={(e) => {
            setDatetimeLocal(e.target.value)
            setScheduledSlot(null)
          }}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {scheduleTimes.length > 0 && !initial && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-slate-500">Scheduled check-ins</div>
            <div className="flex flex-wrap gap-2">
              {scheduleTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => applyScheduledTime(time)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    scheduledSlot === time
                      ? 'bg-primary-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {metrics.map((m) => (
        <MetricSlider
          key={m.key}
          metric={m.key}
          value={values[m.key] ?? 1}
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
