import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  BILLING_AMOUNT_ZAR,
  TRIAL_DAYS,
  exemptEmails,
  isPayFastConfigured,
  missingBillingEnv,
} from '../_lib/billingConfig.js'
import {
  daysRemaining,
  ensureProfile,
  getServiceSupabase,
  getUserFromBearer,
  profileHasAccess,
} from '../_lib/supabaseAdmin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Billing disabled → everyone has access (local / pre-PayFast setup)
  if (!isPayFastConfigured()) {
    return res.status(200).json({
      configured: false,
      hasAccess: true,
      status: 'exempt',
      amountZar: BILLING_AMOUNT_ZAR,
      trialDays: TRIAL_DAYS,
      missingEnv: missingBillingEnv(),
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
    const hasAccess = profileHasAccess(profile)
    const now = new Date()
    const trialDaysLeft =
      profile.status === 'trialing' ? daysRemaining(profile.trial_ends_at, now) : 0

    // Flip expired trials so dashboards stay accurate
    if (profile.status === 'trialing' && !hasAccess) {
      await supabase.from('profiles').update({ status: 'expired' }).eq('user_id', user.id)
      profile.status = 'expired'
    }

    return res.status(200).json({
      configured: true,
      hasAccess,
      status: profile.status,
      email: profile.email,
      trialEndsAt: profile.trial_ends_at,
      trialDaysLeft,
      currentPeriodEnd: profile.current_period_end,
      lastPaymentAt: profile.last_payment_at,
      amountZar: BILLING_AMOUNT_ZAR,
      trialDays: TRIAL_DAYS,
    })
  } catch (err) {
    console.error('Billing status failed:', err)
    return res.status(500).json({ error: 'Failed to load billing status' })
  }
}
