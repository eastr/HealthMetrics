import { useEffect, useMemo, useState } from 'react'
import type { DoseEntry, DoseKind } from '../types/entry'
import { useMedicationPresets } from '../hooks/useMedicationPresets'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/analytics'

export interface MedicationFormData {
  timestamp: string
  medication: string
  dose: string
  notes: string
}

/** Prefill when logging from schedule or editing */
export interface MedicationFormDraft {
  medication: string
  dose: string
  notes?: string
  timestamp?: string
  presetId?: string
  /** Scheduled slot label e.g. "08:00" — shown in UI, not forced into notes */
  scheduledTime?: string
}

interface MedicationFormProps {
  kind?: DoseKind
  initial?: DoseEntry
  draft?: MedicationFormDraft | null
  onSubmit: (data: MedicationFormData) => Promise<void>
  onCancel?: () => void
}

function draftToDatetimeLocal(draft?: MedicationFormDraft | null): string {
  if (draft?.timestamp) return toDatetimeLocalValue(draft.timestamp)
  if (draft?.scheduledTime) {
    const now = new Date()
    const [h, m] = draft.scheduledTime.split(':').map(Number)
    now.setHours(h || 0, m || 0, 0, 0)
    return toDatetimeLocalValue(now.toISOString())
  }
  return toDatetimeLocalValue()
}

const THEME = {
  medication: {
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-800',
    accentRing: 'ring-violet-100',
    chipOn: 'bg-violet-700 text-white',
    chipOff: 'bg-violet-50 text-violet-800 hover:bg-violet-100',
    slotOn: 'bg-violet-700 text-white',
    button: 'bg-violet-700 hover:bg-violet-800',
    toast: 'bg-violet-800',
    label: 'medication',
    labelPlural: 'medications',
    placeholder: 'e.g. Ibuprofen',
  },
  vitamin: {
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-800',
    accentRing: 'ring-emerald-100',
    chipOn: 'bg-emerald-700 text-white',
    chipOff: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    slotOn: 'bg-emerald-700 text-white',
    button: 'bg-emerald-700 hover:bg-emerald-800',
    toast: 'bg-emerald-800',
    label: 'vitamin',
    labelPlural: 'vitamins',
    placeholder: 'e.g. Vitamin D',
  },
} as const

export default function MedicationForm({
  kind = 'medication',
  initial,
  draft,
  onSubmit,
  onCancel,
}: MedicationFormProps) {
  const theme = THEME[kind]
  const { presets: allPresets } = useMedicationPresets()
  const presets = useMemo(
    () => allPresets.filter((p) => (p.kind ?? 'medication') === kind),
    [allPresets, kind],
  )
  const [medication, setMedication] = useState(
    initial?.medication ?? draft?.medication ?? '',
  )
  const [dose, setDose] = useState(initial?.dose ?? draft?.dose ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? draft?.notes ?? '')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    draft?.presetId ?? null,
  )
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
    if (initial || !draft) return
    setMedication(draft.medication)
    setDose(draft.dose)
    setNotes(draft.notes ?? '')
    setSelectedPresetId(draft.presetId ?? null)
    setScheduledSlot(draft.scheduledTime ?? null)
    setDatetimeLocal(draftToDatetimeLocal(draft))
  }, [initial, draft])

  const selectPreset = (id: string) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    setSelectedPresetId(id)
    setMedication(preset.name)
    setDose(preset.defaultDose ?? '')
    setScheduledSlot(null)
  }

  const applyScheduledTime = (time: string) => {
    setScheduledSlot(time)
    const now = new Date()
    const [h, m] = time.split(':').map(Number)
    now.setHours(h || 0, m || 0, 0, 0)
    setDatetimeLocal(toDatetimeLocalValue(now.toISOString()))
  }

  const resetForm = () => {
    setMedication('')
    setDose('')
    setNotes('')
    setSelectedPresetId(null)
    setScheduledSlot(null)
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
        notes: notes.trim(),
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

  const selectedPreset = selectedPresetId
    ? presets.find((p) => p.id === selectedPresetId)
    : presets.find((p) => p.name === medication)
  const scheduleTimes = selectedPreset?.times ?? []

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {scheduledSlot && !initial && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ring-1 ${theme.accentBg} ${theme.accentText} ${theme.accentRing}`}
        >
          Logging scheduled dose for <strong>{scheduledSlot}</strong>
          {medication ? ` · ${medication}` : ''}
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700" htmlFor={`${kind}-datetime`}>
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
          id={`${kind}-datetime`}
          type="datetime-local"
          value={datetimeLocal}
          onChange={(e) => {
            setDatetimeLocal(e.target.value)
            setScheduledSlot(null)
          }}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {presets.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-2 text-sm font-medium text-slate-700">
            Your {theme.labelPlural}
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedPresetId === preset.id || medication === preset.name
                    ? theme.chipOn
                    : theme.chipOff
                }`}
              >
                {preset.name}
                {preset.defaultDose ? ` · ${preset.defaultDose}` : ''}
              </button>
            ))}
          </div>
          {scheduleTimes.length > 0 && !initial && (
            <div className="mt-3">
              <div className="mb-1 text-xs text-slate-500">Scheduled times today</div>
              <div className="flex flex-wrap gap-2">
                {scheduleTimes.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => applyScheduledTime(time)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      scheduledSlot === time
                        ? theme.slotOn
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
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 text-sm font-medium text-slate-700">Or custom</div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor={`${kind}-name`}>
              {kind === 'vitamin' ? 'Vitamin name' : 'Medication name'}
            </label>
            <input
              id={`${kind}-name`}
              type="text"
              value={medication}
              onChange={(e) => {
                setMedication(e.target.value)
                setSelectedPresetId(null)
                setScheduledSlot(null)
              }}
              placeholder={theme.placeholder}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor={`${kind}-dose`}>
              Dose (optional)
            </label>
            <input
              id={`${kind}-dose`}
              type="text"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder={kind === 'vitamin' ? 'e.g. 1000 IU' : 'e.g. 200mg'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <label
          className="mb-2 block text-sm font-medium text-slate-700"
          htmlFor={`${kind}-notes`}
        >
          Notes (optional)
        </label>
        <textarea
          id={`${kind}-notes`}
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
          className={`flex-1 rounded-xl py-3 font-semibold text-white shadow-sm disabled:opacity-50 ${theme.button}`}
        >
          {saving
            ? 'Saving…'
            : initial
              ? `Update ${theme.label}`
              : `Log ${theme.label}`}
        </button>
      </div>

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${theme.toast}`}
        >
          {kind === 'vitamin' ? 'Vitamin' : 'Medication'} saved
        </div>
      )}
    </form>
  )
}
