const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SESSION_KEY = 'healthmetrics_session'

interface PersistedSession {
  authenticated: boolean
  accessToken?: string
  expiresAt?: number
}

let accessToken: string | null = null
let tokenExpiry = 0
let tokenClient: GoogleTokenClient | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
let expiryTimer: ReturnType<typeof setTimeout> | null = null

function waitForGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.accounts?.oauth2) {
      resolve()
      return
    }
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        clearInterval(interval)
        resolve()
      } else if (attempts > 50) {
        clearInterval(interval)
        reject(new Error('Google Identity Services failed to load'))
      }
    }, 100)
  })
}

function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSession
  } catch {
    return null
  }
}

function savePersistedSession(token: string, expiresIn: number): void {
  const session: PersistedSession = {
    authenticated: true,
    accessToken: token,
    expiresAt: Date.now() + expiresIn * 1000,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function clearPersistedSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

function restoreTokenFromStorage(): boolean {
  const session = loadPersistedSession()
  if (!session?.accessToken || !session.expiresAt) return false
  if (Date.now() >= session.expiresAt - 60_000) return false
  accessToken = session.accessToken
  tokenExpiry = session.expiresAt
  return true
}

function scheduleExpiryRefresh(): void {
  if (expiryTimer) clearTimeout(expiryTimer)
  const msUntilRefresh = tokenExpiry - Date.now() - 5 * 60_000
  if (msUntilRefresh <= 0) return
  expiryTimer = setTimeout(() => {
    if (navigator.onLine) {
      silentRefresh().catch(() => {})
    }
  }, msUntilRefresh)
}

export function startBackgroundRefresh(): void {
  stopBackgroundRefresh()
  scheduleExpiryRefresh()
  refreshTimer = setInterval(() => {
    if (navigator.onLine && loadPersistedSession()?.authenticated) {
      silentRefresh().catch(() => {})
    }
  }, 30 * 60_000)
}

export function stopBackgroundRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (expiryTimer) {
    clearTimeout(expiryTimer)
    expiryTimer = null
  }
}

function initTokenClient(): GoogleTokenClient {
  if (tokenClient) return tokenClient

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
    error_callback: (error) => {
      console.error('OAuth error:', error)
    },
  })

  return tokenClient
}

function requestToken(prompt: '' | 'consent'): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }
        accessToken = response.access_token
        tokenExpiry = Date.now() + response.expires_in * 1000
        savePersistedSession(accessToken, response.expires_in)
        startBackgroundRefresh()
        resolve(accessToken)
      },
      error_callback: (error) => {
        reject(new Error(error.message ?? error.type))
      },
    })
    client.requestAccessToken({ prompt })
  })
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID !== 'your-client-id.apps.googleusercontent.com')
}

export function hasPersistedSession(): boolean {
  return loadPersistedSession()?.authenticated === true
}

export function getAccessToken(): string | null {
  if (accessToken && Date.now() < tokenExpiry - 60_000) {
    return accessToken
  }
  return null
}

export function isSignedIn(): boolean {
  return getAccessToken() !== null
}

export async function silentRefresh(): Promise<string | null> {
  if (!isConfigured()) return null

  try {
    await waitForGoogle()
    return await requestToken('')
  } catch {
    return null
  }
}

export type SessionMode = 'online' | 'offline' | 'none'

export async function restoreSession(): Promise<SessionMode> {
  const session = loadPersistedSession()
  if (!session?.authenticated) return 'none'

  if (!navigator.onLine) {
    return 'offline'
  }

  if (restoreTokenFromStorage()) {
    startBackgroundRefresh()
    return 'online'
  }

  if (navigator.onLine) {
    const token = await silentRefresh()
    if (token) return 'online'
    return 'none'
  }

  return 'offline'
}

export async function signIn(): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      'Google Client ID not configured. Copy .env.example to .env.local and add your Client ID.',
    )
  }

  await waitForGoogle()
  initTokenClient()

  try {
    return await requestToken('')
  } catch {
    return requestToken('consent')
  }
}

export async function ensureToken(): Promise<string> {
  const existing = getAccessToken()
  if (existing) return existing

  if (restoreTokenFromStorage()) {
    scheduleExpiryRefresh()
    return accessToken!
  }

  if (navigator.onLine) {
    const refreshed = await silentRefresh()
    if (refreshed) return refreshed
  }

  throw new Error('Not authenticated')
}

export function signOut(): void {
  if (accessToken) {
    try {
      google.accounts.oauth2.revoke(accessToken)
    } catch {
      // ignore revoke errors
    }
  }
  accessToken = null
  tokenExpiry = 0
  clearPersistedSession()
  stopBackgroundRefresh()
}
