import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  subDays,
  isWithinInterval,
  getHours,
} from 'date-fns'
import type { HealthEntry, MetricKey } from '../types/entry'
import { METRIC_KEYS } from '../types/entry'

export function formatTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm')
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'EEE, MMM d')
}

export function formatDateKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd')
}

/** Value for `<input type="datetime-local" />` in local timezone */
export function toDatetimeLocalValue(iso?: string): string {
  const d = iso ? parseISO(iso) : new Date()
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

/** Parse datetime-local input value to ISO 8601 */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}

export function entriesForDate(entries: HealthEntry[], date: Date): HealthEntry[] {
  const start = startOfDay(date)
  const end = endOfDay(date)
  return entries
    .filter((e) => isWithinInterval(parseISO(e.timestamp), { start, end }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export function averageMetric(entries: HealthEntry[], key: MetricKey): number | null {
  if (entries.length === 0) return null
  const sum = entries.reduce((acc, e) => acc + e[key], 0)
  return Math.round((sum / entries.length) * 10) / 10
}

export interface DailyAverage {
  date: string
  label: string
  fatigue: number
  mood: number
  nausea: number
  pain: number
  stiffness: number
  dizziness: number
  count: number
}

export function dailyAverages(
  entries: HealthEntry[],
  days: number,
): DailyAverage[] {
  const result: DailyAverage[] = []
  const today = startOfDay(new Date())

  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i)
    const dayEntries = entriesForDate(entries, day)
    if (dayEntries.length === 0) continue

    result.push({
      date: format(day, 'yyyy-MM-dd'),
      label: format(day, 'MMM d'),
      fatigue: averageMetric(dayEntries, 'fatigue') ?? 0,
      mood: averageMetric(dayEntries, 'mood') ?? 0,
      nausea: averageMetric(dayEntries, 'nausea') ?? 0,
      pain: averageMetric(dayEntries, 'pain') ?? 0,
      stiffness: averageMetric(dayEntries, 'stiffness') ?? 0,
      dizziness: averageMetric(dayEntries, 'dizziness') ?? 0,
      count: dayEntries.length,
    })
  }

  return result
}

export type TimeBucket = 'morning' | 'afternoon' | 'evening'

export function getTimeBucket(iso: string): TimeBucket {
  const hour = getHours(parseISO(iso))
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}

const BUCKET_LABELS: Record<TimeBucket, string> = {
  morning: 'Morning (6–12)',
  afternoon: 'Afternoon (12–18)',
  evening: 'Evening (18–6)',
}

export interface BucketAverage {
  bucket: TimeBucket
  label: string
  fatigue: number
  mood: number
  nausea: number
  pain: number
  stiffness: number
  dizziness: number
  count: number
}

export function timeOfDayAverages(entries: HealthEntry[]): BucketAverage[] {
  const buckets: TimeBucket[] = ['morning', 'afternoon', 'evening']

  return buckets.map((bucket) => {
    const bucketEntries = entries.filter((e) => getTimeBucket(e.timestamp) === bucket)
    return {
      bucket,
      label: BUCKET_LABELS[bucket],
      fatigue: averageMetric(bucketEntries, 'fatigue') ?? 0,
      mood: averageMetric(bucketEntries, 'mood') ?? 0,
      nausea: averageMetric(bucketEntries, 'nausea') ?? 0,
      pain: averageMetric(bucketEntries, 'pain') ?? 0,
      stiffness: averageMetric(bucketEntries, 'stiffness') ?? 0,
      dizziness: averageMetric(bucketEntries, 'dizziness') ?? 0,
      count: bucketEntries.length,
    }
  })
}

export function entriesInRange(
  entries: HealthEntry[],
  days: number,
): HealthEntry[] {
  const cutoff = subDays(startOfDay(new Date()), days - 1)
  return entries.filter((e) => parseISO(e.timestamp) >= cutoff)
}

export function summaryForPeriod(
  entries: HealthEntry[],
): Record<MetricKey, number | null> {
  const result = {} as Record<MetricKey, number | null>
  for (const key of METRIC_KEYS) {
    result[key] = averageMetric(entries, key)
  }
  return result
}
