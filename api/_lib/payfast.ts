import { createHash } from 'node:crypto'
import {
  BILLING_AMOUNT_ZAR,
  BILLING_ITEM_NAME,
  PAYFAST_CYCLES_INDEFINITE,
  PAYFAST_FREQUENCY_MONTHLY,
  PAYFAST_SUBSCRIPTION_TYPE,
  payFastProcessUrl,
} from './billingConfig.js'

/**
 * PayFast signature: concatenate name=urlencode(value)&… then append &passphrase=…, MD5.
 * Values use uppercase hex escapes for non-alphanumerics (PayFast quirk).
 */
export function encodePayFastValue(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%[0-9a-f]{2}/gi, (match) =>
    match.toUpperCase(),
  )
}

export function generatePayFastSignature(
  data: Record<string, string>,
  passphrase: string,
): string {
  const pairs: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (key === 'signature') continue
    if (value === '' || value == null) continue
    pairs.push(`${key}=${encodePayFastValue(String(value))}`)
  }
  let paramString = pairs.join('&')
  if (passphrase) {
    paramString += `&passphrase=${encodePayFastValue(passphrase)}`
  }
  return createHash('md5').update(paramString).digest('hex')
}

export function verifyPayFastSignature(
  data: Record<string, string>,
  passphrase: string,
): boolean {
  const received = (data.signature ?? '').toLowerCase()
  if (!received) return false
  const expected = generatePayFastSignature(data, passphrase).toLowerCase()
  return received === expected
}

export type PayFastCheckoutFields = Record<string, string>

export function buildSubscriptionCheckout(input: {
  merchantId: string
  merchantKey: string
  passphrase: string
  paymentId: string
  userId: string
  email?: string | null
  nameFirst?: string | null
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
}): { action: string; fields: PayFastCheckoutFields } {
  const fields: PayFastCheckoutFields = {
    merchant_id: input.merchantId,
    merchant_key: input.merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    name_first: (input.nameFirst ?? 'HealthMetrics').slice(0, 100),
    email_address: (input.email ?? '').slice(0, 100),
    m_payment_id: input.paymentId,
    amount: BILLING_AMOUNT_ZAR,
    item_name: BILLING_ITEM_NAME,
    custom_str1: input.userId,
    subscription_type: String(PAYFAST_SUBSCRIPTION_TYPE),
    billing_date: new Date().toISOString().slice(0, 10),
    recurring_amount: BILLING_AMOUNT_ZAR,
    frequency: String(PAYFAST_FREQUENCY_MONTHLY),
    cycles: String(PAYFAST_CYCLES_INDEFINITE),
  }

  // Drop empty optional fields before signing
  for (const key of Object.keys(fields)) {
    if (!fields[key]) delete fields[key]
  }

  fields.signature = generatePayFastSignature(fields, input.passphrase)

  return {
    action: payFastProcessUrl(),
    fields,
  }
}

/** Parse application/x-www-form-urlencoded or JSON body into string map. */
export function parsePayFastBody(body: unknown): Record<string, string> {
  if (!body) return {}
  if (typeof body === 'string') {
    const out: Record<string, string> = {}
    for (const part of body.split('&')) {
      const [k, ...rest] = part.split('=')
      if (!k) continue
      out[decodeURIComponent(k)] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '))
    }
    return out
  }
  if (typeof body === 'object') {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v == null) continue
      out[k] = String(v)
    }
    return out
  }
  return {}
}
