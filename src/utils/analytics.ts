import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  subDays,
  isWithinInterval,
  getHours,
  getDay,
  differenceInCalendarDays,
} from 'date-fns'
import type {
  CheckInSchedule,
  DoseEntry,
  DoseKind,
  HealthEntry,
  MedicationEntry,
  MedicationPreset,
  MetricKey,
  SymptomEntry,
} from '../types/entry'
import {
  LEGACY_METRIC_KEYS,
  getMetricValue,
  isDoseEntry,
  isSymptomEntry,
} from '../types/entry'
import {
  getDueCheckInsForDayEntries,
  getDueDosesForDayEntries,
  indexEntriesByDateKey,
  timestampForScheduledTimeOnDate,
} from './medicationSchedule'

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
  const byDate = indexEntriesByDateKey(entries)

  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i)
    const dayEntries = symptomEntries(byDate.get(format(day, 'yyyy-MM-dd')) ?? [])
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

/** Calendar days from earliest entry through today (inclusive). Empty history → 1. */
export function spanDaysFromEntries(entries: HealthEntry[], now: Date = new Date()): number {
  if (entries.length === 0) return 1
  let earliest = entries[0]!.timestamp
  for (const entry of entries) {
    if (entry.timestamp < earliest) earliest = entry.timestamp
  }
  return Math.max(1, differenceInCalendarDays(startOfDay(now), startOfDay(parseISO(earliest))) + 1)
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

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Mean of the given metrics across the symptom entries, or null when there is nothing to average. */
function compositeSeverity(entries: HealthEntry[], keys: string[]): number | null {
  const symptoms = symptomEntries(entries) as SymptomEntry[]
  if (symptoms.length === 0 || keys.length === 0) return null
  let sum = 0
  for (const key of keys) {
    sum += symptoms.reduce((acc, e) => acc + getMetricValue(e, key), 0) / symptoms.length
  }
  return round1(sum / keys.length)
}

/* ------------------------------------------------------------------ */
/* Adherence                                                           */
/* ------------------------------------------------------------------ */

export type AdherenceKind = DoseKind | 'checkin'

export interface AdherenceTally {
  scheduled: number
  taken: number
  pct: number | null
}

export interface AdherenceItem extends AdherenceTally {
  key: string
  label: string
  kind: AdherenceKind
}

export interface AdherenceStats extends AdherenceTally {
  byKind: Record<AdherenceKind, AdherenceTally>
  items: AdherenceItem[]
}

function tally(scheduled: number, taken: number): AdherenceTally {
  return { scheduled, taken, pct: scheduled === 0 ? null : Math.round((taken / scheduled) * 100) }
}

/** Scheduled slots that already elapsed, on the given day. */
function pastSlots<T extends { time: string; taken: boolean }>(
  slots: T[],
  day: Date,
  now: Date,
  dayIsFullyPast: boolean,
): T[] {
  if (dayIsFullyPast) return slots
  const nowMs = now.getTime()
  return slots.filter(
    (s) => new Date(timestampForScheduledTimeOnDate(s.time, day)).getTime() <= nowMs,
  )
}

export interface AdherenceWindow {
  stats: AdherenceStats
  streaks: StreakStats
  byDay: Map<string, { scheduled: number; taken: number; pct: number }>
}

export interface StreakStats {
  /** Consecutive days, ending today, where every elapsed scheduled slot was logged. */
  currentComplete: number
  longestComplete: number
  /** Consecutive days, ending today, with at least one entry of any kind. */
  currentLogged: number
  longestLogged: number
}

function countCurrentStreak(flags: (boolean | null)[]): number {
  let streak = 0
  for (let i = flags.length - 1; i >= 0; i--) {
    const flag = flags[i]
    // Days with nothing scheduled neither extend nor break the streak.
    if (flag === null) continue
    if (!flag) break
    streak += 1
  }
  return streak
}

function countLongestStreak(flags: (boolean | null)[]): number {
  let best = 0
  let run = 0
  for (const flag of flags) {
    if (flag === null) continue
    if (flag) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}

function finalizeAdherenceStats(counters: Map<string, AdherenceItem>): AdherenceStats {
  const items = [...counters.values()]
    .map((item) => ({ ...item, ...tally(item.scheduled, item.taken) }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label))

  const forKind = (kind: AdherenceKind) => {
    const subset = items.filter((i) => i.kind === kind)
    return tally(
      subset.reduce((acc, i) => acc + i.scheduled, 0),
      subset.reduce((acc, i) => acc + i.taken, 0),
    )
  }

  return {
    ...tally(
      items.reduce((acc, i) => acc + i.scheduled, 0),
      items.reduce((acc, i) => acc + i.taken, 0),
    ),
    byKind: {
      medication: forKind('medication'),
      vitamin: forKind('vitamin'),
      checkin: forKind('checkin'),
    },
    items,
  }
}

/**
 * One-pass adherence + streaks + daily map over `lookbackDays`.
 * Indexes entries by date once, then expands schedules per day without re-scanning the full list.
 */
export function computeAdherenceWindow(
  entries: HealthEntry[],
  presets: MedicationPreset[],
  schedules: CheckInSchedule[],
  lookbackDays: number,
  statsDays?: number,
  now: Date = new Date(),
): AdherenceWindow {
  const byDate = indexEntriesByDateKey(entries)
  const today = startOfDay(now)
  const todayKey = format(today, 'yyyy-MM-dd')
  const rangeForStats = statsDays ?? lookbackDays
  const statsStartKey = format(subDays(today, rangeForStats - 1), 'yyyy-MM-dd')

  const counters = new Map<string, AdherenceItem>()
  const byDay = new Map<string, { scheduled: number; taken: number; pct: number }>()
  const complete: (boolean | null)[] = []
  const logged: boolean[] = []

  const bump = (key: string, label: string, kind: AdherenceKind, taken: boolean) => {
    const existing = counters.get(key) ?? { key, label, kind, scheduled: 0, taken: 0, pct: null }
    existing.scheduled += 1
    if (taken) existing.taken += 1
    counters.set(key, existing)
  }

  for (let i = lookbackDays - 1; i >= 0; i--) {
    const day = subDays(today, i)
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayEntries = byDate.get(dateKey) ?? []
    const dayIsFullyPast = dateKey < todayKey
    const inStatsRange = dateKey >= statsStartKey

    const medSlots = pastSlots(
      getDueDosesForDayEntries(presets, dayEntries, day, 'medication'),
      day,
      now,
      dayIsFullyPast,
    )
    const vitSlots = pastSlots(
      getDueDosesForDayEntries(presets, dayEntries, day, 'vitamin'),
      day,
      now,
      dayIsFullyPast,
    )
    const checkSlots = pastSlots(
      getDueCheckInsForDayEntries(schedules, dayEntries, day),
      day,
      now,
      dayIsFullyPast,
    )

    if (inStatsRange) {
      for (const slot of medSlots) {
        bump(`medication:${slot.presetId}`, slot.name, 'medication', slot.taken)
      }
      for (const slot of vitSlots) {
        bump(`vitamin:${slot.presetId}`, slot.name, 'vitamin', slot.taken)
      }
      for (const slot of checkSlots) {
        bump(`checkin:${slot.scheduleId}`, slot.label, 'checkin', slot.taken)
      }

      const dayScheduled = medSlots.length + vitSlots.length + checkSlots.length
      if (dayScheduled > 0) {
        const dayTaken =
          medSlots.filter((s) => s.taken).length +
          vitSlots.filter((s) => s.taken).length +
          checkSlots.filter((s) => s.taken).length
        byDay.set(dateKey, {
          scheduled: dayScheduled,
          taken: dayTaken,
          pct: Math.round((dayTaken / dayScheduled) * 100),
        })
      }
    }

    const allSlots = medSlots.length + vitSlots.length + checkSlots.length
    complete.push(
      allSlots === 0
        ? null
        : medSlots.every((s) => s.taken) &&
            vitSlots.every((s) => s.taken) &&
            checkSlots.every((s) => s.taken),
    )
    logged.push(dayEntries.length > 0)
  }

  return {
    stats: finalizeAdherenceStats(counters),
    streaks: {
      currentComplete: countCurrentStreak(complete),
      longestComplete: countLongestStreak(complete),
      currentLogged: countCurrentStreak(logged),
      longestLogged: countLongestStreak(logged),
    },
    byDay,
  }
}

/**
 * Compare scheduled med/vitamin doses and check-ins against what was actually logged
 * over the trailing `days` window. Only slots whose time has already passed are counted.
 */
export function adherenceStats(
  entries: HealthEntry[],
  presets: MedicationPreset[],
  schedules: CheckInSchedule[],
  days: number,
  now: Date = new Date(),
): AdherenceStats {
  return computeAdherenceWindow(entries, presets, schedules, days, days, now).stats
}

export function loggingStreaks(
  entries: HealthEntry[],
  presets: MedicationPreset[],
  schedules: CheckInSchedule[],
  lookbackDays = 90,
  now: Date = new Date(),
): StreakStats {
  return computeAdherenceWindow(entries, presets, schedules, lookbackDays, lookbackDays, now)
    .streaks
}

/* ------------------------------------------------------------------ */
/* Period comparison                                                   */
/* ------------------------------------------------------------------ */

export interface MetricDelta {
  key: string
  current: number | null
  previous: number | null
  delta: number | null
}

/** Averages for the trailing `days` window versus the equally sized window before it. */
export function periodDeltas(
  entries: HealthEntry[],
  days: number,
  metricKeys?: string[],
): MetricDelta[] {
  const keys = metricKeysFromEntries(entries, metricKeys)
  const today = startOfDay(new Date())
  const currentStart = subDays(today, days - 1)
  const previousStart = subDays(today, days * 2 - 1)

  const inWindow = (start: Date, end: Date) =>
    symptomEntries(
      entries.filter((e) => {
        const at = parseISO(e.timestamp)
        return at >= start && at < end
      }),
    )

  const current = inWindow(currentStart, endOfDay(today))
  const previous = inWindow(previousStart, currentStart)

  return keys.map((key) => {
    const cur = averageMetric(current, key)
    const prev = averageMetric(previous, key)
    return {
      key,
      current: cur,
      previous: prev,
      delta: cur != null && prev != null ? round1(cur - prev) : null,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Day-of-week patterns                                                */
/* ------------------------------------------------------------------ */

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type WeekdayAverage = {
  weekday: number
  label: string
  count: number
} & Record<string, number | string>

export function weekdayAverages(
  entries: HealthEntry[],
  metricKeys?: string[],
): WeekdayAverage[] {
  const symptoms = symptomEntries(entries)
  const keys = metricKeysFromEntries(entries, metricKeys)
  const buckets: HealthEntry[][] = Array.from({ length: 7 }, () => [])

  for (const entry of symptoms) {
    buckets[getDay(parseISO(entry.timestamp))].push(entry)
  }

  return WEEKDAY_LABELS.map((label, weekday) => {
    const dayEntries = buckets[weekday]
    return {
      weekday,
      label,
      count: dayEntries.length,
      ...averagesRecord(dayEntries, keys),
    }
  })
}

/* ------------------------------------------------------------------ */
/* Best / worst days                                                   */
/* ------------------------------------------------------------------ */

export interface DayScore {
  date: string
  label: string
  score: number
  count: number
}

/** Mean severity across all tracked metrics, for each day in the trailing window that has data. */
export function dailyCompositeScores(
  entries: HealthEntry[],
  days: number,
  metricKeys?: string[],
): DayScore[] {
  const keys = metricKeysFromEntries(entries, metricKeys)
  const byDate = indexEntriesByDateKey(entries)
  const today = startOfDay(new Date())
  const scored: DayScore[] = []

  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i)
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayEntries = symptomEntries(byDate.get(dateKey) ?? [])
    if (dayEntries.length === 0) continue
    const score = compositeSeverity(dayEntries, keys)
    if (score == null) continue
    scored.push({
      date: dateKey,
      label: format(day, 'EEE, MMM d'),
      score,
      count: dayEntries.length,
    })
  }

  return scored
}

/** Ranks days in the trailing window by mean severity across all tracked metrics. */
export function bestWorstDays(
  entries: HealthEntry[],
  days: number,
  metricKeys?: string[],
  top = 3,
): { best: DayScore[]; worst: DayScore[] } {
  const ascending = dailyCompositeScores(entries, days, metricKeys).sort(
    (a, b) => a.score - b.score,
  )
  return {
    best: ascending.slice(0, top),
    worst: [...ascending].reverse().slice(0, top),
  }
}

/** Daily composite severity keyed by yyyy-MM-dd, for heatmaps. */
export function dailySeverityMap(
  entries: HealthEntry[],
  days: number,
  metricKeys?: string[],
): Map<string, DayScore> {
  return new Map(dailyCompositeScores(entries, days, metricKeys).map((d) => [d.date, d]))
}

/** Adherence percentage per day keyed by yyyy-MM-dd, for heatmaps. */
export function dailyAdherenceMap(
  entries: HealthEntry[],
  presets: MedicationPreset[],
  schedules: CheckInSchedule[],
  days: number,
  now: Date = new Date(),
): Map<string, { scheduled: number; taken: number; pct: number }> {
  return computeAdherenceWindow(entries, presets, schedules, days, days, now).byDay
}

/* ------------------------------------------------------------------ */
/* Rolling average                                                     */
/* ------------------------------------------------------------------ */

export const ROLLING_SUFFIX = '__roll'

export function rollingKey(metricKey: string): string {
  return `${metricKey}${ROLLING_SUFFIX}`
}

/** Adds a `<key>__roll` field per metric holding the trailing mean of the last `window` points. */
export function withRollingAverage(
  daily: DailyAverage[],
  metricKeys: string[],
  window = 7,
): DailyAverage[] {
  return daily.map((point, index) => {
    const slice = daily.slice(Math.max(0, index - window + 1), index + 1)
    const rolled: Record<string, number> = {}
    for (const key of metricKeys) {
      const values = slice
        .map((p) => p[key])
        .filter((v): v is number => typeof v === 'number')
      if (values.length > 0) {
        rolled[rollingKey(key)] = round1(values.reduce((a, b) => a + b, 0) / values.length)
      }
    }
    return { ...point, ...rolled }
  })
}

/* ------------------------------------------------------------------ */
/* Score distribution                                                  */
/* ------------------------------------------------------------------ */

export interface ScoreBucket {
  score: number
  label: string
  count: number
}

export function scoreDistribution(entries: HealthEntry[], metricKey: string): ScoreBucket[] {
  const counts = new Array(10).fill(0) as number[]
  for (const entry of symptomEntries(entries) as SymptomEntry[]) {
    if (entry.values?.[metricKey] == null) continue
    const score = Math.min(10, Math.max(1, Math.round(getMetricValue(entry, metricKey))))
    counts[score - 1] += 1
  }
  return counts.map((count, i) => ({ score: i + 1, label: String(i + 1), count }))
}

/* ------------------------------------------------------------------ */
/* Correlations and medication effect                                  */
/* ------------------------------------------------------------------ */

/** Per-day average for one metric, only for days where the metric was actually recorded. */
function dailySeriesForMetric(entries: HealthEntry[], key: string): Map<string, number> {
  const byDate = new Map<string, number[]>()
  for (const entry of symptomEntries(entries) as SymptomEntry[]) {
    if (entry.values?.[key] == null) continue
    const dateKey = formatDateKey(entry.timestamp)
    const list = byDate.get(dateKey) ?? []
    list.push(getMetricValue(entry, key))
    byDate.set(dateKey, list)
  }
  return new Map(
    [...byDate.entries()].map(([date, values]) => [
      date,
      values.reduce((a, b) => a + b, 0) / values.length,
    ]),
  )
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 3) return null
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return Math.round((num / Math.sqrt(denX * denY)) * 100) / 100
}

export interface MetricCorrelation {
  a: string
  b: string
  r: number | null
  n: number
}

/** Pearson correlation between each metric pair, computed over daily averages. */
export function metricCorrelations(
  entries: HealthEntry[],
  metricKeys?: string[],
): MetricCorrelation[] {
  const keys = metricKeysFromEntries(entries, metricKeys)
  const series = new Map(keys.map((key) => [key, dailySeriesForMetric(entries, key)]))
  const result: MetricCorrelation[] = []

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const seriesA = series.get(keys[i])!
      const seriesB = series.get(keys[j])!
      const xs: number[] = []
      const ys: number[] = []
      for (const [date, value] of seriesA) {
        const other = seriesB.get(date)
        if (other == null) continue
        xs.push(value)
        ys.push(other)
      }
      result.push({ a: keys[i], b: keys[j], r: pearson(xs, ys), n: xs.length })
    }
  }

  return result
}

export interface MedEffect {
  name: string
  takenAvg: number | null
  notTakenAvg: number | null
  takenDays: number
  notTakenDays: number
  delta: number | null
}

/**
 * Mean composite symptom severity on days a med/vitamin was logged versus days it was not.
 * A negative delta suggests lower symptom scores on days the item was taken.
 */
export function medEffectOnSymptoms(
  entries: HealthEntry[],
  days: number,
  metricKeys?: string[],
  kind: DoseKind = 'medication',
): MedEffect[] {
  const symptomDays = dailyCompositeScores(entries, days, metricKeys)

  const names = new Set<string>()
  const takenDaysByName = new Map<string, Set<string>>()
  for (const entry of doseEntries(entriesInRange(entries, days), kind)) {
    names.add(entry.medication)
    const set = takenDaysByName.get(entry.medication) ?? new Set<string>()
    set.add(formatDateKey(entry.timestamp))
    takenDaysByName.set(entry.medication, set)
  }

  const mean = (values: number[]) =>
    values.length === 0 ? null : round1(values.reduce((a, b) => a + b, 0) / values.length)

  return [...names]
    .map((name) => {
      const takenOn = takenDaysByName.get(name) ?? new Set<string>()
      const taken = symptomDays.filter((d) => takenOn.has(d.date)).map((d) => d.score)
      const notTaken = symptomDays.filter((d) => !takenOn.has(d.date)).map((d) => d.score)
      const takenAvg = mean(taken)
      const notTakenAvg = mean(notTaken)
      return {
        name,
        takenAvg,
        notTakenAvg,
        takenDays: taken.length,
        notTakenDays: notTaken.length,
        delta: takenAvg != null && notTakenAvg != null ? round1(takenAvg - notTakenAvg) : null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
