import { getSupabase, isSupabaseConfigured } from './supabaseClient'

export { isSupabaseConfigured as isConfigured }

export type SessionMode = 'online' | 'offline' | 'none'

export async function restoreSession(): Promise<SessionMode> {
  if (!isSupabaseConfigured()) return 'none'

  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data.session) return 'none'

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'offline'
  }

  // Soft-check that the session still works online
  try {
    const { error } = await supabase.auth.getUser()
    if (error) {
      // Keep cached session for offline use if we can't refresh
      return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'none'
    }
    return 'online'
  } catch {
    return 'offline'
  }
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase()
  const redirectTo = `${window.location.origin}/`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = getSupabase()
  await supabase.auth.signOut()
}

export async function getUserId(): Promise<string | null> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Returns true if we have a local session (may be offline). */
export async function hasLocalSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}
