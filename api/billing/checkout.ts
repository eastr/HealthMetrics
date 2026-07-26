import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BILLING_AMOUNT_ZAR, exemptEmails, isPayFastConfigured } from '../_lib/billingConfig.js'
import { buildSubscriptionCheckout } from '../_lib/payfast.js'
import {
  ensureProfile,
  getServiceSupabase,
  getUserFromBearer,
  profileHasAccess,
} from '../_lib/supabaseAdmin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isPayFastConfigured()) {
    return res.status(503).json({
      error: 'Billing is not configured. Set PayFast and Supabase service env vars.',
    })
  }

  try {
    const user = await getUserFromBearer(req.headers.authorization)
    if (!user) {
      return res.status(401).json({ error: 'Sign in required' })
    }

    const email = (user.email ?? '').toLowerCase()
    const isExempt = exemptEmails().has(email)
    const supabase = getServiceSupabase()
    const profile = await ensureProfile(supabase, user, { exempt: isExempt })

    if (profile.status === 'exempt') {
      return res.status(400).json({ error: 'This account does not need a subscription.' })
    }

    if (profile.status === 'active' && profileHasAccess(profile)) {
      return res.status(400).json({ error: 'You already have an active subscription.' })
    }

    const host = req.headers['x-forwarded-host'] ?? req.headers.host
    const proto = req.headers['x-forwarded-proto'] ?? 'https'
    const origin = host ? `${proto}://${host}` : ''
    if (!origin) {
      return res.status(500).json({ error: 'Could not determine site origin' })
    }

    const paymentId = `hm_${user.id.replace(/-/g, '').slice(0, 12)}_${Date.now().toString(36)}`
    const meta = user.user_metadata as Record<string, unknown> | undefined
    const nameFirst =
      (typeof meta?.full_name === 'string' && meta.full_name.split(' ')[0]) ||
      (typeof meta?.name === 'string' && meta.name.split(' ')[0]) ||
      'Subscriber'

    await supabase
      .from('profiles')
      .update({ payfast_payment_id: paymentId, email: user.email ?? profile.email })
      .eq('user_id', user.id)

    const checkout = buildSubscriptionCheckout({
      merchantId: process.env.PAYFAST_MERCHANT_ID!,
      merchantKey: process.env.PAYFAST_MERCHANT_KEY!,
      passphrase: process.env.PAYFAST_PASSPHRASE!,
      paymentId,
      userId: user.id,
      email: user.email,
      nameFirst,
      returnUrl: `${origin}/settings?billing=success`,
      cancelUrl: `${origin}/settings?billing=cancelled`,
      notifyUrl: `${origin}/api/billing/itn`,
    })

    return res.status(200).json({
      action: checkout.action,
      fields: checkout.fields,
      amount: BILLING_AMOUNT_ZAR,
    })
  } catch (err) {
    console.error('Billing checkout failed:', err)
    return res.status(500).json({ error: 'Failed to start checkout' })
  }
}
