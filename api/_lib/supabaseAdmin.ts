import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type ProfileStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'exempt'

export interface ProfileRow {
  user_id: string
  email: string | null
  status: ProfileStatus
  trial_started_at: string
  trial_ends_at: string
  payfast_token: string | null
  payfast_payment_id: string | null
  subscription_started_at: string | null
  current_period_end: string | null
  last_payment_at: string | null
  updated_at: string
}

export function getServiceSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for billing')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getUserFromBearer(
  authorization: string | undefined,
): Promise<User | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) return null
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function ensureProfile(
  supabase: SupabaseClient,
  user: User,
  opts?: { exempt?: boolean },
): Promise<ProfileRow> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const row = existing as ProfileRow
    if (opts?.exempt && row.status !== 'exempt') {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ status: 'exempt', email: user.email ?? row.email })
        .eq('user_id', user.id)
        .select('*')
        .single()
      if (error) throw error
      return updated as ProfileRow
    }
    return row
  }

  const now = new Date()
  const trialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const insert = {
    user_id: user.id,
    email: user.email ?? null,
    status: opts?.exempt ? 'exempt' : 'trialing',
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
  }

  const { data, error } = await supabase.from('profiles').insert(insert).select('*').single()
  if (error) throw error
  return data as ProfileRow
}

export function profileHasAccess(profile: ProfileRow, now = new Date()): boolean {
  if (profile.status === 'active' || profile.status === 'exempt') return true
  if (profile.status === 'trialing') {
    return new Date(profile.trial_ends_at).getTime() > now.getTime()
  }
  // past_due: grace until current_period_end if set
  if (profile.status === 'past_due' && profile.current_period_end) {
    return new Date(profile.current_period_end).getTime() > now.getTime()
  }
  return false
}

export function daysRemaining(iso: string, now = new Date()): number {
  const ms = new Date(iso).getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}
