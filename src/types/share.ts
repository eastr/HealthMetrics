export interface SharedSymptomEntry {
  type: 'symptoms'
  timestamp: string
  fatigue: number
  mood: number
  nausea: number
  pain: number
  stiffness: number
  dizziness: number
  notes?: string
}

export interface SharedMedicationEntry {
  type: 'medication'
  timestamp: string
  medication: string
  dose: string
  notes?: string
}

export type SharedEntry = SharedSymptomEntry | SharedMedicationEntry

export interface ShareRecord {
  createdAt: string
  expiresAt: string
  label?: string
  dateFrom: string
  dateTo: string
  includeNotes: boolean
  entries: SharedEntry[]
}

export interface ShareRecordPublic extends ShareRecord {}

export interface CreateSharePayload {
  label?: string
  dateFrom: string
  dateTo: string
  includeNotes: boolean
  entries: SharedEntry[]
  linkExpiryDays: number
}

export interface CreateShareResponse {
  token: string
  url: string
  revokeSecret: string
  expiresAt: string
}

export interface StoredShareLink {
  token: string
  revokeSecret: string
  label?: string
  expiresAt: string
  url: string
  createdAt: string
}

export type ShareDataRange = 7 | 30 | 90 | 'all'
export type ShareLinkExpiry = 7 | 30 | 90
export type ShareViewerRange = 7 | 30 | 90 | 'full'
export type ShareSection = 'summary' | 'trends' | 'medications' | 'daily'
