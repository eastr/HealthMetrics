import { parseISO, startOfDay, subDays } from 'date-fns'
import type { HealthEntry } from '../types/entry'

/** Max history kept in IndexedDB / React state on device. Full history stays in Google Sheets. */
export const LOCAL_ENTRY_RETENTION_DAYS = 90

/** Start of the oldest local day still retained (inclusive). */
export function localRetentionCutoff(
  days: number = LOCAL_ENTRY_RETENTION_DAYS,
  now: Date = new Date(),
): Date {
  return startOfDay(subDays(now, days - 1))
}

/** Keep entries on or after the retention cutoff. */
export function retainRecentEntries(
  entries: HealthEntry[],
  days: number = LOCAL_ENTRY_RETENTION_DAYS,
  now: Date = new Date(),
): HealthEntry[] {
  const cutoffIso = localRetentionCutoff(days, now).toISOString()
  return entries.filter((e) => e.timestamp >= cutoffIso)
}

export function isWithinLocalRetention(
  timestamp: string,
  days: number = LOCAL_ENTRY_RETENTION_DAYS,
  now: Date = new Date(),
): boolean {
  return parseISO(timestamp) >= localRetentionCutoff(days, now)
}
