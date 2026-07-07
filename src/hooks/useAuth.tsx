import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  isConfigured,
  signIn as authSignIn,
  signOut as authSignOut,
  restoreSession,
  silentRefresh,
} from '../services/googleAuth'
import {
  findOrCreateSpreadsheet,
  getSpreadsheetUrl,
  getStoredSpreadsheetId,
  clearStoredSpreadsheetId,
} from '../services/sheetsApi'

interface AuthContextValue {
  configured: boolean
  signedIn: boolean
  offlineMode: boolean
  loading: boolean
  spreadsheetId: string | null
  spreadsheetUrl: string | null
  error: string | null
  signIn: () => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function formatAuthError(message: string): string {
  if (/invalid.?client/i.test(message)) {
    return (
      'Invalid OAuth client. In Google Cloud Console, create a Web application OAuth client ' +
      '(not Desktop/Android), copy the Client ID (not the secret) into .env.local, add ' +
      'http://localhost:5173 under Authorized JavaScript origins, then restart npm run dev.'
    )
  }
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const configured = isConfigured()

  const connectSpreadsheet = useCallback(async () => {
    try {
      const id = await findOrCreateSpreadsheet()
      setSpreadsheetId(id)
      return id
    } catch {
      const stored = getStoredSpreadsheetId()
      if (stored) setSpreadsheetId(stored)
      return stored
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      const storedId = getStoredSpreadsheetId()
      if (storedId) setSpreadsheetId(storedId)

      const mode = await restoreSession()
      if (cancelled) return

      if (mode === 'online') {
        setSignedIn(true)
        setOfflineMode(false)
        await connectSpreadsheet()
      } else if (mode === 'offline') {
        setSignedIn(true)
        setOfflineMode(true)
      } else {
        setSignedIn(false)
        setOfflineMode(false)
      }

      setLoading(false)
    }

    init()
    return () => {
      cancelled = true
    }
  }, [connectSpreadsheet])

  useEffect(() => {
    const onOnline = async () => {
      if (!signedIn) return
      const token = await silentRefresh()
      if (token) {
        setOfflineMode(false)
        await connectSpreadsheet()
      }
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [signedIn, connectSpreadsheet])

  const signIn = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await authSignIn()
      const id = await connectSpreadsheet()
      setSpreadsheetId(id)
      setSignedIn(true)
      setOfflineMode(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      setError(formatAuthError(message))
      setSignedIn(false)
      setOfflineMode(false)
    } finally {
      setLoading(false)
    }
  }, [connectSpreadsheet])

  const signOut = useCallback(() => {
    authSignOut()
    clearStoredSpreadsheetId()
    setSignedIn(false)
    setOfflineMode(false)
    setSpreadsheetId(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        configured,
        signedIn,
        offlineMode,
        loading,
        spreadsheetId,
        spreadsheetUrl: spreadsheetId ? getSpreadsheetUrl(spreadsheetId) : null,
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
