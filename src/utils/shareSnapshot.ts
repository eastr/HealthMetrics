import { parseISO, startOfDay, endOfDay, subDays, min as minDate, max as maxDate } from 'date-fns'
import type { HealthEntry } from '../types/entry'
import { isMedicationEntry, normalizeEntry } from '../types/entry'
import type { CreateSharePayload, ShareDataRange, SharedEntry, ShareViewerRange } from '../types/share'
import { entriesInRange } from './analytics'

export interface ShareSnapshotOptions {
  dataRange: ShareDataRange
  includeNotes: boolean
  linkExpiryDays: number
  label?: string
}

export interface ShareSnapshotResult {
  payload: CreateSharePayload
}

function toSharedEntry(entry: HealthEntry, includeNotes: boolean): SharedEntry {
  if (isMedicationEntry(entry)) {
    const shared: SharedEntry = {
      type: 'medication',
      timestamp: entry.timestamp,
      medication: entry.medication,
      dose: entry.dose,
    }
    if (includeNotes && entry.notes) shared.notes = entry.notes
    return shared
  }

  const shared: SharedEntry = {
    type: 'symptoms',
    timestamp: entry.timestamp,
    fatigue: entry.fatigue,
    mood: entry.mood,
    nausea: entry.nausea,
    pain: entry.pain,
    stiffness: entry.stiffness,
    dizziness: entry.dizziness,
  }
  if (includeNotes && entry.notes) shared.notes = entry.notes
  return shared
}

function filterByDataRange(entries: HealthEntry[], dataRange: ShareDataRange): HealthEntry[] {
  if (dataRange === 'all') return [...entries]
  return entriesInRange(entries, dataRange)
}

export function toShareSnapshot(
  rawEntries: HealthEntry[],
  options: ShareSnapshotOptions,
): ShareSnapshotResult {
  const entries = rawEntries.map(normalizeEntry)
  const scoped = filterByDataRange(entries, options.dataRange).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  )

  const timestamps = scoped.map((e) => parseISO(e.timestamp))
  const now = new Date()
  const dateFrom =
    timestamps.length > 0
      ? startOfDay(minDate(timestamps)).toISOString()
      : startOfDay(now).toISOString()
  const dateTo =
    timestamps.length > 0
      ? endOfDay(maxDate(timestamps)).toISOString()
      : endOfDay(now).toISOString()

  const payload: CreateSharePayload = {
    label: options.label?.trim() || undefined,
    dateFrom,
    dateTo,
    includeNotes: options.includeNotes,
    entries: scoped.map((e) => toSharedEntry(e, options.includeNotes)),
    linkExpiryDays: options.linkExpiryDays,
  }

  return { payload }
}

export function sharedEntriesToHealth(entries: SharedEntry[]): HealthEntry[] {
  return entries.map((entry, index) => {
    const id = `share-${index}-${entry.timestamp}`
    if (entry.type === 'medication') {
      return {
        type: 'medication' as const,
        id,
        timestamp: entry.timestamp,
        medication: entry.medication,
        dose: entry.dose,
        notes: entry.notes ?? '',
      }
    }
    return {
      type: 'symptoms' as const,
      id,
      timestamp: entry.timestamp,
      fatigue: entry.fatigue,
      mood: entry.mood,
      nausea: entry.nausea,
      pain: entry.pain,
      stiffness: entry.stiffness,
      dizziness: entry.dizziness,
      notes: entry.notes ?? '',
    }
  })
}

export function filterEntriesForViewer(
  entries: HealthEntry[],
  dateFrom: string,
  dateTo: string,
  range: ShareViewerRange,
): HealthEntry[] {
  const from = startOfDay(parseISO(dateFrom))
  const to = endOfDay(parseISO(dateTo))

  let filtered = entries.filter((e) => {
    const t = parseISO(e.timestamp)
    return t >= from && t <= to
  })

  if (range !== 'full') {
    const cutoff = subDays(startOfDay(to), range - 1)
    const start = cutoff > from ? cutoff : from
    filtered = filtered.filter((e) => parseISO(e.timestamp) >= start)
  }

  return filtered
}
