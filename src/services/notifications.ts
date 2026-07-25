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

export type ShowNotificationResult = {
  ok: boolean
  via?: 'page' | 'service-worker'
  error?: string
}

/**
 * Prefer the page Notification constructor when the document is visible —
 * more reliable in desktop Chromium forks (e.g. Vivaldi). Fall back to the
 * service worker for background display. Omit SVG icons — many engines reject them.
 */
export async function showReminderNotification(
  payload: ReminderPayload,
): Promise<ShowNotificationResult> {
  if (notificationPermission() !== 'granted') {
    return { ok: false, error: `Permission is "${notificationPermission()}"` }
  }

  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body,
    tag: payload.tag,
    renotify: true,
    requireInteraction: false,
    data: { url: payload.url ?? '/' },
  }

  const pageVisible =
    typeof document !== 'undefined' && document.visibilityState === 'visible'

  if (pageVisible) {
    try {
      const n = new Notification(payload.title, options)
      // Some engines fire onerror/onshow asynchronously
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        n.addEventListener('show', done, { once: true })
        n.addEventListener('error', done, { once: true })
        window.setTimeout(done, 500)
      })
      return { ok: true, via: 'page' }
    } catch (err) {
      console.warn('Page Notification failed, trying service worker:', err)
    }
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(payload.title, options)
      return { ok: true, via: 'service-worker' }
    }
  } catch (err) {
    console.warn('SW notification failed:', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  try {
    new Notification(payload.title, options)
    return { ok: true, via: 'page' }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function showTestNotification(): Promise<ShowNotificationResult> {
  return showReminderNotification({
    // Unique tag so Vivaldi/Windows don't collapse/suppress a repeat test
    tag: `healthmetrics-test-${Date.now()}`,
    title: 'Health Metrics',
    body: 'Notifications are working. You’ll get reminders for scheduled doses and check-ins.',
    url: '/',
  })
}
