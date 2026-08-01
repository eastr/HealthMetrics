import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'

export default function BillingPanel() {
  const { status, loading, error, subscribe, checkoutBusy, refresh, hasAccess } =
    useSubscription()
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    const billing = params.get('billing')
    if (!billing) return
    void refresh().finally(() => {
      params.delete('billing')
      setParams(params, { replace: true })
    })
  }, [params, setParams, refresh])

  if (loading && !status) {
    return (
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Subscription</h2>
        <p className="text-sm text-slate-500">Checking billing status…</p>
      </section>
    )
  }

  const amount = status?.amountZar ?? '35.00'
  const configured = status?.configured !== false
  const label =
    status?.status === 'active'
      ? 'Active'
      : status?.status === 'exempt'
        ? 'Complimentary'
        : status?.status === 'trialing'
          ? 'Free trial'
          : status?.status === 'past_due'
            ? 'Payment past due'
            : status?.status === 'expired'
              ? 'Trial ended'
              : status?.status ?? 'Unknown'

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 text-lg font-semibold text-slate-800">Subscription</h2>
      {!configured ? (
        <div className="space-y-2 text-sm text-slate-500">
          <p>
            PayFast is not enabled yet (R{amount}/month when live). Everyone currently has
            full access.
          </p>
          {status?.missingEnv && status.missingEnv.length > 0 ? (
            <p>
              Add these to <code className="text-xs">.env.local</code> (and Vercel env), then
              restart <code className="text-xs">npm run dev:full</code>:{' '}
              <code className="text-xs">{status.missingEnv.join(', ')}</code>
            </p>
          ) : (
            <p>
              Billing API did not respond. Keep using{' '}
              <code className="text-xs">npm run dev:full</code> so <code className="text-xs">/api</code>{' '}
              routes are available.
            </p>
          )}
        </div>
      ) : (
        <>
          <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd className="font-medium text-slate-800">{label}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Price</dt>
              <dd className="font-medium text-slate-800">R{amount}/month</dd>
            </div>
            {status?.status === 'trialing' && (
              <div className="col-span-2">
                <dt className="text-slate-400">Trial</dt>
                <dd className="font-medium text-slate-800">
                  {status.trialDaysLeft ?? 0} day
                  {(status.trialDaysLeft ?? 0) === 1 ? '' : 's'} left
                  {status.trialEndsAt
                    ? ` · ends ${status.trialEndsAt.slice(0, 10)}`
                    : ''}
                </dd>
              </div>
            )}
            {status?.lastPaymentAt && (
              <div className="col-span-2">
                <dt className="text-slate-400">Last payment</dt>
                <dd className="font-medium text-slate-800">
                  {status.lastPaymentAt.slice(0, 10)}
                </dd>
              </div>
            )}
          </dl>
          <p className="mb-3 text-sm text-slate-500">
            New accounts get a {status?.trialDays ?? 30}-day free trial. After that,
            HealthMetrics is R{amount}/month via PayFast (South Africa).
          </p>
          {(!hasAccess || status?.status === 'trialing' || status?.status === 'past_due') &&
            status?.status !== 'exempt' &&
            status?.status !== 'active' && (
              <button
                type="button"
                disabled={checkoutBusy}
                onClick={() => void subscribe()}
                className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
              >
                {checkoutBusy ? 'Redirecting…' : `Subscribe — R${amount}/month`}
              </button>
            )}
          {status?.status === 'active' && (
            <p className="text-sm text-emerald-700">You&apos;re subscribed. Thank you!</p>
          )}
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
