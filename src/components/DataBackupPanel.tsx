import { useRef, useState } from 'react'
import { useEntries } from '../hooks/useEntries'
import { useMetricColorsSettings } from '../hooks/useMetricColors'
import { useMedicationPresets } from '../hooks/useMedicationPresets'
import { useCheckInSchedules } from '../hooks/useCheckInSchedules'
import { notifyPrefsChanged } from '../hooks/useReminders'
import {
  buildBackup,
  downloadBackup,
  readBackupFile,
  type ParsedBackup,
} from '../services/dataBackup'
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  saveNotificationPrefs,
} from '../services/notifications'

export default function DataBackupPanel() {
  const { entries, importEntries } = useEntries()
  const { allMetrics, replaceAll: replaceMetrics } = useMetricColorsSettings()
  const { presets, replaceAll: replacePresets } = useMedicationPresets()
  const { schedules, replaceAll: replaceSchedules } = useCheckInSchedules()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ParsedBackup | null>(null)
  const [overwriteAll, setOverwriteAll] = useState(false)

  const handleExport = () => {
    setError(null)
    setMessage(null)
    try {
      const backup = buildBackup({
        entries,
        metrics: allMetrics,
        presets,
        checkIns: schedules,
        notificationPrefs: loadNotificationPrefs(),
      })
      downloadBackup(backup)
      setMessage(
        `Exported ${backup.entries.length} entries, ${backup.metrics.length} metrics, ${backup.presets.length} presets, ${backup.checkIns.length} check-ins.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setMessage(null)
    setOverwriteAll(false)
    setBusy(true)
    try {
      const parsed = await readBackupFile(file)
      setPendingImport(parsed)
    } catch (err) {
      setPendingImport(null)
      setError(err instanceof Error ? err.message : 'Could not read backup file.')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return
    const { backup, summary } = pendingImport
    const mode = overwriteAll ? 'replace' : 'merge'
    const ok = window.confirm(
      [
        overwriteAll ? 'Overwrite everything with this backup?' : 'Restore this backup?',
        '',
        overwriteAll
          ? `• ${summary.entries} entries (full replace — entries not in the file are deleted)`
          : `• ${summary.entries} entries (merged by id — existing extras stay)`,
        `• ${summary.metrics} metrics (replaces your catalog)`,
        `• ${summary.presets} medication/vitamin presets (replaces)`,
        `• ${summary.checkIns} check-in schedules (replaces)`,
        summary.hasNotificationPrefs || overwriteAll
          ? '• Notification preferences (replaces on this device)'
          : null,
        '',
        overwriteAll
          ? 'This cannot be undone except by importing another backup.'
          : 'Changes sync to Supabase when online.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    if (!ok) return

    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const { imported, removed } = await importEntries(backup.entries, { mode })
      await replaceMetrics(backup.metrics)
      await replacePresets(backup.presets)
      await replaceSchedules(backup.checkIns)
      if (backup.notificationPrefs) {
        saveNotificationPrefs(backup.notificationPrefs)
        notifyPrefsChanged()
      } else if (overwriteAll) {
        saveNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS })
        notifyPrefsChanged()
      }
      setPendingImport(null)
      setOverwriteAll(false)
      setMessage(
        mode === 'replace'
          ? `Overwrote data: ${imported} entries restored${removed > 0 ? `, ${removed} removed` : ''}.`
          : `Restored ${imported} entries and replaced metrics, presets, and check-ins.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 text-lg font-semibold text-slate-800">Backup & restore</h2>
      <p className="mb-3 text-sm text-slate-500">
        Download a JSON backup of your entries, metrics, presets, and check-in schedules — or
        restore one onto this device. Useful before switching phones or as a safety copy.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleExport}
          className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
        >
          Export JSON
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFileChosen(e.target.files?.[0])}
        />
      </div>

      {pendingImport && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-100">
          <p className="font-medium">Ready to restore</p>
          <p className="mt-1 text-amber-900">
            Exported {pendingImport.backup.exportedAt.slice(0, 10)} ·{' '}
            {pendingImport.summary.entries} entries · {pendingImport.summary.metrics} metrics ·{' '}
            {pendingImport.summary.presets} presets · {pendingImport.summary.checkIns} check-ins
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={overwriteAll}
              disabled={busy}
              onChange={(e) => setOverwriteAll(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Overwrite everything — delete entries on this account that are not in the backup.
              Metrics, presets, and check-ins are always replaced.
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmImport()}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                overwriteAll ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-700'
              }`}
            >
              {busy ? 'Restoring…' : overwriteAll ? 'Overwrite & restore' : 'Restore'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPendingImport(null)
                setOverwriteAll(false)
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
