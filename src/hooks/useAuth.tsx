import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import {
  isConfigured,
  getUserId,
  restoreSession,
  signInWithGoogle,
  signOut as authSignOut,
} from '../services/supabaseAuth'
import { getSupabase } from '../services/supabaseClient'
import { prepareLocalDataForUser } from '../db/localDb'

interface AuthContextValue {
  configured: boolean
  signedIn: boolean
  offlineMode: boolean
  loading: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function formatAuthError(message: string): string {
  if (/provider.*not enabled/i.test(message)) {
    return (
      'Google sign-in is not enabled. In Supabase, open Authentication → Providers → Google ' +
      'and add your Google OAuth client ID and secret.'
    )
  }
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const configured = isConfigured()

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      const mode = await restoreSession()
      if (cancelled) return

      if (mode !== 'none') {
        const userId = await getUserId()
        if (userId) await prepareLocalDataForUser(userId)
      }
      setSignedIn(mode !== 'none')
      setOfflineMode(mode === 'offline')
      setLoading(false)
    }

    void init()

    if (!configured) {
      return () => {
        cancelled = true
      }
    }

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return
      void (async () => {
        if (session) await prepareLocalDataForUser(session.user.id)
        if (cancelled) return
        setSignedIn(Boolean(session))
        setOfflineMode(Boolean(session) && !navigator.onLine)
        setLoading(false)
      })()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [configured])

  useEffect(() => {
    const onOnline = () => {
      if (signedIn) setOfflineMode(false)
    }
    const onOffline = () => {
      if (signedIn) setOfflineMode(true)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [signedIn])

  const signIn = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      setError(formatAuthError(message))
      setSignedIn(false)
      setOfflineMode(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    await authSignOut()
    setSignedIn(false)
    setOfflineMode(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        configured,
        signedIn,
        offlineMode,
        loading,
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
