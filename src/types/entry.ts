export type EntryType = 'symptoms' | 'medication'

/** Stable slug used as the key in entry.values and chart dataKeys */
export type MetricKey = string

export type ScaleLabels = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]

export const DEFAULT_SCALE_LABELS: ScaleLabels = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
]

/** Built-in metrics shipped with the app (preserved texts + colors) */
export const BUILTIN_METRICS: MetricCatalogItem[] = [
  {
    id: 'fatigue',
    key: 'fatigue',
    label: 'Fatigue',
    color: '#d97706',
    active: true,
    sortOrder: 1,
    scaleLabels: [
      'Energised',
      'Rested',
      'Alert',
      'Fine',
      'Tired',
      'Weary',
      'Drained',
      'Exhausted',
      'Depleted',
      'Wrecked',
    ],
  },
  {
    id: 'nausea',
    key: 'nausea',
    label: 'Nausea',
    color: '#000000',
    active: true,
    sortOrder: 2,
    scaleLabels: [
      'None',
      'Faint',
      'Mild',
      'Noticeable',
      'Uncomfortable',
      'Queasy',
      'Nauseous',
      'Sickly',
      'Very sick',
      'Severe',
    ],
  },
  {
    id: 'pain',
    key: 'pain',
    label: 'Pain',
    color: '#dc2626',
    active: true,
    sortOrder: 3,
    scaleLabels: [
      'None',
      'Faint',
      'Mild',
      'Dull',
      'Moderate',
      'Aching',
      'Strong',
      'Intense',
      'Severe',
      'Agonising',
    ],
  },
  {
    id: 'stiffness',
    key: 'stiffness',
    label: 'Stiffness',
    color: '#16a34a',
    active: true,
    sortOrder: 4,
    scaleLabels: [
      'Loose',
      'Supple',
      'Fine',
      'Slight',
      'Moderate',
      'Tight',
      'Stiff',
      'Rigid',
      'Very stiff',
      'Frozen',
    ],
  },
  {
    id: 'dizziness',
    key: 'dizziness',
    label: 'Dizziness',
    color: '#9333ea',
    active: true,
    sortOrder: 5,
    scaleLabels: [
      'Clear',
      'Steady',
      'Fine',
      'Slight',
      'Light-headed',
      'Dizzy',
      'Spinning',
      'Very dizzy',
      'Debilitating',
      'Severe',
    ],
  },
]

/**
 * Fixed Entries-sheet columns still written for backward compatibility.
 * Includes `mood` even though it is no longer a built-in catalog default.
 */
export const LEGACY_METRIC_KEYS = [
  'fatigue',
  'mood',
  'nausea',
  'pain',
  'stiffness',
  'dizziness',
] as const

/** Optional scale texts for known keys that are not in BUILTIN_METRICS */
const EXTRA_SCALE_LABELS: Record<string, ScaleLabels> = {
  mood: [
    'Ecstatic',
    'Elated',
    'Bright',
    'Good',
    'Fair',
    'OK',
    'Flat',
    'Low',
    'Gloomy',
    'Dark',
  ],
}

export interface MetricCatalogItem {
  id: string
  key: MetricKey
  label: string
  color: string
  active: boolean
  sortOrder: number
  scaleLabels: ScaleLabels
  rowIndex?: number
}

/** @deprecated alias — use MetricCatalogItem */
export type MetricConfig = MetricCatalogItem
/** @deprecated */
export type MetricDefinition = Pick<MetricCatalogItem, 'key' | 'label'>
/** @deprecated */
export type MetricSheetRow = MetricCatalogItem

export const METRIC_DEFINITIONS = BUILTIN_METRICS.map((m) => ({
  key: m.key,
  label: m.label,
}))

export const METRIC_KEYS = BUILTIN_METRICS.map((m) => m.key)

export const DEFAULT_METRIC_COLORS: Record<string, string> = Object.fromEntries(
  BUILTIN_METRICS.map((m) => [m.key, m.color]),
)

export const METRIC_SCALE_LABELS: Record<string, ScaleLabels> = {
  ...Object.fromEntries(BUILTIN_METRICS.map((m) => [m.key, m.scaleLabels])),
  ...EXTRA_SCALE_LABELS,
}

export function normalizeScaleLabels(raw: unknown): ScaleLabels {
  if (Array.isArray(raw) && raw.length >= 10) {
    return raw.slice(0, 10).map((s, i) => String(s || i + 1)) as ScaleLabels
  }
  return [...DEFAULT_SCALE_LABELS] as ScaleLabels
}

export function normalizeMetricCatalogItem(
  raw: Partial<MetricCatalogItem> & { key: string },
): MetricCatalogItem {
  const key = slugifyMetricKey(raw.key)
  const builtin = BUILTIN_METRICS.find((m) => m.key === key)
  const knownScale = builtin?.scaleLabels ?? EXTRA_SCALE_LABELS[key]
  return {
    id: raw.id || key,
    key,
    label: (raw.label ?? builtin?.label ?? key).trim() || key,
    color: raw.color || builtin?.color || (key === 'mood' ? '#2563eb' : '#64748b'),
    active: raw.active !== false,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : builtin?.sortOrder ?? 99,
    scaleLabels: normalizeScaleLabels(raw.scaleLabels ?? knownScale),
    rowIndex: raw.rowIndex,
  }
}

export function slugifyMetricKey(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return slug || `metric_${Date.now().toString(36)}`
}

export function getMetricScaleLabel(
  metric: MetricCatalogItem | MetricKey,
  value: number,
  catalog?: MetricCatalogItem[],
): string {
  const clamped = Math.min(10, Math.max(1, Math.round(value)))
  if (typeof metric === 'object') {
    return metric.scaleLabels[clamped - 1]
  }
  const fromCatalog = catalog?.find((m) => m.key === metric)
  if (fromCatalog) return fromCatalog.scaleLabels[clamped - 1]
  const builtin = METRIC_SCALE_LABELS[metric]
  if (builtin) return builtin[clamped - 1]
  return String(clamped)
}

export function defaultMetricValues(metrics: MetricCatalogItem[]): Record<string, number> {
  const values: Record<string, number> = {}
  for (const m of metrics.filter((x) => x.active)) {
    values[m.key] = 1
  }
  return values
}

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error'

/** Logged dose kinds (medications and vitamins share the same shape). */
export type DoseKind = 'medication' | 'vitamin'

interface BaseEntry {
  id: string
  timestamp: string
  notes: string
  rowIndex?: number
  syncStatus?: SyncStatus
}

export interface SymptomEntry extends BaseEntry {
  type: 'symptoms'
  /** metric key → score 1–10 */
  values: Record<string, number>
}

/** Medication or vitamin log — same fields; sheet reuses medication/dose columns. */
export interface DoseEntry extends BaseEntry {
  type: DoseKind
  medication: string
  dose: string
}

export type MedicationEntry = DoseEntry & { type: 'medication' }
export type VitaminEntry = DoseEntry & { type: 'vitamin' }

export type HealthEntry = SymptomEntry | DoseEntry

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type ScheduleDays = 'daily' | Weekday[]

export interface MedicationPreset {
  id: string
  name: string
  defaultDose?: string
  times: string[]
  days: ScheduleDays
  active: boolean
  notes?: string
  /** Defaults to medication for older rows without a kind column. */
  kind: DoseKind
  rowIndex?: number
}

export interface CheckInSchedule {
  id: string
  label: string
  times: string[]
  days: ScheduleDays
  active: boolean
  rowIndex?: number
}

export function normalizeCheckInSchedule(
  raw: Partial<CheckInSchedule> & { id: string },
): CheckInSchedule {
  return {
    id: raw.id,
    label: (raw.label ?? 'Check-in').trim() || 'Check-in',
    times: Array.isArray(raw.times) ? raw.times.filter(Boolean) : [],
    days: raw.days === 'daily' || Array.isArray(raw.days) ? raw.days : 'daily',
    active: raw.active !== false,
    rowIndex: raw.rowIndex,
  }
}

export function normalizeDoseKind(raw: unknown): DoseKind {
  return raw === 'vitamin' ? 'vitamin' : 'medication'
}

export function normalizeMedicationPreset(
  raw: Partial<MedicationPreset> & { id: string; name: string },
): MedicationPreset {
  return {
    id: raw.id,
    name: raw.name,
    defaultDose: raw.defaultDose?.trim() || undefined,
    times: Array.isArray(raw.times) ? raw.times.filter(Boolean) : [],
    days: raw.days === 'daily' || Array.isArray(raw.days) ? raw.days : 'daily',
    active: raw.active !== false,
    notes: raw.notes?.trim() || undefined,
    kind: normalizeDoseKind(raw.kind),
    rowIndex: raw.rowIndex,
  }
}

export function isSymptomEntry(entry: HealthEntry): entry is SymptomEntry {
  return entry.type === 'symptoms'
}

export function isDoseEntry(entry: HealthEntry): entry is DoseEntry {
  return entry.type === 'medication' || entry.type === 'vitamin'
}

export function isMedicationEntry(entry: HealthEntry): entry is MedicationEntry {
  return entry.type === 'medication'
}

export function isVitaminEntry(entry: HealthEntry): entry is VitaminEntry {
  return entry.type === 'vitamin'
}

export type ActivityFilter = 'all' | 'symptoms' | 'medication' | 'vitamin'

export function filterEntries(entries: HealthEntry[], filter: ActivityFilter): HealthEntry[] {
  if (filter === 'all') return entries
  if (filter === 'symptoms') return entries.filter(isSymptomEntry)
  if (filter === 'vitamin') return entries.filter(isVitaminEntry)
  return entries.filter(isMedicationEntry)
}

export function getMetricValue(entry: SymptomEntry, key: string): number {
  const v = entry.values?.[key]
  return typeof v === 'number' && !Number.isNaN(v) ? v : 1
}

function valuesFromLegacyFields(r: Record<string, unknown>): Record<string, number> {
  const values: Record<string, number> = {}
  for (const key of LEGACY_METRIC_KEYS) {
    values[key] = Number(r[key]) || 1
  }
  if (r.values && typeof r.values === 'object' && !Array.isArray(r.values)) {
    for (const [k, v] of Object.entries(r.values as Record<string, unknown>)) {
      values[k] = Number(v) || 1
    }
  }
  return values
}

/** Migrate cached or legacy rows missing `type` / `values` */
export function normalizeEntry(raw: HealthEntry | Record<string, unknown>): HealthEntry {
  const r = raw as Record<string, unknown>

  if (r.type === 'vitamin') {
    return {
      type: 'vitamin',
      id: String(r.id),
      timestamp: String(r.timestamp),
      medication: String(r.medication ?? ''),
      dose: String(r.dose ?? ''),
      notes: String(r.notes ?? ''),
      rowIndex: r.rowIndex as number | undefined,
      syncStatus: r.syncStatus as SyncStatus | undefined,
    }
  }

  if (r.type === 'medication' || (typeof r.medication === 'string' && r.medication && r.type !== 'symptoms')) {
    return {
      type: 'medication',
      id: String(r.id),
      timestamp: String(r.timestamp),
      medication: String(r.medication ?? ''),
      dose: String(r.dose ?? ''),
      notes: String(r.notes ?? ''),
      rowIndex: r.rowIndex as number | undefined,
      syncStatus: r.syncStatus as SyncStatus | undefined,
    }
  }

  if (r.type === 'symptoms' || r.values || r.fatigue !== undefined) {
    return {
      type: 'symptoms',
      id: String(r.id),
      timestamp: String(r.timestamp),
      values: valuesFromLegacyFields(r),
      notes: String(r.notes ?? ''),
      rowIndex: r.rowIndex as number | undefined,
      syncStatus: r.syncStatus as SyncStatus | undefined,
    }
  }

  return {
    type: 'symptoms',
    id: String(r.id ?? ''),
    timestamp: String(r.timestamp ?? ''),
    values: valuesFromLegacyFields(r),
    notes: String(r.notes ?? ''),
    rowIndex: r.rowIndex as number | undefined,
    syncStatus: r.syncStatus as SyncStatus | undefined,
  }
}

