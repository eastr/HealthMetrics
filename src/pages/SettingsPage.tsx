import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useEntries } from '../hooks/useEntries'
import { useMetricColorsSettings } from '../hooks/useMetricColors'
import { useMedicationPresets } from '../hooks/useMedicationPresets'
import { useCheckInSchedules } from '../hooks/useCheckInSchedules'
import CreateShareDialog from '../components/share/CreateShareDialog'
import ManageShareLinks from '../components/share/ManageShareLinks'
import DataBackupPanel from '../components/DataBackupPanel'
import BillingPanel from '../components/BillingPanel'
import type {
  CheckInSchedule,
  MedicationPreset,
  MetricCatalogItem,
  ScaleLabels,
  ScheduleDays,
  Weekday,
} from '../types/entry'
import { DEFAULT_SCALE_LABELS } from '../types/entry'
import { formatScheduleSummary, parseTimesInput } from '../utils/medicationSchedule'
import { APP_VERSION } from '../version'
import {
  loadNotificationPrefs,
  notificationPermission,
  requestNotificationPermission,
  saveNotificationPrefs,
  showTestNotification,
  type NotificationPrefs,
} from '../services/notifications'
import { notifyPrefsChanged } from '../hooks/useReminders'

const METRICS_TIP_KEY = 'healthmetrics_metrics_tip_dismissed'

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

function MedicationPresetEditor({
  preset,
  kind = 'medication',
  onSave,
  onCancel,
}: {
  preset?: MedicationPreset
  kind?: 'medication' | 'vitamin'
  onSave: (data: {
    name: string
    defaultDose?: string
    times: string[]
    days: ScheduleDays
    active: boolean
    kind: 'medication' | 'vitamin'
  }) => void
  onCancel: () => void
}) {
  const resolvedKind = preset?.kind ?? kind
  const isVitamin = resolvedKind === 'vitamin'
  const [name, setName] = useState(preset?.name ?? '')
  const [dose, setDose] = useState(preset?.defaultDose ?? '')
  const [timesText, setTimesText] = useState(preset?.times.join(', ') ?? '')
  const [daily, setDaily] = useState(preset ? preset.days === 'daily' : true)
  const [days, setDays] = useState<Weekday[]>(
    preset && preset.days !== 'daily' ? [...preset.days] : [1, 2, 3, 4, 5],
  )
  const [active, setActive] = useState(preset?.active !== false)

  const toggleDay = (day: Weekday) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  return (
    <div
      className={`space-y-3 rounded-lg p-3 ring-1 ${
        isVitamin ? 'bg-emerald-50 ring-emerald-100' : 'bg-violet-50 ring-violet-100'
      }`}
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isVitamin ? 'Vitamin name' : 'Medication name'}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <input
        type="text"
        value={dose}
        onChange={(e) => setDose(e.target.value)}
        placeholder={isVitamin ? 'Default dose (e.g. 1000 IU)' : 'Default dose (optional)'}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Times (e.g. 08:00, 20:00)
        </label>
        <input
          type="text"
          value={timesText}
          onChange={(e) => setTimesText(e.target.value)}
          placeholder="08:00, 20:00"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
          Every day
        </label>
        {!daily && (
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  days.includes(value)
                    ? isVitamin
                      ? 'bg-emerald-700 text-white'
                      : 'bg-violet-700 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active on schedule
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onSave({
              name,
              defaultDose: dose,
              times: parseTimesInput(timesText),
              days: daily ? 'daily' : days,
              active,
              kind: resolvedKind,
            })
          }
          disabled={!name.trim()}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
            isVitamin ? 'bg-emerald-700' : 'bg-violet-700'
          }`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function CheckInScheduleEditor({
  schedule,
  onSave,
  onCancel,
}: {
  schedule?: CheckInSchedule
  onSave: (data: {
    label: string
    times: string[]
    days: ScheduleDays
    active: boolean
  }) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(schedule?.label ?? 'Check-in')
  const [timesText, setTimesText] = useState(schedule?.times.join(', ') ?? '08:00, 20:00')
  const [daily, setDaily] = useState(schedule ? schedule.days === 'daily' : true)
  const [days, setDays] = useState<Weekday[]>(
    schedule && schedule.days !== 'daily' ? [...schedule.days] : [1, 2, 3, 4, 5],
  )
  const [active, setActive] = useState(schedule?.active !== false)

  const toggleDay = (day: Weekday) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  return (
    <div className="space-y-3 rounded-lg bg-primary-50 p-3 ring-1 ring-primary-100">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (e.g. Morning check-in)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Times (e.g. 08:00, 14:00, 20:00)
        </label>
        <input
          type="text"
          value={timesText}
          onChange={(e) => setTimesText(e.target.value)}
          placeholder="08:00, 20:00"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
          Every day
        </label>
        {!daily && (
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map(({ value, label: dayLabel }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  days.includes(value)
                    ? 'bg-primary-700 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {dayLabel}
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active on schedule
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onSave({
              label,
              times: parseTimesInput(timesText),
              days: daily ? 'daily' : days,
              active,
            })
          }
          disabled={!label.trim() || parseTimesInput(timesText).length === 0}
          className="rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function MetricCatalogEditor({
  metric,
  onSave,
  onCancel,
}: {
  metric?: MetricCatalogItem
  onSave: (data: { label: string; color: string; scaleLabels: ScaleLabels }) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(metric?.label ?? '')
  const [color, setColor] = useState(metric?.color ?? '#64748b')
  const [scaleLabels, setScaleLabels] = useState<ScaleLabels>(
    () => [...(metric?.scaleLabels ?? DEFAULT_SCALE_LABELS)] as ScaleLabels,
  )

  const setStep = (index: number, text: string) => {
    setScaleLabels((prev) => {
      const next = [...prev] as ScaleLabels
      next[index] = text
      return next
    })
  }

  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[10rem] flex-1 text-sm">
          <span className="mb-1 block text-slate-600">Name</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Anxiety"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
          />
        </label>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium text-slate-700">Scale texts (1–10)</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {scaleLabels.map((text, i) => (
            <label key={i} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-5 shrink-0 tabular-nums font-semibold text-slate-700">{i + 1}</span>
              <input
                value={text}
                onChange={(e) => setStep(i, e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (!label.trim()) return
            onSave({
              label: label.trim(),
              color,
              scaleLabels: scaleLabels.map((s, i) => s.trim() || String(i + 1)) as ScaleLabels,
            })
          }}
          disabled={!label.trim()}
          className="rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { signOut, offlineMode } = useAuth()
  const { entries, syncStatus, pendingCount, refresh, error } = useEntries()
  const {
    allMetrics,
    addMetric,
    updateMetric,
    removeMetric,
    resetToBuiltins,
  } = useMetricColorsSettings()
  const { presets, addPreset, updatePreset, removePreset } = useMedicationPresets()
  const { schedules, addSchedule, updateSchedule, removeSchedule } = useCheckInSchedules()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingVitaminId, setEditingVitaminId] = useState<string | null>(null)
  const [addingVitamin, setAddingVitamin] = useState(false)
  const [editingCheckInId, setEditingCheckInId] = useState<string | null>(null)
  const [addingCheckIn, setAddingCheckIn] = useState(false)
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null)
  const [addingMetric, setAddingMetric] = useState(false)
  const [showMetricsTip, setShowMetricsTip] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareLinksKey, setShareLinksKey] = useState(0)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => loadNotificationPrefs())
  const [notifPermission, setNotifPermission] = useState(() => notificationPermission())
  const [notifBusy, setNotifBusy] = useState(false)
  const [notifMessage, setNotifMessage] = useState<string | null>(null)

  useEffect(() => {
    try {
      setShowMetricsTip(localStorage.getItem(METRICS_TIP_KEY) !== '1')
    } catch {
      setShowMetricsTip(true)
    }
  }, [])

  const dismissMetricsTip = () => {
    setShowMetricsTip(false)
    try {
      localStorage.setItem(METRICS_TIP_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const updateNotifPrefs = (patch: Partial<NotificationPrefs>) => {
    const next = { ...notifPrefs, ...patch }
    setNotifPrefs(next)
    saveNotificationPrefs(next)
    notifyPrefsChanged()
  }

  const enableNotifications = async () => {
    setNotifBusy(true)
    setNotifMessage(null)
    try {
      const permission = await requestNotificationPermission()
      setNotifPermission(permission)
      if (permission === 'granted') {
        updateNotifPrefs({ enabled: true })
        setNotifMessage('Notifications enabled.')
      } else if (permission === 'denied') {
        updateNotifPrefs({ enabled: false })
        setNotifMessage(
          'Permission denied. Enable notifications for this site in your browser or phone settings.',
        )
      } else if (permission === 'unsupported') {
        setNotifMessage('This browser does not support notifications.')
      } else {
        setNotifMessage('Permission not granted yet.')
      }
    } finally {
      setNotifBusy(false)
    }
  }

  const sendTestNotification = async () => {
    setNotifBusy(true)
    setNotifMessage(null)
    try {
      if (notifPermission !== 'granted') {
        await enableNotifications()
      }
      if (notificationPermission() !== 'granted') {
        setNotifMessage('Permission is not granted — allow notifications for this site first.')
        return
      }
      const result = await showTestNotification()
      if (result.ok) {
        setNotifMessage(
          `Test sent (${result.via}). If you still see nothing: check Windows Focus assist / Do not disturb, and Vivaldi Settings → Privacy → Web Pages → Notifications / “Use native notifications”.`,
        )
      } else {
        setNotifMessage(`Could not show a notification${result.error ? `: ${result.error}` : '.'}`)
      }
    } finally {
      setNotifBusy(false)
    }
  }

  const medicationPresets = presets.filter((p) => (p.kind ?? 'medication') === 'medication')
  const vitaminPresets = presets.filter((p) => p.kind === 'vitamin')

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Supabase sync</h2>
        <p className="text-sm text-slate-500">
          Supabase is the shared source of truth across devices. Entries are also stored in
          IndexedDB on this device, so logging, history, and analytics continue to work offline.
          Pending changes sync automatically when your connection returns.
        </p>
      </section>

      <BillingPanel />

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Notifications</h2>
        <p className="mb-3 text-sm text-slate-500">
          Reminders for scheduled medications, vitamins, and symptom check-ins. Works best with the
          app installed (Add to Home screen). Timers run while the app is open or recently used —
          browsers cannot reliably wake a closed PWA without a push server.
        </p>
        <p className="mb-3 text-xs text-slate-400">
          Permission:{' '}
          <span className="font-medium text-slate-700">
            {notifPermission === 'unsupported'
              ? 'unsupported'
              : notifPermission === 'granted'
                ? 'allowed'
                : notifPermission === 'denied'
                  ? 'blocked'
                  : 'not asked'}
          </span>
        </p>

        <label className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-700">
          <span>Enable reminders</span>
          <input
            type="checkbox"
            checked={notifPrefs.enabled && notifPermission === 'granted'}
            disabled={notifBusy || notifPermission === 'unsupported'}
            onChange={(e) => {
              if (e.target.checked) void enableNotifications()
              else updateNotifPrefs({ enabled: false })
            }}
            className="h-4 w-4"
          />
        </label>

        <div className="mb-3 space-y-2 border-t border-slate-100 pt-3">
          {(
            [
              { key: 'medications' as const, label: 'Medication doses' },
              { key: 'vitamins' as const, label: 'Vitamin doses' },
              { key: 'checkIns' as const, label: 'Symptom check-ins' },
            ] as const
          ).map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 text-sm text-slate-700"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={notifPrefs[key]}
                disabled={!notifPrefs.enabled || notifPermission !== 'granted'}
                onChange={(e) => updateNotifPrefs({ [key]: e.target.checked })}
                className="h-4 w-4"
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
            <button
              type="button"
              disabled={notifBusy}
              onClick={() => void enableNotifications()}
              className="rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Allow notifications
            </button>
          )}
          <button
            type="button"
            disabled={notifBusy || notifPermission === 'unsupported'}
            onClick={() => void sendTestNotification()}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Send test
          </button>
        </div>
        {notifMessage && <p className="mt-2 text-sm text-slate-600">{notifMessage}</p>}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Metrics</h2>
          <button
            type="button"
            onClick={() => void resetToBuiltins()}
            className="text-xs font-medium text-primary-600 hover:text-primary-800"
          >
            Reset to defaults
          </button>
        </div>

        {showMetricsTip && (
          <div className="mb-4 rounded-xl bg-primary-50 p-4 text-sm text-primary-900 ring-1 ring-primary-100">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="font-semibold">Getting started with metrics</p>
              <button
                type="button"
                onClick={dismissMetricsTip}
                className="shrink-0 text-xs font-medium text-primary-700 hover:text-primary-900"
              >
                Got it
              </button>
            </div>
            <p className="mb-2 text-primary-800">
              You’re set up with five starters: Fatigue, Nausea, Pain, Stiffness, and
              Dizziness. Each has its own colour and 1–10 step texts. Use them as-is, or make
              them yours:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-primary-800">
              <li>
                <strong>Edit</strong> — change the name, colour, or any of the ten step labels
              </li>
              <li>
                <strong>Hide</strong> — keep the metric saved but stop it showing on Log
              </li>
              <li>
                <strong>Remove</strong> — delete it from your list (past logs keep their scores)
              </li>
              <li>
                <strong>+ Add metric</strong> — create a new one with your own name, colour, and
                1–10 texts
              </li>
              <li>
                <strong>Reset to defaults</strong> — bring the original five back anytime
              </li>
            </ul>
            <p className="mt-2 text-primary-800">
              Changes sync to your Google Sheet’s Metrics tab across devices.
            </p>
          </div>
        )}

        {!showMetricsTip && (
          <p className="mb-3 text-sm text-slate-500">
            Customise what you track: edit names and 1–10 texts, hide or remove any metric, or
            add new ones. Synced via the Metrics sheet.
          </p>
        )}

        <ul className="mb-3 space-y-2">
          {[...allMetrics]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((m) => (
              <li key={m.id}>
                {editingMetricId === m.id ? (
                  <MetricCatalogEditor
                    metric={m}
                    onSave={(data) => {
                      void updateMetric(m.id, data)
                      setEditingMetricId(null)
                    }}
                    onCancel={() => setEditingMetricId(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="min-w-0 flex items-center gap-3">
                      <span
                        className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-slate-200"
                        style={{ backgroundColor: m.color }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">
                          {m.label}
                          {!m.active && (
                            <span className="ml-2 text-xs font-normal text-slate-400">hidden</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-400">
                          1: {m.scaleLabels[0]} · 10: {m.scaleLabels[9]}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void updateMetric(m.id, { active: !m.active })}
                        className="text-xs font-medium text-primary-600 hover:text-primary-800"
                      >
                        {m.active ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingMetric(false)
                          setEditingMetricId(m.id)
                        }}
                        className="text-xs font-medium text-primary-600 hover:text-primary-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const ok = window.confirm(
                            `Remove “${m.label}”? Past entries keep their recorded values, but it won’t appear going forward. Use “Reset to defaults” to bring the original five back.`,
                          )
                          if (ok) void removeMetric(m.id)
                        }}
                        className="text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
        </ul>
        {addingMetric ? (
          <MetricCatalogEditor
            onSave={(data) => {
              void addMetric(data)
              setAddingMetric(false)
            }}
            onCancel={() => setAddingMetric(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingMetricId(null)
              setAddingMetric(true)
            }}
            className="rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100"
          >
            + Add metric
          </button>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Symptom check-ins</h2>
        <p className="mb-3 text-sm text-slate-500">
          Schedule times to capture metrics. Due slots appear on Log and open the same Symptoms
          form.
        </p>
        <ul className="mb-3 space-y-2">
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              {editingCheckInId === schedule.id ? (
                <CheckInScheduleEditor
                  schedule={schedule}
                  onSave={(data) => {
                    void updateSchedule(schedule.id, data)
                    setEditingCheckInId(null)
                  }}
                  onCancel={() => setEditingCheckInId(null)}
                />
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <div className="font-medium text-slate-800">
                      {schedule.label}
                      {!schedule.active && (
                        <span className="ml-2 text-xs font-normal text-slate-400">paused</span>
                      )}
                    </div>
                    <div className="text-xs text-primary-700">
                      {formatScheduleSummary(schedule)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCheckInId(schedule.id)}
                      className="text-xs font-medium text-primary-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSchedule(schedule.id)}
                      className="text-xs font-medium text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {addingCheckIn ? (
          <CheckInScheduleEditor
            onSave={(data) => {
              void addSchedule(data)
              setAddingCheckIn(false)
            }}
            onCancel={() => setAddingCheckIn(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingCheckIn(true)}
            className="rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100"
          >
            Add check-in schedule
          </button>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">My medications</h2>
        <p className="mb-3 text-sm text-slate-500">
          Names, doses, and schedules sync across devices. Due doses appear on the Log page.
        </p>
        <ul className="mb-3 space-y-2">
          {medicationPresets.map((preset) => (
            <li key={preset.id}>
              {editingId === preset.id ? (
                <MedicationPresetEditor
                  kind="medication"
                  preset={preset}
                  onSave={(data) => {
                    void updatePreset(preset.id, data)
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <div className="font-medium text-slate-800">
                      {preset.name}
                      {!preset.active && (
                        <span className="ml-2 text-xs font-normal text-slate-400">paused</span>
                      )}
                    </div>
                    {preset.defaultDose && (
                      <div className="text-xs text-slate-500">{preset.defaultDose}</div>
                    )}
                    <div className="text-xs text-violet-700">
                      {formatScheduleSummary(preset)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(preset.id)}
                      className="text-xs font-medium text-primary-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removePreset(preset.id)}
                      className="text-xs font-medium text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {adding ? (
          <MedicationPresetEditor
            kind="medication"
            onSave={(data) => {
              void addPreset(data)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
          >
            Add medication
          </button>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">My vitamins</h2>
        <p className="mb-3 text-sm text-slate-500">
          Same as medications: presets, doses, and schedules. Due vitamins appear on Log.
        </p>
        <ul className="mb-3 space-y-2">
          {vitaminPresets.map((preset) => (
            <li key={preset.id}>
              {editingVitaminId === preset.id ? (
                <MedicationPresetEditor
                  kind="vitamin"
                  preset={preset}
                  onSave={(data) => {
                    void updatePreset(preset.id, data)
                    setEditingVitaminId(null)
                  }}
                  onCancel={() => setEditingVitaminId(null)}
                />
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <div className="font-medium text-slate-800">
                      {preset.name}
                      {!preset.active && (
                        <span className="ml-2 text-xs font-normal text-slate-400">paused</span>
                      )}
                    </div>
                    {preset.defaultDose && (
                      <div className="text-xs text-slate-500">{preset.defaultDose}</div>
                    )}
                    <div className="text-xs text-emerald-700">
                      {formatScheduleSummary(preset)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingVitaminId(preset.id)}
                      className="text-xs font-medium text-primary-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removePreset(preset.id)}
                      className="text-xs font-medium text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {addingVitamin ? (
          <MedicationPresetEditor
            kind="vitamin"
            onSave={(data) => {
              void addPreset({ ...data, kind: 'vitamin' })
              setAddingVitamin(false)
            }}
            onCancel={() => setAddingVitamin(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingVitamin(true)}
            className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Add vitamin
          </button>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Share with your doctor</h2>
        <p className="mb-3 text-sm text-slate-500">
          Create a read-only link your doctor can open in a browser. They can choose which
          charts and date ranges to view. Links expire automatically and can be revoked.
        </p>
        <button
          type="button"
          onClick={() => setShowShareDialog(true)}
          className="mb-4 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
        >
          Create share link
        </button>
        <ManageShareLinks refreshKey={shareLinksKey} />
      </section>

      <DataBackupPanel />

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Sync</h2>
        <p className="text-sm text-slate-500">
          Status: <span className="font-medium capitalize text-slate-700">{syncStatus}</span>
          {pendingCount > 0 && ` · ${pendingCount} entr${pendingCount === 1 ? 'y' : 'ies'} waiting to sync`}
          {offlineMode && ' · offline mode — data saved on this device'}
        </p>
        {offlineMode && (
          <p className="mt-2 text-sm text-slate-500">
            You can keep logging without internet. Everything will upload to Supabase when
            you&apos;re back online.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Travel / no internet</h2>
        <p className="text-sm text-slate-500">
          Before a trip: open the app while online and let it load your data once. Install the
          PWA to your home screen. While away, log as usual — entries stay on your phone and
          sync automatically when you have internet again. Don&apos;t sign out until you&apos;re
          back online.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={() => refresh()}
          className="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Refresh data
        </button>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Install app</h2>
        <p className="text-sm text-slate-500">
          On Android, open this site in Chrome and tap <strong>Add to Home screen</strong>{' '}
          from the menu. On desktop, use your browser&apos;s install option if available.
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">About</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-slate-400">App version</dt>
            <dd className="font-medium text-slate-800">{APP_VERSION}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Storage</dt>
            <dd className="font-medium text-slate-800">
              {offlineMode ? 'IndexedDB (offline)' : 'IndexedDB + Supabase'}
            </dd>
          </div>
        </dl>
      </section>

      <button
        onClick={signOut}
        className="w-full rounded-xl border border-red-200 bg-white py-3 font-medium text-red-600 hover:bg-red-50"
      >
        Sign out
      </button>

      {showShareDialog && (
        <CreateShareDialog
          entries={entries}
          onClose={() => setShowShareDialog(false)}
          onCreated={() => setShareLinksKey((k) => k + 1)}
        />
      )}
    </div>
  )
}
