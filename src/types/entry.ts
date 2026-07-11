export type MetricKey = 'fatigue' | 'mood' | 'nausea' | 'pain' | 'stiffness' | 'dizziness'

export type EntryType = 'symptoms' | 'medication'

export interface MetricDefinition {
  key: MetricKey
  label: string
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'mood', label: 'Mood' },
  { key: 'nausea', label: 'Nausea' },
  { key: 'pain', label: 'Pain' },
  { key: 'stiffness', label: 'Stiffness' },
  { key: 'dizziness', label: 'Dizziness' },
]

export const METRIC_KEYS = METRIC_DEFINITIONS.map((m) => m.key)

export const DEFAULT_METRIC_COLORS: Record<MetricKey, string> = {
  fatigue: '#d97706',
  mood: '#2563eb',
  nausea: '#000000',
  pain: '#dc2626',
  stiffness: '#16a34a',
  dizziness: '#9333ea',
}

export interface MetricConfig extends MetricDefinition {
  color: string
}

export function buildMetrics(customColors: Partial<Record<MetricKey, string>> = {}): MetricConfig[] {
  return METRIC_DEFINITIONS.map((m) => ({
    ...m,
    color: customColors[m.key] ?? DEFAULT_METRIC_COLORS[m.key],
  }))
}

/** @deprecated Use useMetrics() hook for user-customizable colors */
export const METRICS: MetricConfig[] = buildMetrics()

export const METRIC_SCALE_LABELS: Record<MetricKey, readonly [string, string, string, string, string, string, string, string, string, string]> = {
  mood: ['Dark', 'Gloomy', 'Low', 'Flat', 'OK', 'Fair', 'Good', 'Bright', 'Elated', 'Ecstatic'],
  fatigue: ['Energised', 'Rested', 'Alert', 'Fine', 'Tired', 'Weary', 'Drained', 'Exhausted', 'Depleted', 'Wrecked'],
  nausea: ['None', 'Faint', 'Mild', 'Noticeable', 'Uncomfortable', 'Queasy', 'Nauseous', 'Sickly', 'Very sick', 'Severe'],
  pain: ['None', 'Faint', 'Mild', 'Dull', 'Moderate', 'Aching', 'Strong', 'Intense', 'Severe', 'Agonising'],
  stiffness: ['Loose', 'Supple', 'Fine', 'Slight', 'Moderate', 'Tight', 'Stiff', 'Rigid', 'Very stiff', 'Frozen'],
  dizziness: ['Clear', 'Steady', 'Fine', 'Slight', 'Light-headed', 'Dizzy', 'Spinning', 'Very dizzy', 'Debilitating', 'Severe'],
}

export function getMetricScaleLabel(metric: MetricKey, value: number): string {
  const clamped = Math.min(10, Math.max(1, Math.round(value)))
  return METRIC_SCALE_LABELS[metric][clamped - 1]
}

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error'

interface BaseEntry {
  id: string
  timestamp: string
  notes: string
  rowIndex?: number
  syncStatus?: SyncStatus
}

export interface SymptomEntry extends BaseEntry {
  type: 'symptoms'
  fatigue: number
  mood: number
  nausea: number
  pain: number
  stiffness: number
  dizziness: number
}

export interface MedicationEntry extends BaseEntry {
  type: 'medication'
  medication: string
  dose: string
}

export type HealthEntry = SymptomEntry | MedicationEntry

export interface MedicationPreset {
  id: string
  name: string
  defaultDose?: string
}

export function isSymptomEntry(entry: HealthEntry): entry is SymptomEntry {
  return entry.type === 'symptoms'
}

export function isMedicationEntry(entry: HealthEntry): entry is MedicationEntry {
  return entry.type === 'medication'
}

export type ActivityFilter = 'all' | 'symptoms' | 'medication'

export function filterEntries(entries: HealthEntry[], filter: ActivityFilter): HealthEntry[] {
  if (filter === 'all') return entries
  if (filter === 'symptoms') return entries.filter(isSymptomEntry)
  return entries.filter(isMedicationEntry)
}

/** Migrate cached or legacy rows missing `type` */
export function normalizeEntry(raw: HealthEntry | Record<string, unknown>): HealthEntry {
  if (
    raw &&
    typeof raw === 'object' &&
    'type' in raw &&
    (raw.type === 'symptoms' || raw.type === 'medication')
  ) {
    return raw as HealthEntry
  }

  const r = raw as Record<string, unknown>
  if (typeof r.medication === 'string' && r.medication) {
    return {
      type: 'medication',
      id: String(r.id),
      timestamp: String(r.timestamp),
      medication: r.medication,
      dose: String(r.dose ?? ''),
      notes: String(r.notes ?? ''),
      rowIndex: r.rowIndex as number | undefined,
      syncStatus: r.syncStatus as SyncStatus | undefined,
    }
  }

  return {
    type: 'symptoms',
    id: String(r.id),
    timestamp: String(r.timestamp),
    fatigue: Number(r.fatigue) || 1,
    mood: Number(r.mood) || 1,
    nausea: Number(r.nausea) || 1,
    pain: Number(r.pain) || 1,
    stiffness: Number(r.stiffness) || 1,
    dizziness: Number(r.dizziness) || 1,
    notes: String(r.notes ?? ''),
    rowIndex: r.rowIndex as number | undefined,
    syncStatus: r.syncStatus as SyncStatus | undefined,
  }
}
