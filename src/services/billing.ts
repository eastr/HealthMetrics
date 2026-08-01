import { getSupabase } from './supabaseClient'

export const CLIENT_BILLING_AMOUNT_ZAR = '35.00'
export const CLIENT_TRIAL_DAYS = 30

export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'exempt'

export interface BillingStatusResponse {
  configured: boolean
  hasAccess: boolean
  status: BillingStatus
  email?: string | null
  trialEndsAt?: string
  trialDaysLeft?: number
  currentPeriodEnd?: string | null
  lastPaymentAt?: string | null
  amountZar: string
  trialDays: number
  /** Present when configured=false because server env is incomplete. */
  missingEnv?: string[]
}

export interface CheckoutResponse {
  action: string
  fields: Record<string, string>
  amount: string
}

/** Returned when /api/billing/* isn't available (e.g. vite preview without vercel dev). */
export function unconfiguredBillingStatus(): BillingStatusResponse {
  return {
    configured: false,
    hasAccess: true,
    status: 'exempt',
    amountZar: CLIENT_BILLING_AMOUNT_ZAR,
    trialDays: CLIENT_TRIAL_DAYS,
  }
}

async function authHeader(): Promise<HeadersInit> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function readJson<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (!text) return null
  // Vite preview / SPA fallback returns index.html for missing API routes
  if (
    contentType.includes('text/html') ||
    text.trimStart().startsWith('<!DOCTYPE') ||
    text.trimStart().startsWith('<!doctype') ||
    text.trimStart().startsWith('<html')
  ) {
    return null
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function fetchBillingStatus(): Promise<BillingStatusResponse> {
  const headers = await authHeader()
  let res: Response
  try {
    res = await fetch('/api/billing/status', { headers })
  } catch {
    return unconfiguredBillingStatus()
  }

  const body = await readJson<BillingStatusResponse & { error?: string }>(res)
  if (!body) {
    // Local `vite preview` has no Vercel functions — treat as billing off
    return unconfiguredBillingStatus()
  }
  if (!res.ok) {
    throw new Error(body.error ?? 'Failed to load billing status')
  }
  return body
}

export async function startPayFastCheckout(): Promise<void> {
  const headers = await authHeader()
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers,
  })
  const body = await readJson<CheckoutResponse & { error?: string }>(res)
  if (!body) {
    throw new Error(
      'Billing API is not available. Use `npm run dev:full` (vercel dev) or deploy to Vercel.',
    )
  }
  if (!res.ok || !body.action || !body.fields) {
    throw new Error(body.error ?? 'Failed to start PayFast checkout')
  }

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = body.action
  form.style.display = 'none'

  for (const [name, value] of Object.entries(body.fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}
