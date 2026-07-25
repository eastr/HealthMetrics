import { useMemo, useState } from 'react'
import type { DoseKind, HealthEntry } from '../types/entry'
import { isDoseEntry, isSymptomEntry } from '../types/entry'
import { useEntries } from '../hooks/useEntries'
import { useMedicationPresets } from '../hooks/useMedicationPresets'
import { useCheckInSchedules } from '../hooks/useCheckInSchedules'
import EntryForm, { type EntryFormDraft } from '../components/EntryForm'
import MedicationForm, { type MedicationFormDraft } from '../components/MedicationForm'
import ActivityList from '../components/ActivityList'
import { entriesForDate } from '../utils/analytics'
import {
  getDueCheckInsForDate,
  getDueDosesForDate,
  timestampForScheduledTime,
  type DueCheckIn,
  type DueDose,
} from '../utils/medicationSchedule'

type LogMode = 'symptoms' | 'medication' | 'vitamin'

function medDraftKey(draft: MedicationFormDraft | null): string {
  if (!draft) return 'med-new'
  return `draft-${draft.presetId ?? draft.medication}-${draft.scheduledTime ?? 'custom'}`
}

function symptomDraftKey(draft: EntryFormDraft | null): string {
  if (!draft) return 'symptom-new'
  return `checkin-${draft.scheduledTime ?? 'custom'}-${draft.label ?? ''}`
}

function DueDoseSection({
  title,
  hint,
  doses,
  draft,
  entries,
  quickLogging,
  accent,
  onQuickLog,
  onOpen,
  onEdit,
}: {
  title: string
  hint: string
  doses: DueDose[]
  draft: MedicationFormDraft | null
  entries: HealthEntry[]
  quickLogging: string | null
  accent: 'violet' | 'emerald'
  onQuickLog: (dose: DueDose) => void
  onOpen: (dose: DueDose) => void
  onEdit: (entry: HealthEntry) => void
}) {
  if (doses.length === 0) return null
  const bg = accent === 'violet' ? 'bg-violet-50 ring-violet-100' : 'bg-emerald-50 ring-emerald-100'
  const titleColor = accent === 'violet' ? 'text-violet-900' : 'text-emerald-900'
  const hintColor = accent === 'violet' ? 'text-violet-700' : 'text-emerald-700'
  const btn = accent === 'violet' ? 'bg-violet-700' : 'bg-emerald-700'
  const ringEdit =
    accent === 'violet'
      ? 'text-violet-800 ring-violet-200'
      : 'text-emerald-800 ring-emerald-200'
  const prefillRing = accent === 'violet' ? 'ring-violet-400' : 'ring-emerald-400'

  return (
    <section className={`rounded-xl p-4 ring-1 ${bg}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className={`text-lg font-semibold ${titleColor}`}>{title}</h2>
        <span className={`text-xs ${hintColor}`}>
          {doses.filter((d) => d.taken).length}/{doses.length} logged
        </span>
      </div>
      <p className={`mb-3 text-xs ${hintColor}`}>{hint}</p>
      <ul className="space-y-2">
        {doses.map((dose) => {
          const key = `${dose.presetId}-${dose.time}`
          const isPrefilling =
            draft?.scheduledTime === dose.time && draft.medication === dose.name
          return (
            <li
              key={key}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                dose.taken ? 'bg-white/70' : 'bg-white'
              } ${isPrefilling ? `ring-2 ${prefillRing}` : ''}`}
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-800">
                  {dose.time} · {dose.name}
                  {dose.taken && (
                    <span className="ml-2 text-xs font-normal text-emerald-600">Logged</span>
                  )}
                </div>
                {dose.dose && <div className="text-xs text-slate-500">{dose.dose}</div>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {!dose.taken && (
                  <>
                    <button
                      type="button"
                      disabled={quickLogging === key}
                      onClick={() => onQuickLog(dose)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${btn}`}
                    >
                      {quickLogging === key ? '…' : 'Log'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpen(dose)}
                      className={`rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium ring-1 ${ringEdit}`}
                    >
                      Edit
                    </button>
                  </>
                )}
                {dose.taken && (
                  <button
                    type="button"
                    onClick={() => {
                      const match = dose.entryId
                        ? entries.find((e) => e.id === dose.entryId)
                        : undefined
                      if (match) onEdit(match)
                      else onOpen(dose)
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                  >
                    Edit
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function LogPage() {
  const { entries, addSymptomEntry, addMedication, addVitamin, editEntry, removeEntry } =
    useEntries()
  const { presets } = useMedicationPresets()
  const { schedules } = useCheckInSchedules()
  const [mode, setMode] = useState<LogMode>('symptoms')
  const [editing, setEditing] = useState<HealthEntry | null>(null)
  const [medDraft, setMedDraft] = useState<MedicationFormDraft | null>(null)
  const [vitDraft, setVitDraft] = useState<MedicationFormDraft | null>(null)
  const [symptomDraft, setSymptomDraft] = useState<EntryFormDraft | null>(null)
  const [quickLogging, setQuickLogging] = useState<string | null>(null)
  const todayEntries = entriesForDate(entries, new Date())

  const dueMeds = useMemo(
    () => getDueDosesForDate(presets, entries, new Date(), 'medication'),
    [presets, entries],
  )
  const dueVits = useMemo(
    () => getDueDosesForDate(presets, entries, new Date(), 'vitamin'),
    [presets, entries],
  )
  const dueCheckIns = useMemo(
    () => getDueCheckInsForDate(schedules, entries, new Date()),
    [schedules, entries],
  )

  const handleDelete = async (entry: HealthEntry) => {
    if (confirm('Delete this entry?')) {
      await removeEntry(entry)
      if (editing?.id === entry.id) setEditing(null)
    }
  }

  const handleEdit = (entry: HealthEntry) => {
    setEditing(entry)
    setMedDraft(null)
    setVitDraft(null)
    setSymptomDraft(null)
    if (isSymptomEntry(entry)) setMode('symptoms')
    else if (entry.type === 'vitamin') setMode('vitamin')
    else setMode('medication')
  }

  const openDoseSchedule = (dose: DueDose, kind: DoseKind) => {
    setEditing(null)
    setSymptomDraft(null)
    const draft: MedicationFormDraft = {
      medication: dose.name,
      dose: dose.dose,
      presetId: dose.presetId,
      scheduledTime: dose.time,
      timestamp: timestampForScheduledTime(dose.time),
    }
    if (kind === 'vitamin') {
      setMode('vitamin')
      setMedDraft(null)
      setVitDraft(draft)
    } else {
      setMode('medication')
      setVitDraft(null)
      setMedDraft(draft)
    }
  }

  const openCheckIn = (slot: DueCheckIn) => {
    setEditing(null)
    setMedDraft(null)
    setVitDraft(null)
    setMode('symptoms')
    setSymptomDraft({
      label: slot.label,
      scheduledTime: slot.time,
      timestamp: timestampForScheduledTime(slot.time),
    })
  }

  const quickLogDue = async (dose: DueDose, kind: DoseKind) => {
    const key = `${dose.presetId}-${dose.time}`
    setQuickLogging(key)
    try {
      const payload = {
        medication: dose.name,
        dose: dose.dose,
        notes: '',
        timestamp: timestampForScheduledTime(dose.time),
      }
      if (kind === 'vitamin') {
        await addVitamin(payload)
        if (vitDraft?.scheduledTime === dose.time && vitDraft.medication === dose.name) {
          setVitDraft(null)
        }
      } else {
        await addMedication(payload)
        if (medDraft?.scheduledTime === dose.time && medDraft.medication === dose.name) {
          setMedDraft(null)
        }
      }
    } finally {
      setQuickLogging(null)
    }
  }

  const editingSymptom = editing && isSymptomEntry(editing) ? editing : undefined
  const editingDose = editing && isDoseEntry(editing) ? editing : undefined
  const editingMedication =
    editingDose?.type === 'medication' ? editingDose : undefined
  const editingVitamin = editingDose?.type === 'vitamin' ? editingDose : undefined

  return (
    <div className="space-y-6">
      {dueCheckIns.length > 0 && (
        <section className="rounded-xl bg-primary-50 p-4 ring-1 ring-primary-100">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-primary-900">Symptom check-ins</h2>
            <span className="text-xs text-primary-700">
              {dueCheckIns.filter((c) => c.taken).length}/{dueCheckIns.length} logged
            </span>
          </div>
          <p className="mb-3 text-xs text-primary-700">
            Capture opens the Symptoms form at that time — same as logging from the Symptoms tab.
          </p>
          <ul className="space-y-2">
            {dueCheckIns.map((slot) => {
              const key = `${slot.scheduleId}-${slot.time}`
              const isPrefilling =
                symptomDraft?.scheduledTime === slot.time &&
                (symptomDraft.label === slot.label || !symptomDraft.label)
              return (
                <li
                  key={key}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                    slot.taken ? 'bg-white/70' : 'bg-white'
                  } ${isPrefilling ? 'ring-2 ring-primary-400' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800">
                      {slot.time} · {slot.label}
                      {slot.taken && (
                        <span className="ml-2 text-xs font-normal text-emerald-600">Logged</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {!slot.taken ? (
                      <button
                        type="button"
                        onClick={() => openCheckIn(slot)}
                        className="rounded-lg bg-primary-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        Capture
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const match = slot.entryId
                            ? entries.find((e) => e.id === slot.entryId)
                            : undefined
                          if (match) handleEdit(match)
                          else openCheckIn(slot)
                        }}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <DueDoseSection
        title="Medication schedule"
        hint="Log here or from the Medication tab — both update this list and today's activity."
        doses={dueMeds}
        draft={medDraft}
        entries={entries}
        quickLogging={quickLogging}
        accent="violet"
        onQuickLog={(d) => void quickLogDue(d, 'medication')}
        onOpen={(d) => openDoseSchedule(d, 'medication')}
        onEdit={handleEdit}
      />

      <DueDoseSection
        title="Vitamin schedule"
        hint="Log here or from the Vitamins tab — same flow as medications."
        doses={dueVits}
        draft={vitDraft}
        entries={entries}
        quickLogging={quickLogging}
        accent="emerald"
        onQuickLog={(d) => void quickLogDue(d, 'vitamin')}
        onOpen={(d) => openDoseSchedule(d, 'vitamin')}
        onEdit={handleEdit}
      />

      <div className="flex rounded-xl bg-slate-100 p-1">
        {(
          [
            { id: 'symptoms', label: 'Symptoms', active: 'text-primary-800' },
            { id: 'medication', label: 'Meds', active: 'text-violet-800' },
            { id: 'vitamin', label: 'Vitamins', active: 'text-emerald-800' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (!editing) {
                setMode(tab.id)
                if (tab.id !== 'medication') setMedDraft(null)
                if (tab.id !== 'vitamin') setVitDraft(null)
                if (tab.id !== 'symptoms') setSymptomDraft(null)
              }
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              mode === tab.id
                ? `bg-white shadow-sm ${tab.active}`
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          {editing
            ? 'Edit entry'
            : mode === 'symptoms'
              ? symptomDraft?.scheduledTime
                ? `Log symptoms · ${symptomDraft.scheduledTime}`
                : 'Log symptoms'
              : mode === 'vitamin'
                ? vitDraft?.scheduledTime
                  ? `Log vitamin · ${vitDraft.scheduledTime}`
                  : 'Log vitamin'
                : medDraft?.scheduledTime
                  ? `Log medication · ${medDraft.scheduledTime}`
                  : 'Log medication'}
        </h2>
        {mode === 'symptoms' ? (
          <EntryForm
            key={editingSymptom?.id ?? symptomDraftKey(symptomDraft)}
            initial={editingSymptom}
            draft={editingSymptom ? null : symptomDraft}
            onSubmit={async (data) => {
              if (editingSymptom) {
                await editEntry({
                  ...editingSymptom,
                  values: data.values,
                  notes: data.notes,
                  timestamp: data.timestamp,
                })
                setEditing(null)
              } else {
                await addSymptomEntry({
                  values: data.values,
                  notes: data.notes,
                  timestamp: data.timestamp,
                })
                setSymptomDraft(null)
              }
            }}
            onCancel={
              editing || symptomDraft
                ? () => {
                    setEditing(null)
                    setSymptomDraft(null)
                  }
                : undefined
            }
          />
        ) : mode === 'vitamin' ? (
          <MedicationForm
            kind="vitamin"
            key={editingVitamin?.id ?? `vit-${medDraftKey(vitDraft)}`}
            initial={editingVitamin}
            draft={editingVitamin ? null : vitDraft}
            onSubmit={async (data) => {
              if (editingVitamin) {
                await editEntry({ ...editingVitamin, ...data })
                setEditing(null)
              } else {
                await addVitamin(data)
                setVitDraft(null)
              }
            }}
            onCancel={
              editing || vitDraft
                ? () => {
                    setEditing(null)
                    setVitDraft(null)
                  }
                : undefined
            }
          />
        ) : (
          <MedicationForm
            kind="medication"
            key={editingMedication?.id ?? medDraftKey(medDraft)}
            initial={editingMedication}
            draft={editingMedication ? null : medDraft}
            onSubmit={async (data) => {
              if (editingMedication) {
                await editEntry({ ...editingMedication, ...data })
                setEditing(null)
              } else {
                await addMedication(data)
                setMedDraft(null)
              }
            }}
            onCancel={
              editing || medDraft
                ? () => {
                    setEditing(null)
                    setMedDraft(null)
                  }
                : undefined
            }
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
