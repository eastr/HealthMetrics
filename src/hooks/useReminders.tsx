import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { useEntries } from './useEntries'
import { useMedicationPresets } from './useMedicationPresets'
import { useCheckInSchedules } from './useCheckInSchedules'
import { getDueCheckInsForDate, getDueDosesForDate, timeToMinutes } from '../utils/medicationSchedule'
import {
  loadNotificationPrefs,
  markNotified,
  showReminderNotification,
  wasNotified,
  type NotificationPrefs,
} from '../services/notifications'

/** How long after a scheduled time we still fire a catch-up reminder (ms). */
const GRACE_MS = 2 * 60 * 60 * 1000

function prefsListenerKey() {
  return 'healthmetrics_notification_prefs_changed'
}

/** Call after saving prefs so the reminder hook refreshes without a full reload. */
export function notifyPrefsChanged(): void {
  window.dispatchEvent(new Event(prefsListenerKey()))
}

function scheduledDateForTime(time: string): Date {
  const now = new Date()
  const [h, m] = time.split(':').map(Number)
  const at = new Date(now)
  at.setHours(h || 0, m || 0, 0, 0)
  return at
}

/**
 * Schedules browser notifications for today's medication, vitamin, and check-in
 * slots while the app is open (or recently used). Requires notification permission
 * and Settings → Notifications enabled.
 */
export function useReminders() {
  const { entries } = useEntries()
  const { presets } = useMedicationPresets()
  const { schedules } = useCheckInSchedules()
  const timers = useRef<number[]>([])
  const prefsRef = useRef<NotificationPrefs>(loadNotificationPrefs())

  useEffect(() => {
    const onPrefs = () => {
      prefsRef.current = loadNotificationPrefs()
    }
    window.addEventListener(prefsListenerKey(), onPrefs)
    window.addEventListener('storage', onPrefs)
    return () => {
      window.removeEventListener(prefsListenerKey(), onPrefs)
      window.removeEventListener('storage', onPrefs)
    }
  }, [])

  useEffect(() => {
    const clearTimers = () => {
      for (const id of timers.current) window.clearTimeout(id)
      timers.current = []
    }

    const fire = async (
      tag: string,
      title: string,
      body: string,
      dateKey: string,
    ) => {
      if (wasNotified(dateKey, tag)) return
      const ok = await showReminderNotification({ tag, title, body, url: '/' })
      if (ok.ok) markNotified(dateKey, tag)
    }

    const schedule = () => {
      clearTimers()
      const prefs = loadNotificationPrefs()
      prefsRef.current = prefs
      if (!prefs.enabled) return
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

      const now = new Date()
      const dateKey = format(now, 'yyyy-MM-dd')
      const nowMs = now.getTime()

      const queue = (
        tag: string,
        title: string,
        body: string,
        time: string,
        taken: boolean,
      ) => {
        if (taken) return
        if (wasNotified(dateKey, tag)) return

        const at = scheduledDateForTime(time)
        const atMs = at.getTime()
        const delay = atMs - nowMs

        if (delay > 0) {
          const id = window.setTimeout(() => {
            void fire(tag, title, body, dateKey)
          }, delay)
          timers.current.push(id)
        } else if (delay >= -GRACE_MS) {
          // Overdue but within grace — remind shortly so open-app catches it
          const id = window.setTimeout(() => {
            void fire(tag, title, body, dateKey)
          }, 1500)
          timers.current.push(id)
        }
      }

      if (prefs.medications) {
        for (const dose of getDueDosesForDate(presets, entries, now, 'medication')) {
          queue(
            `med-${dose.presetId}-${dose.time}`,
            'Medication reminder',
            `${dose.time} · ${dose.name}${dose.dose ? ` (${dose.dose})` : ''}`,
            dose.time,
            dose.taken,
          )
        }
      }

      if (prefs.vitamins) {
        for (const dose of getDueDosesForDate(presets, entries, now, 'vitamin')) {
          queue(
            `vit-${dose.presetId}-${dose.time}`,
            'Vitamin reminder',
            `${dose.time} · ${dose.name}${dose.dose ? ` (${dose.dose})` : ''}`,
            dose.time,
            dose.taken,
          )
        }
      }

      if (prefs.checkIns) {
        for (const slot of getDueCheckInsForDate(schedules, entries, now)) {
          queue(
            `checkin-${slot.scheduleId}-${slot.time}`,
            'Check-in reminder',
            `${slot.time} · ${slot.label}`,
            slot.time,
            slot.taken,
          )
        }
      }
    }

    schedule()

    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Reschedule at midnight-ish and refresh every 15 minutes
    const interval = window.setInterval(schedule, 15 * 60 * 1000)

    // Also re-run shortly after minute boundaries so newly due slots are caught
    const msToNextMinute = 60_000 - (Date.now() % 60_000)
    const minuteTimer = window.setTimeout(() => {
      schedule()
    }, msToNextMinute + 200)

    return () => {
      clearTimers()
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
      window.clearTimeout(minuteTimer)
    }
  }, [entries, presets, schedules])
}

/** Sort helper kept available for tests / debugging */
export function upcomingReminderTimes(times: string[]): string[] {
  return [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
}
