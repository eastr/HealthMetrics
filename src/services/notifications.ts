export type NotificationPrefs = {
  enabled: boolean
  medications: boolean
  vitamins: boolean
  checkIns: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  medications: true,
  vitamins: true,
  checkIns: true,
}

const PREFS_KEY = 'healthmetrics_notification_prefs'
const NOTIFIED_KEY_PREFIX = 'healthmetrics_notified_'

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS }
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>
    return {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...parsed,
    }
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS }
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

function notifiedStorageKey(dateKey: string): string {
  return `${NOTIFIED_KEY_PREFIX}${dateKey}`
}

export function wasNotified(dateKey: string, tag: string): boolean {
  try {
    const raw = localStorage.getItem(notifiedStorageKey(dateKey))
    if (!raw) return false
    const list = JSON.parse(raw) as string[]
    return Array.isArray(list) && list.includes(tag)
  } catch {
    return false
  }
}

export function markNotified(dateKey: string, tag: string): void {
  try {
    const key = notifiedStorageKey(dateKey)
    const raw = localStorage.getItem(key)
    const list = raw ? (JSON.parse(raw) as string[]) : []
    const next = Array.isArray(list) ? list : []
    if (!next.includes(tag)) next.push(tag)
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export interface ReminderPayload {
  tag: string
  title: string
  body: string
  url?: string
}

export async function showReminderNotification(payload: ReminderPayload): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false

  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body,
    icon: '/icons.svg',
    badge: '/icons.svg',
    tag: payload.tag,
    renotify: true,
    data: { url: payload.url ?? '/' },
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(payload.title, options)
      return true
    }
  } catch (err) {
    console.warn('SW notification failed, falling back:', err)
  }

  try {
    new Notification(payload.title, options)
    return true
  } catch (err) {
    console.error('Notification failed:', err)
    return false
  }
}

export async function showTestNotification(): Promise<boolean> {
  return showReminderNotification({
    tag: 'healthmetrics-test',
    title: 'Health Metrics',
    body: 'Notifications are working. You’ll get reminders for scheduled doses and check-ins.',
    url: '/',
  })
}
