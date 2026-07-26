import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BILLING_AMOUNT_ZAR, isPayFastConfigured } from '../_lib/billingConfig.js'
import { parsePayFastBody, verifyPayFastSignature } from '../_lib/payfast.js'
import { getServiceSupabase } from '../_lib/supabaseAdmin.js'

/**
 * PayFast Instant Transaction Notification (ITN) webhook.
 * Must respond 200 quickly; this is the source of truth for payments.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  if (!isPayFastConfigured()) {
    return res.status(503).send('Billing not configured')
  }

  try {
    const data = parsePayFastBody(req.body)
    const passphrase = process.env.PAYFAST_PASSPHRASE!
    if (!verifyPayFastSignature(data, passphrase)) {
      console.error('PayFast ITN signature mismatch')
      return res.status(400).send('Invalid signature')
    }

    const merchantId = data.merchant_id
    if (merchantId && merchantId !== process.env.PAYFAST_MERCHANT_ID) {
      return res.status(400).send('Invalid merchant')
    }

    const amount = data.amount_gross ?? data.amount
    if (amount && Number(amount).toFixed(2) !== Number(BILLING_AMOUNT_ZAR).toFixed(2)) {
      console.error('PayFast ITN amount mismatch', amount, BILLING_AMOUNT_ZAR)
      return res.status(400).send('Invalid amount')
    }

    const paymentStatus = (data.payment_status ?? '').toUpperCase()
    const userId = data.custom_str1
    const token = data.token || null
    const pfPaymentId = data.pf_payment_id || null
    const mPaymentId = data.m_payment_id || null

    if (!userId) {
      console.error('PayFast ITN missing custom_str1 (user id)')
      return res.status(400).send('Missing user')
    }

    const supabase = getServiceSupabase()
    const now = new Date()
    const periodEnd = new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000) // ~1 month grace buffer

    if (paymentStatus === 'COMPLETE') {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'active',
          payfast_token: token,
          payfast_payment_id: mPaymentId ?? pfPaymentId,
          subscription_started_at: now.toISOString(),
          last_payment_at: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq('user_id', userId)

      if (error) {
        console.error('Failed to activate subscription:', error)
        return res.status(500).send('DB error')
      }
    } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
      // Keep trial/active until period ends; mark past_due if they were subscribed
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle()

      if (profile?.status === 'active') {
        await supabase
          .from('profiles')
          .update({ status: 'past_due' })
          .eq('user_id', userId)
      }
    }

    return res.status(200).send('OK')
  } catch (err) {
    console.error('PayFast ITN error:', err)
    return res.status(500).send('Error')
  }
}
