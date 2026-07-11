import type { CreateSharePayload, ShareRecord, SharedEntry } from '../src/types/share'

export interface ShareRecordStored extends ShareRecord {
  revokeSecret: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidToken(token: string): boolean {
  return UUID_RE.test(token)
}

function isSharedEntry(value: unknown): value is SharedEntry {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  if (e.type === 'symptoms') {
    return typeof e.timestamp === 'string'
  }
  if (e.type === 'medication') {
    return typeof e.timestamp === 'string' && typeof e.medication === 'string'
  }
  return false
}

export function parseCreatePayload(body: unknown): CreateSharePayload | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.dateFrom !== 'string' || typeof b.dateTo !== 'string') return null
  if (typeof b.includeNotes !== 'boolean') return null
  if (!Array.isArray(b.entries) || !b.entries.every(isSharedEntry)) return null
  if (typeof b.linkExpiryDays !== 'number' || ![7, 30, 90].includes(b.linkExpiryDays)) return null

  return {
    label: typeof b.label === 'string' ? b.label.slice(0, 100) : undefined,
    dateFrom: b.dateFrom,
    dateTo: b.dateTo,
    includeNotes: b.includeNotes,
    entries: b.entries,
    linkExpiryDays: b.linkExpiryDays,
  }
}

export function toPublicRecord(record: ShareRecordStored): ShareRecord {
  const { revokeSecret: _secret, ...publicRecord } = record
  return publicRecord
}
