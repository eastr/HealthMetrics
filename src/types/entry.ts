export type MetricKey = 'fatigue' | 'mood' | 'nausea' | 'pain' | 'stiffness' | 'dizziness'

export const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'fatigue', label: 'Fatigue', color: '#d97706' },
  { key: 'mood', label: 'Mood', color: '#2563eb' },
  { key: 'nausea', label: 'Nausea', color: '#0d9488' },
  { key: 'pain', label: 'Pain', color: '#dc2626' },
  { key: 'stiffness', label: 'Stiffness', color: '#16a34a' },
  { key: 'dizziness', label: 'Dizziness', color: '#9333ea' },
]

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
