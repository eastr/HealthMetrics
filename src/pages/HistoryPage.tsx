import { useMemo, useState } from 'react'
import { addDays, subDays, format, parseISO } from 'date-fns'
import { useEntries } from '../hooks/useEntries'
import { useMedicationPresets } from '../hooks/useMedicationPresets'
import { useCheckInSchedules } from '../hooks/useCheckInSchedules'
import ActivityList from '../components/ActivityList'
import EntryForm, { type EntryFormDraft } from '../components/EntryForm'
import MedicationForm, { type MedicationFormDraft } from '../components/MedicationForm'
import { entriesForDate, formatDate } from '../utils/analytics'
import type { ActivityFilter, DoseKind, HealthEntry } from '../types/entry'
import { filterEntries, isDoseEntry, isSymptomEntry } from '../types/entry'
import {
  getDueCheckInsForDate,
  getDueDosesForDate,
  timestampForScheduledTimeOnDate,
  type DueCheckIn,
  type DueDose,
} from '../utils/medicationSchedule'

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'symptoms', label: 'Symptoms' },
  { value: 'medication', label: 'Meds' },
  { value: 'vitamin', label: 'Vitamins' },
]

type LoggingMode =
  | { kind: 'medication' | 'vitamin'; draft: MedicationFormDraft }
  | { kind: 'symptoms'; draft: EntryFormDraft }
  | null

function ScheduleBackfill({
  title,
  hint,
  items,
  accent,
  quickLogging,
  onLog,
  onOpen,
  onEditTaken,
}: {
  title: string
  hint: string
  items: { key: string; time: string; label: string; detail?: string; taken: boolean; entryId?: string }[]
  accent: 'violet' | 'emerald' | 'primary'
  quickLogging: string | null
  onLog?: (key: string) => void
  onOpen: (key: string) => void
  onEditTaken: (entryId?: string) => void
}) {
  const missing = items.filter((i) => !i.taken)
  if (items.length === 0) return null

  const styles = {
    violet: {
      shell: 'bg-violet-50 ring-violet-100',
      title: 'text-violet-900',
      hint: 'text-violet-700',
      btn: 'bg-violet-700 text-white',
      open: 'text-violet-800 ring-violet-200',
    },
    emerald: {
      shell: 'bg-emerald-50 ring-emerald-100',
      title: 'text-emerald-900',
      hint: 'text-emerald-700',
      btn: 'bg-emerald-700 text-white',
      open: 'text-emerald-800 ring-emerald-200',
    },
    primary: {
      shell: 'bg-primary-50 ring-primary-100',
      title: 'text-primary-900',
      hint: 'text-primary-700',
      btn: 'bg-primary-700 text-white',
      open: 'text-primary-800 ring-primary-200',
    },
  }[accent]

  return (
    <section className={`rounded-xl p-4 ring-1 ${styles.shell}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className={`text-sm font-semibold ${styles.title}`}>{title}</h2>
        <span className={`text-xs ${styles.hint}`}>
          {items.filter((i) => i.taken).length}/{items.length} logged
          {missing.length > 0 ? ` · ${missing.length} missing` : ''}
        </span>
      </div>
      <p className={`mb-3 text-xs ${styles.hint}`}>{hint}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
              item.taken ? 'bg-white/70' : 'bg-white'
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-800">
                {item.time} · {item.label}
                {item.taken && (
                  <span className="ml-2 text-xs font-normal text-emerald-600">Logged</span>
                )}
              </div>
              {item.detail && <div className="text-xs text-slate-500">{item.detail}</div>}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {!item.taken && onLog && (
                <button
                  type="button"
                  disabled={quickLogging === item.key}
                  onClick={() => onLog(item.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${styles.btn}`}
                >
                  {quickLogging === item.key ? '…' : 'Log'}
                </button>
              )}
              {!item.taken && (
                <button
                  type="button"
                  onClick={() => onOpen(item.key)}
                  className={`rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium ring-1 ${styles.open}`}
                >
                  {onLog ? 'Edit' : 'Capture'}
                </button>
              )}
              {item.taken && (
                <button
                  type="button"
                  onClick={() => onEditTaken(item.entryId)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                >
                  Edit
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function HistoryPage() {
  const { entries, addSymptomEntry, addMedication, addVitamin, editEntry, removeEntry } =
    useEntries()
  const { presets } = useMedicationPresets()
  const { schedules } = useCheckInSchedules()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [editing, setEditing] = useState<HealthEntry | null>(null)
  const [logging, setLogging] = useState<LoggingMode>(null)
  const [quickLogging, setQuickLogging] = useState<string | null>(null)

  const dayEntries = filterEntries(entriesForDate(entries, selectedDate), filter)
  const dateLabel = formatDate(selectedDate.toISOString())

  const dueMeds = useMemo(
    () => getDueDosesForDate(presets, entries, selectedDate, 'medication'),
    [presets, entries, selectedDate],
  )
  const dueVits = useMemo(
    () => getDueDosesForDate(presets, entries, selectedDate, 'vitamin'),
    [presets, entries, selectedDate],
  )
  const dueCheckIns = useMemo(
    () => getDueCheckInsForDate(schedules, entries, selectedDate),
    [schedules, entries, selectedDate],
  )

  const showMedSchedule = filter === 'all' || filter === 'medication'
  const showVitSchedule = filter === 'all' || filter === 'vitamin'
  const showCheckInSchedule = filter === 'all' || filter === 'symptoms'

  const handleDelete = async (entry: HealthEntry) => {
    if (confirm('Delete this entry?')) {
      await removeEntry(entry)
      if (editing?.id === entry.id) setEditing(null)
    }
  }

  const clearForms = () => {
    setEditing(null)
    setLogging(null)
  }

  const openDose = (dose: DueDose, kind: DoseKind) => {
    setEditing(null)
    setLogging({
      kind,
      draft: {
        medication: dose.name,
        dose: dose.dose,
        presetId: dose.presetId,
        scheduledTime: dose.time,
        timestamp: timestampForScheduledTimeOnDate(dose.time, selectedDate),
      },
    })
  }

  const openCheckIn = (slot: DueCheckIn) => {
    setEditing(null)
    setLogging({
      kind: 'symptoms',
      draft: {
        label: slot.label,
        scheduledTime: slot.time,
        timestamp: timestampForScheduledTimeOnDate(slot.time, selectedDate),
      },
    })
  }

  const quickLogDose = async (dose: DueDose, kind: DoseKind) => {
    const key = `${kind}-${dose.presetId}-${dose.time}`
    setQuickLogging(key)
    try {
      const payload = {
        medication: dose.name,
        dose: dose.dose,
        notes: '',
        timestamp: timestampForScheduledTimeOnDate(dose.time, selectedDate),
      }
      if (kind === 'vitamin') await addVitamin(payload)
      else await addMedication(payload)
      setLogging(null)
    } finally {
      setQuickLogging(null)
    }
  }

  const editingSymptom = editing && isSymptomEntry(editing) ? editing : undefined
  const editingDose = editing && isDoseEntry(editing) ? editing : undefined

  const medItems = dueMeds.map((d) => ({
    key: `medication-${d.presetId}-${d.time}`,
    time: d.time,
    label: d.name,
    detail: d.dose || undefined,
    taken: d.taken,
    entryId: d.entryId,
  }))
  const vitItems = dueVits.map((d) => ({
    key: `vitamin-${d.presetId}-${d.time}`,
    time: d.time,
    label: d.name,
    detail: d.dose || undefined,
    taken: d.taken,
    entryId: d.entryId,
  }))
  const checkInItems = dueCheckIns.map((s) => ({
    key: `checkin-${s.scheduleId}-${s.time}`,
    time: s.time,
    label: s.label,
    taken: s.taken,
    entryId: s.entryId,
  }))

  const findDose = (kind: DoseKind, key: string): DueDose | undefined => {
    const list = kind === 'vitamin' ? dueVits : dueMeds
    return list.find((d) => `${kind}-${d.presetId}-${d.time}` === key)
  }

  const findCheckIn = (key: string): DueCheckIn | undefined =>
    dueCheckIns.find((s) => `checkin-${s.scheduleId}-${s.time}` === key)

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

      {showCheckInSchedule && (
        <ScheduleBackfill
          title="Scheduled check-ins"
          hint="Log missing symptom check-ins for this day."
          items={checkInItems}
          accent="primary"
          quickLogging={quickLogging}
          onOpen={(key) => {
            const slot = findCheckIn(key)
            if (slot) openCheckIn(slot)
          }}
          onEditTaken={(entryId) => {
            const match = entryId ? entries.find((e) => e.id === entryId) : undefined
            if (match) {
              setLogging(null)
              setEditing(match)
            }
          }}
        />
      )}

      {showMedSchedule && (
        <ScheduleBackfill
          title="Scheduled medications"
          hint="Log missing medication doses for this day."
          items={medItems}
          accent="violet"
          quickLogging={quickLogging}
          onLog={(key) => {
            const dose = findDose('medication', key)
            if (dose) void quickLogDose(dose, 'medication')
          }}
          onOpen={(key) => {
            const dose = findDose('medication', key)
            if (dose) openDose(dose, 'medication')
          }}
          onEditTaken={(entryId) => {
            const match = entryId ? entries.find((e) => e.id === entryId) : undefined
            if (match) {
              setLogging(null)
              setEditing(match)
            }
          }}
        />
      )}

      {showVitSchedule && (
        <ScheduleBackfill
          title="Scheduled vitamins"
          hint="Log missing vitamin doses for this day."
          items={vitItems}
          accent="emerald"
          quickLogging={quickLogging}
          onLog={(key) => {
            const dose = findDose('vitamin', key)
            if (dose) void quickLogDose(dose, 'vitamin')
          }}
          onOpen={(key) => {
            const dose = findDose('vitamin', key)
            if (dose) openDose(dose, 'vitamin')
          }}
          onEditTaken={(entryId) => {
            const match = entryId ? entries.find((e) => e.id === entryId) : undefined
            if (match) {
              setLogging(null)
              setEditing(match)
            }
          }}
        />
      )}

      {logging?.kind === 'symptoms' && (
        <div className="rounded-xl bg-primary-50 p-4 ring-1 ring-primary-100">
          <h3 className="mb-3 font-semibold text-primary-800">
            Log check-in
            {logging.draft.scheduledTime ? ` · ${logging.draft.scheduledTime}` : ''}
          </h3>
          <EntryForm
            key={`new-checkin-${logging.draft.scheduledTime}-${logging.draft.label}`}
            draft={logging.draft}
            onSubmit={async (data) => {
              await addSymptomEntry({
                values: data.values,
                notes: data.notes,
                timestamp: data.timestamp,
              })
              setSelectedDate(parseISO(data.timestamp))
              setLogging(null)
            }}
            onCancel={() => setLogging(null)}
          />
        </div>
      )}

      {(logging?.kind === 'medication' || logging?.kind === 'vitamin') && (
        <div
          className={`rounded-xl p-4 ring-1 ${
            logging.kind === 'vitamin'
              ? 'bg-emerald-50 ring-emerald-100'
              : 'bg-violet-50 ring-violet-100'
          }`}
        >
          <h3
            className={`mb-3 font-semibold ${
              logging.kind === 'vitamin' ? 'text-emerald-800' : 'text-violet-800'
            }`}
          >
            Log {logging.kind === 'vitamin' ? 'vitamin' : 'medication'}
            {logging.draft.scheduledTime ? ` · ${logging.draft.scheduledTime}` : ''}
          </h3>
          <MedicationForm
            key={`new-${logging.kind}-${logging.draft.presetId}-${logging.draft.scheduledTime}`}
            kind={logging.kind}
            draft={logging.draft}
            onSubmit={async (data) => {
              if (logging.kind === 'vitamin') await addVitamin(data)
              else await addMedication(data)
              setSelectedDate(parseISO(data.timestamp))
              setLogging(null)
            }}
            onCancel={() => setLogging(null)}
          />
        </div>
      )}

      {editingSymptom && (
        <div className="rounded-xl bg-primary-50 p-4 ring-1 ring-primary-100">
          <h3 className="mb-3 font-semibold text-primary-800">Edit symptom entry</h3>
          <EntryForm
            initial={editingSymptom}
            onSubmit={async (data) => {
              await editEntry({ ...editingSymptom, ...data })
              setSelectedDate(parseISO(data.timestamp))
              clearForms()
            }}
            onCancel={clearForms}
          />
        </div>
      )}

      {editingDose && (
        <div
          className={`rounded-xl p-4 ring-1 ${
            editingDose.type === 'vitamin'
              ? 'bg-emerald-50 ring-emerald-100'
              : 'bg-violet-50 ring-violet-100'
          }`}
        >
          <h3
            className={`mb-3 font-semibold ${
              editingDose.type === 'vitamin' ? 'text-emerald-800' : 'text-violet-800'
            }`}
          >
            Edit {editingDose.type === 'vitamin' ? 'vitamin' : 'medication'}
          </h3>
          <MedicationForm
            kind={editingDose.type}
            initial={editingDose}
            onSubmit={async (data) => {
              await editEntry({ ...editingDose, ...data })
              setSelectedDate(parseISO(data.timestamp))
              clearForms()
            }}
            onCancel={clearForms}
          />
        </div>
      )}

      <ActivityList
        entries={dayEntries}
        onEdit={(entry) => {
          setLogging(null)
          setEditing(entry)
        }}
        onDelete={handleDelete}
        emptyMessage="No entries for this day"
      />
    </div>
  )
}
