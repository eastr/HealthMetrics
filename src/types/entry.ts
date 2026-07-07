export type MetricKey = 'fatigue' | 'mood' | 'nausea' | 'pain' | 'stiffness' | 'dizziness'

export const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'fatigue', label: 'Fatigue', color: '#f59e0b' },
  { key: 'mood', label: 'Mood', color: '#3b82f6' },
  { key: 'nausea', label: 'Nausea', color: '#8b5cf6' },
  { key: 'pain', label: 'Pain', color: '#ef4444' },
  { key: 'stiffness', label: 'Stiffness', color: '#6366f1' },
  { key: 'dizziness', label: 'Dizziness', color: '#06b6d4' },
]

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
