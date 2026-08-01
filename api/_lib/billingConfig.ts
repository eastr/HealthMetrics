/** Monthly subscription amount in ZAR (PayFast). */
export const BILLING_AMOUNT_ZAR = '35.00'
export const BILLING_ITEM_NAME = 'HealthMetrics monthly'
export const TRIAL_DAYS = 30

/** PayFast frequency: 3 = Monthly */
export const PAYFAST_FREQUENCY_MONTHLY = 3
/** PayFast subscription_type: 1 = subscription */
export const PAYFAST_SUBSCRIPTION_TYPE = 1
/** 0 = indefinite cycles */
export const PAYFAST_CYCLES_INDEFINITE = 0

export function isPayFastConfigured(): boolean {
  return missingBillingEnv().length === 0
}

/** Env vars required before checkout / paywall activate. */
export function missingBillingEnv(): string[] {
  const missing: string[] = []
  if (!process.env.PAYFAST_MERCHANT_ID) missing.push('PAYFAST_MERCHANT_ID')
  if (!process.env.PAYFAST_MERCHANT_KEY) missing.push('PAYFAST_MERCHANT_KEY')
  if (!process.env.PAYFAST_PASSPHRASE) missing.push('PAYFAST_PASSPHRASE')
  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) {
    missing.push('SUPABASE_URL')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  return missing
}

export function payFastProcessUrl(): string {
  const sandbox = process.env.PAYFAST_SANDBOX === '1' || process.env.PAYFAST_SANDBOX === 'true'
  return sandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process'
}

export function exemptEmails(): Set<string> {
  const raw = process.env.BILLING_EXEMPT_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}
