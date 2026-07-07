import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  isConfigured,
  isSignedIn,
  signIn as authSignIn,
  signOut as authSignOut,
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
  const [loading, setLoading] = useState(true)
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const configured = isConfigured()

  useEffect(() => {
    setSignedIn(isSignedIn())
    setSpreadsheetId(getStoredSpreadsheetId())
    setLoading(false)
  }, [])

  const signIn = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await authSignIn()
      const id = await findOrCreateSpreadsheet()
      setSpreadsheetId(id)
      setSignedIn(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      setError(formatAuthError(message))
      setSignedIn(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(() => {
    authSignOut()
    clearStoredSpreadsheetId()
    setSignedIn(false)
    setSpreadsheetId(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        configured,
        signedIn,
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
