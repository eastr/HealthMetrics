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
}

export interface CheckoutResponse {
  action: string
  fields: Record<string, string>
  amount: string
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

export async function fetchBillingStatus(): Promise<BillingStatusResponse> {
  const headers = await authHeader()
  const res = await fetch('/api/billing/status', { headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Failed to load billing status')
  }
  return (await res.json()) as BillingStatusResponse
}

export async function startPayFastCheckout(): Promise<void> {
  const headers = await authHeader()
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers,
  })
  const body = (await res.json().catch(() => null)) as
    | (CheckoutResponse & { error?: string })
    | null
  if (!res.ok || !body?.action || !body.fields) {
    throw new Error(body?.error ?? 'Failed to start PayFast checkout')
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
