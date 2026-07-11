export type MetricKey = 'fatigue' | 'mood' | 'nausea' | 'pain' | 'stiffness' | 'dizziness'

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

/** One label per score 1–10. Mood: low = poor, high = good. Symptoms: low = good, high = bad. */
export const METRIC_SCALE_LABELS: Record<MetricKey, readonly [string, string, string, string, string, string, string, string, string, string]> = {
  mood: [
    'Dark',
    'Gloomy',
    'Low',
    'Flat',
    'OK',
    'Fair',
    'Good',
    'Bright',
    'Elated',
    'Ecstatic',
  ],
  fatigue: [
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
  nausea: [
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
  pain: [
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
  stiffness: [
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
  dizziness: [
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
}

export function getMetricScaleLabel(metric: MetricKey, value: number): string {
  const clamped = Math.min(10, Math.max(1, Math.round(value)))
  return METRIC_SCALE_LABELS[metric][clamped - 1]
}

export interface HealthEntry {
  id: string
  timestamp: string
  fatigue: number
  mood: number
  nausea: number
  pain: number
  stiffness: number
  dizziness: number
  notes: string
  rowIndex?: number
  syncStatus?: 'synced' | 'pending' | 'error'
}

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error'
