import type {
  CheckInSchedule,
  HealthEntry,
  MedicationPreset,
  MetricCatalogItem,
} from '../types/entry'
import {
  normalizeCheckInSchedule,
  normalizeEntry,
  normalizeMedicationPreset,
  normalizeMetricCatalogItem,
} from '../types/entry'
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from './notifications'

export const BACKUP_VERSION = 1 as const

export interface HealthMetricsBackup {
  version: typeof BACKUP_VERSION
  exportedAt: string
  entries: HealthEntry[]
  metrics: MetricCatalogItem[]
  presets: MedicationPreset[]
  checkIns: CheckInSchedule[]
  notificationPrefs?: NotificationPrefs
}

export type ParsedBackup = {
  backup: HealthMetricsBackup
  summary: {
    entries: number
    metrics: number
    presets: number
    checkIns: number
    hasNotificationPrefs: boolean
  }
}

function stripEntry(entry: HealthEntry): HealthEntry {
  const normalized = normalizeEntry(entry)
  const { syncStatus: _sync, rowIndex: _row, ...rest } = normalized
  return rest as HealthEntry
}

function stripMetric(metric: MetricCatalogItem): MetricCatalogItem {
  const { rowIndex: _row, ...rest } = normalizeMetricCatalogItem(metric)
  return rest
}

function stripPreset(preset: MedicationPreset): MedicationPreset {
  const { rowIndex: _row, ...rest } = normalizeMedicationPreset(preset)
  return rest
}

function stripCheckIn(schedule: CheckInSchedule): CheckInSchedule {
  const { rowIndex: _row, ...rest } = normalizeCheckInSchedule(schedule)
  return rest
}

function normalizeNotificationPrefs(raw: unknown): NotificationPrefs | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const prefs = raw as Partial<NotificationPrefs>
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    enabled: prefs.enabled === true,
    medications: prefs.medications !== false,
    vitamins: prefs.vitamins !== false,
    checkIns: prefs.checkIns !== false,
  }
}

export function buildBackup(input: {
  entries: HealthEntry[]
  metrics: MetricCatalogItem[]
  presets: MedicationPreset[]
  checkIns: CheckInSchedule[]
  notificationPrefs?: NotificationPrefs
}): HealthMetricsBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: input.entries.map(stripEntry),
    metrics: input.metrics.map(stripMetric),
    presets: input.presets.map(stripPreset),
    checkIns: input.checkIns.map(stripCheckIn),
    notificationPrefs: input.notificationPrefs
      ? { ...input.notificationPrefs }
      : undefined,
  }
}

export function parseBackupJson(raw: string): ParsedBackup {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('File is not valid JSON.')
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Backup file is empty or invalid.')
  }

  const obj = data as Record<string, unknown>
  const version = Number(obj.version)
  if (version !== BACKUP_VERSION) {
    throw new Error(
      version
        ? `Unsupported backup version (${version}). This app supports version ${BACKUP_VERSION}.`
        : 'Missing backup version — this does not look like a HealthMetrics backup.',
    )
  }

  if (!Array.isArray(obj.entries)) throw new Error('Backup is missing entries.')
  if (!Array.isArray(obj.metrics)) throw new Error('Backup is missing metrics.')
  if (!Array.isArray(obj.presets)) throw new Error('Backup is missing presets.')
  if (!Array.isArray(obj.checkIns)) throw new Error('Backup is missing check-ins.')

  const entries = obj.entries.map((entry) => {
    const normalized = normalizeEntry(entry as HealthEntry)
    if (!normalized.id || !normalized.timestamp) {
      throw new Error('Backup contains an entry without id or timestamp.')
    }
    return stripEntry(normalized)
  })

  const metrics = obj.metrics.map((metric) => {
    const item = metric as Partial<MetricCatalogItem>
    if (!item.key) throw new Error('Backup contains a metric without a key.')
    return stripMetric(normalizeMetricCatalogItem(item as MetricCatalogItem))
  })

  const presets = obj.presets.map((preset) => {
    const item = preset as Partial<MedicationPreset>
    if (!item.id || !item.name) {
      throw new Error('Backup contains a preset without id or name.')
    }
    return stripPreset(
      normalizeMedicationPreset(item as MedicationPreset & { id: string; name: string }),
    )
  })

  const checkIns = obj.checkIns.map((schedule) => {
    const item = schedule as Partial<CheckInSchedule>
    if (!item.id) throw new Error('Backup contains a check-in without an id.')
    return stripCheckIn(
      normalizeCheckInSchedule(item as CheckInSchedule & { id: string }),
    )
  })

  const notificationPrefs = normalizeNotificationPrefs(obj.notificationPrefs)

  const backup: HealthMetricsBackup = {
    version: BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    entries,
    metrics,
    presets,
    checkIns,
    notificationPrefs,
  }

  return {
    backup,
    summary: {
      entries: entries.length,
      metrics: metrics.length,
      presets: presets.length,
      checkIns: checkIns.length,
      hasNotificationPrefs: Boolean(notificationPrefs),
    },
  }
}

export function downloadBackup(backup: HealthMetricsBackup): void {
  const stamp = backup.exportedAt.slice(0, 10)
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `healthmetrics-backup-${stamp}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function readBackupFile(file: File): Promise<ParsedBackup> {
  const text = await file.text()
  return parseBackupJson(text)
}
