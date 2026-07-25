import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  subDays,
  isWithinInterval,
  getHours,
} from 'date-fns'
import type {
  DoseEntry,
  DoseKind,
  HealthEntry,
  MedicationEntry,
  MetricKey,
  SymptomEntry,
} from '../types/entry'
import {
  LEGACY_METRIC_KEYS,
  getMetricValue,
  isDoseEntry,
  isSymptomEntry,
} from '../types/entry'

export function formatTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm')
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'EEE, MMM d')
}

export function formatDateKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd')
}

export function toDatetimeLocalValue(iso?: string): string {
  const d = iso ? parseISO(iso) : new Date()
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}

export function symptomEntries(entries: HealthEntry[]): HealthEntry[] {
  return entries.filter(isSymptomEntry)
}

export function doseEntries(entries: HealthEntry[], kind?: DoseKind): DoseEntry[] {
  return entries.filter(
    (e): e is DoseEntry => isDoseEntry(e) && (kind == null || e.type === kind),
  )
}

export function medicationEntries(entries: HealthEntry[]): MedicationEntry[] {
  return doseEntries(entries, 'medication') as MedicationEntry[]
}

export function vitaminEntries(entries: HealthEntry[]): DoseEntry[] {
  return doseEntries(entries, 'vitamin')
}

export function entriesForDate(entries: HealthEntry[], date: Date): HealthEntry[] {
  const start = startOfDay(date)
  const end = endOfDay(date)
  return entries
    .filter((e) => isWithinInterval(parseISO(e.timestamp), { start, end }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function averageMetric(entries: HealthEntry[], key: MetricKey): number | null {
  const symptoms = symptomEntries(entries) as SymptomEntry[]
  if (symptoms.length === 0) return null
  const sum = symptoms.reduce((acc, e) => acc + getMetricValue(e, key), 0)
  return Math.round((sum / symptoms.length) * 10) / 10
}

function metricKeysFromEntries(entries: HealthEntry[], keys?: string[]): string[] {
  if (keys && keys.length > 0) return keys
  const found = new Set<string>(LEGACY_METRIC_KEYS)
  for (const e of symptomEntries(entries) as SymptomEntry[]) {
    for (const k of Object.keys(e.values ?? {})) found.add(k)
  }
  return [...found]
}

function averagesRecord(entries: HealthEntry[], keys: string[]): Record<string, number> {
  const record: Record<string, number> = {}
  for (const key of keys) {
    record[key] = averageMetric(entries, key) ?? 0
  }
  return record
}

export type DailyAverage = {
  date: string
  label: string
  count: number
} & Record<string, number | string>

export function dailyAverages(
  entries: HealthEntry[],
  days: number,
  metricKeys?: string[],
): DailyAverage[] {
  const result: DailyAverage[] = []
  const today = startOfDay(new Date())
  const keys = metricKeysFromEntries(entries, metricKeys)

  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i)
    const dayEntries = symptomEntries(entriesForDate(entries, day))
    if (dayEntries.length === 0) continue

    result.push({
      date: format(day, 'yyyy-MM-dd'),
      label: format(day, 'MMM d'),
      count: dayEntries.length,
      ...averagesRecord(dayEntries, keys),
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

export type BucketAverage = {
  bucket: TimeBucket
  label: string
  count: number
} & Record<string, number | string>

export function timeOfDayAverages(
  entries: HealthEntry[],
  metricKeys?: string[],
): BucketAverage[] {
  const buckets: TimeBucket[] = ['morning', 'afternoon', 'evening']
  const symptoms = symptomEntries(entries)
  const keys = metricKeysFromEntries(entries, metricKeys)

  return buckets.map((bucket) => {
    const bucketEntries = symptoms.filter((e) => getTimeBucket(e.timestamp) === bucket)
    return {
      bucket,
      label: BUCKET_LABELS[bucket],
      count: bucketEntries.length,
      ...averagesRecord(bucketEntries, keys),
    }
  })
}

export function entriesInRange(entries: HealthEntry[], days: number): HealthEntry[] {
  const cutoff = subDays(startOfDay(new Date()), days - 1)
  return entries.filter((e) => parseISO(e.timestamp) >= cutoff)
}

export function summaryForPeriod(
  entries: HealthEntry[],
  metricKeys?: string[],
): Record<string, number | null> {
  const symptoms = symptomEntries(entries)
  const keys = metricKeysFromEntries(entries, metricKeys)
  const result: Record<string, number | null> = {}
  for (const key of keys) {
    result[key] = averageMetric(symptoms, key)
  }
  return result
}

export interface MedicationDayGroup {
  date: string
  label: string
  entries: DoseEntry[]
}

export function medicationsByDay(
  entries: HealthEntry[],
  days: number,
  kind: DoseKind = 'medication',
): MedicationDayGroup[] {
  const meds = doseEntries(entriesInRange(entries, days), kind)
  const byDate = new Map<string, DoseEntry[]>()

  for (const entry of meds) {
    const key = formatDateKey(entry.timestamp)
    const list = byDate.get(key) ?? []
    list.push(entry)
    byDate.set(key, list)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEntries]) => ({
      date,
      label: format(parseISO(dayEntries[0].timestamp), 'EEE, MMM d'),
      entries: dayEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }))
}

export interface MedicationFrequency {
  name: string
  count: number
}

export function medicationFrequency(
  entries: HealthEntry[],
  days: number,
  kind: DoseKind = 'medication',
): MedicationFrequency[] {
  const meds = doseEntries(entriesInRange(entries, days), kind)
  const counts = new Map<string, number>()

  for (const entry of meds) {
    counts.set(entry.medication, (counts.get(entry.medication) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export interface MedicationDoseDay {
  date: string
  label: string
  total: number
  byMed: Record<string, number>
}

export function medicationDosesPerDay(
  entries: HealthEntry[],
  days: number,
  kind: DoseKind = 'medication',
): MedicationDoseDay[] {
  const meds = doseEntries(entriesInRange(entries, days), kind)
  const byDate = new Map<string, DoseEntry[]>()

  for (const entry of meds) {
    const key = formatDateKey(entry.timestamp)
    const list = byDate.get(key) ?? []
    list.push(entry)
    byDate.set(key, list)
  }

  const today = startOfDay(new Date())
  const result: MedicationDoseDay[] = []

  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i)
    const key = format(day, 'yyyy-MM-dd')
    const dayEntries = byDate.get(key) ?? []
    if (dayEntries.length === 0) continue

    const byMed: Record<string, number> = {}
    for (const entry of dayEntries) {
      byMed[entry.medication] = (byMed[entry.medication] ?? 0) + 1
    }

    result.push({
      date: key,
      label: format(day, 'MMM d'),
      total: dayEntries.length,
      byMed,
    })
  }

  return result
}

export function medicationDaysInRange(
  entries: HealthEntry[],
  days: number,
  medFilter?: string,
  kind: DoseKind = 'medication',
): Set<string> {
  let meds = doseEntries(entriesInRange(entries, days), kind)
  if (medFilter && medFilter !== 'all') {
    meds = meds.filter((e) => e.medication === medFilter)
  }
  return new Set(meds.map((e) => formatDateKey(e.timestamp)))
}

export function medicationsForDate(
  entries: HealthEntry[],
  dateKey: string,
  medFilter?: string,
  kind: DoseKind = 'medication',
): DoseEntry[] {
  let meds = doseEntries(entries, kind).filter((e) => formatDateKey(e.timestamp) === dateKey)
  if (medFilter && medFilter !== 'all') {
    meds = meds.filter((e) => e.medication === medFilter)
  }
  return meds.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export function formatMedicationLine(entry: DoseEntry): string {
  return entry.dose ? `${entry.medication} ${entry.dose}` : entry.medication
}

export function dailyAveragesEndingAt(
  entries: HealthEntry[],
  endDate: Date,
  days: number,
  metricKeys?: string[],
): DailyAverage[] {
  const result: DailyAverage[] = []
  const end = startOfDay(endDate)
  const keys = metricKeysFromEntries(entries, metricKeys)

  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(end, i)
    const dayEntries = symptomEntries(entriesForDate(entries, day))
    if (dayEntries.length === 0) continue

    result.push({
      date: format(day, 'yyyy-MM-dd'),
      label: format(day, 'MMM d'),
      count: dayEntries.length,
      ...averagesRecord(dayEntries, keys),
    })
  }

  return result
}

export function medicationsByDayFromEntries(
  entries: HealthEntry[],
  kind: DoseKind = 'medication',
): MedicationDayGroup[] {
  const meds = doseEntries(entries, kind)
  const byDate = new Map<string, DoseEntry[]>()

  for (const entry of meds) {
    const key = formatDateKey(entry.timestamp)
    const list = byDate.get(key) ?? []
    list.push(entry)
    byDate.set(key, list)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEntries]) => ({
      date,
      label: format(parseISO(dayEntries[0].timestamp), 'EEE, MMM d'),
      entries: dayEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }))
}

export function medicationFrequencyFromEntries(
  entries: HealthEntry[],
  kind: DoseKind = 'medication',
): MedicationFrequency[] {
  const meds = doseEntries(entries, kind)
  const counts = new Map<string, number>()

  for (const entry of meds) {
    counts.set(entry.medication, (counts.get(entry.medication) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function medicationDosesPerDayEndingAt(
  entries: HealthEntry[],
  endDate: Date,
  days: number,
  kind: DoseKind = 'medication',
): MedicationDoseDay[] {
  const meds = doseEntries(entries, kind)
  const byDate = new Map<string, DoseEntry[]>()

  for (const entry of meds) {
    const key = formatDateKey(entry.timestamp)
    const list = byDate.get(key) ?? []
    list.push(entry)
    byDate.set(key, list)
  }

  const end = startOfDay(endDate)
  const result: MedicationDoseDay[] = []

  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(end, i)
    const key = format(day, 'yyyy-MM-dd')
    const dayEntries = byDate.get(key) ?? []
    if (dayEntries.length === 0) continue

    const byMed: Record<string, number> = {}
    for (const entry of dayEntries) {
      byMed[entry.medication] = (byMed[entry.medication] ?? 0) + 1
    }

    result.push({
      date: key,
      label: format(day, 'MMM d'),
      total: dayEntries.length,
      byMed,
    })
  }

  return result
}

export function medicationDaysFromEntries(
  entries: HealthEntry[],
  medFilter?: string,
  kind: DoseKind = 'medication',
): Set<string> {
  let meds = doseEntries(entries, kind)
  if (medFilter && medFilter !== 'all') {
    meds = meds.filter((e) => e.medication === medFilter)
  }
  return new Set(meds.map((e) => formatDateKey(e.timestamp)))
}

export function viewerRangeDays(range: number | 'full', dateFrom: string, dateTo: string): number {
  if (range !== 'full') return range
  const from = startOfDay(parseISO(dateFrom))
  const to = startOfDay(parseISO(dateTo))
  const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, Math.min(diff, 365))
}
