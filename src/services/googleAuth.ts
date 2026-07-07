const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

let accessToken: string | null = null
let tokenExpiry = 0
let tokenClient: GoogleTokenClient | null = null

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

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID !== 'your-client-id.apps.googleusercontent.com')
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

export async function signIn(): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      'Google Client ID not configured. Copy .env.example to .env.local and add your Client ID.',
    )
  }

  await waitForGoogle()
  initTokenClient()

  return new Promise((resolve, reject) => {
    const wrappedClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }
        accessToken = response.access_token
        tokenExpiry = Date.now() + response.expires_in * 1000
        resolve(accessToken)
      },
      error_callback: (error) => {
        reject(new Error(error.message ?? error.type))
      },
    })
    wrappedClient.requestAccessToken({ prompt: '' })
  })
}

export async function ensureToken(): Promise<string> {
  const existing = getAccessToken()
  if (existing) return existing
  return signIn()
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
}
