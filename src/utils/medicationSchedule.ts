import { format, parseISO, getHours, getMinutes, getDay } from 'date-fns'
import type {
  CheckInSchedule,
  DoseKind,
  HealthEntry,
  MedicationPreset,
  ScheduleDays,
  Weekday,
} from '../types/entry'
import { isDoseEntry, isSymptomEntry } from '../types/entry'

export interface DueDose {
  presetId: string
  name: string
  dose: string
  time: string
  taken: boolean
  entryId?: string
}

export interface DueCheckIn {
  scheduleId: string
  label: string
  time: string
  taken: boolean
  entryId?: string
}

function isActiveOnDate(
  active: boolean,
  times: string[],
  days: ScheduleDays,
  date: Date,
): boolean {
  if (!active || times.length === 0) return false
  if (days === 'daily') return true
  const day = getDay(date) as Weekday
  return days.includes(day)
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function entryMinutes(iso: string): number {
  const d = parseISO(iso)
  return getHours(d) * 60 + getMinutes(d)
}

function pairTimesToLogs(
  times: string[],
  logs: HealthEntry[],
): { time: string; taken: boolean; entryId?: string }[] {
  const sortedTimes = [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
  const sortedLogs = [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const used = new Set<string>()
  const result: { time: string; taken: boolean; entryId?: string }[] = []

  for (const time of sortedTimes) {
    const target = timeToMinutes(time)
    let best: HealthEntry | null = null
    let bestDist = Infinity
    for (const log of sortedLogs) {
      if (used.has(log.id)) continue
      const dist = Math.abs(entryMinutes(log.timestamp) - target)
      if (dist < bestDist) {
        bestDist = dist
        best = log
      }
    }
    if (best && bestDist <= 180) {
      used.add(best.id)
      result.push({ time, taken: true, entryId: best.id })
    } else {
      const leftover = sortedLogs.find((l) => !used.has(l.id))
      if (leftover) {
        used.add(leftover.id)
        result.push({ time, taken: true, entryId: leftover.id })
      } else {
        result.push({ time, taken: false })
      }
    }
  }
  return result
}

export function getDueDosesForDate(
  presets: MedicationPreset[],
  entries: HealthEntry[],
  date: Date = new Date(),
  kind: DoseKind = 'medication',
): DueDose[] {
  const dateKey = format(date, 'yyyy-MM-dd')
  const dayDoses = entries.filter(
    (e) =>
      isDoseEntry(e) &&
      e.type === kind &&
      format(parseISO(e.timestamp), 'yyyy-MM-dd') === dateKey,
  )

  const result: DueDose[] = []

  for (const preset of presets) {
    if ((preset.kind ?? 'medication') !== kind) continue
    if (!isActiveOnDate(preset.active, preset.times, preset.days, date)) continue
    const logs = dayDoses.filter(
      (e) => isDoseEntry(e) && e.medication === preset.name,
    )
    for (const slot of pairTimesToLogs(preset.times, logs)) {
      result.push({
        presetId: preset.id,
        name: preset.name,
        dose: preset.defaultDose ?? '',
        time: slot.time,
        taken: slot.taken,
        entryId: slot.entryId,
      })
    }
  }

  return result.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
}

/** Pair symptom entries to check-in schedule times for the day. */
export function getDueCheckInsForDate(
  schedules: CheckInSchedule[],
  entries: HealthEntry[],
  date: Date = new Date(),
): DueCheckIn[] {
  const dateKey = format(date, 'yyyy-MM-dd')
  const daySymptoms = entries.filter(
    (e) => isSymptomEntry(e) && format(parseISO(e.timestamp), 'yyyy-MM-dd') === dateKey,
  )

  // All symptom logs for the day are shared across check-in schedules (pool pairing).
  // Process schedules in order; each log used at most once across all slots.
  const used = new Set<string>()
  const result: DueCheckIn[] = []

  const activeSchedules = schedules.filter((s) =>
    isActiveOnDate(s.active, s.times, s.days, date),
  )

  for (const schedule of activeSchedules) {
    const times = [...schedule.times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
    const available = daySymptoms.filter((e) => !used.has(e.id))

    for (const time of times) {
      const target = timeToMinutes(time)
      let best: HealthEntry | null = null
      let bestDist = Infinity
      for (const log of available) {
        if (used.has(log.id)) continue
        const dist = Math.abs(entryMinutes(log.timestamp) - target)
        if (dist < bestDist) {
          bestDist = dist
          best = log
        }
      }
      if (best && bestDist <= 180) {
        used.add(best.id)
        result.push({
          scheduleId: schedule.id,
          label: schedule.label,
          time,
          taken: true,
          entryId: best.id,
        })
      } else {
        const leftover = available.find((l) => !used.has(l.id))
        if (leftover) {
          used.add(leftover.id)
          result.push({
            scheduleId: schedule.id,
            label: schedule.label,
            time,
            taken: true,
            entryId: leftover.id,
          })
        } else {
          result.push({
            scheduleId: schedule.id,
            label: schedule.label,
            time,
            taken: false,
          })
        }
      }
    }
  }

  return result.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
}

export function formatScheduleSummary(item: {
  times: string[]
  days: ScheduleDays
}): string {
  const times = item.times.length > 0 ? item.times.join(', ') : 'no times'
  if (item.days === 'daily') return `Daily · ${times}`
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = [...item.days]
    .sort((a, b) => a - b)
    .map((d) => labels[d])
    .join(' ')
  return `${days || '—'} · ${times}`
}

export function parseTimesInput(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    .map((t) => {
      const [h, m] = t.split(':')
      return `${h.padStart(2, '0')}:${m}`
    })
}

export function timestampForScheduledTime(time: string): string {
  return timestampForScheduledTimeOnDate(time, new Date())
}

/** Same as timestampForScheduledTime but anchored to an arbitrary day (backfill). */
export function timestampForScheduledTimeOnDate(time: string, date: Date): string {
  const at = new Date(date)
  const [h, m] = time.split(':').map(Number)
  at.setHours(h || 0, m || 0, 0, 0)
  return at.toISOString()
}
