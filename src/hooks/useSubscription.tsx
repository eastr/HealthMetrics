import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './useAuth'
import {
  CLIENT_BILLING_AMOUNT_ZAR,
  CLIENT_TRIAL_DAYS,
  fetchBillingStatus,
  startPayFastCheckout,
  type BillingStatusResponse,
} from '../services/billing'

interface SubscriptionContextValue {
  loading: boolean
  error: string | null
  status: BillingStatusResponse | null
  /** True when the user may use the full app (trial / paid / exempt / billing off). */
  hasAccess: boolean
  refresh: () => Promise<void>
  subscribe: () => Promise<void>
  checkoutBusy: boolean
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { signedIn, offlineMode } = useAuth()
  const [loading, setLoading] = useState(true)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<BillingStatusResponse | null>(null)

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setStatus(null)
      setLoading(false)
      return
    }

    // Offline: don't lock people out of local data mid-flight
    if (offlineMode || !navigator.onLine) {
      setStatus((prev) =>
        prev ?? {
          configured: false,
          hasAccess: true,
          status: 'trialing',
          amountZar: CLIENT_BILLING_AMOUNT_ZAR,
          trialDays: CLIENT_TRIAL_DAYS,
        },
      )
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const next = await fetchBillingStatus()
      setStatus(next)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Billing check failed')
      // Fail open while online check fails so a billing API blip doesn't brick the app
      setStatus((prev) =>
        prev ?? {
          configured: false,
          hasAccess: true,
          status: 'trialing',
          amountZar: CLIENT_BILLING_AMOUNT_ZAR,
          trialDays: CLIENT_TRIAL_DAYS,
        },
      )
    } finally {
      setLoading(false)
    }
  }, [signedIn, offlineMode])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const subscribe = useCallback(async () => {
    setCheckoutBusy(true)
    setError(null)
    try {
      await startPayFastCheckout()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setCheckoutBusy(false)
    }
  }, [])

  return (
    <SubscriptionContext.Provider
      value={{
        loading,
        error,
        status,
        hasAccess: status?.hasAccess !== false,
        refresh,
        subscribe,
        checkoutBusy,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider')
  return ctx
}
