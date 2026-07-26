import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import DataBackupPanel from './DataBackupPanel'

export default function SubscriptionGate() {
  const { signOut } = useAuth()
  const { status, subscribe, checkoutBusy, error, refresh } = useSubscription()
  const amount = status?.amountZar ?? '35.00'

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <section className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
        <h1 className="text-xl font-semibold text-slate-800">Your free trial has ended</h1>
        <p className="mt-2 text-sm text-slate-500">
          Continue using HealthMetrics for{' '}
          <span className="font-semibold text-slate-800">R{amount}/month</span>, billed
          securely via PayFast. Your existing logs stay on this device and in your account.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={checkoutBusy}
          onClick={() => void subscribe()}
          className="mt-5 w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
        >
          {checkoutBusy ? 'Redirecting to PayFast…' : `Subscribe — R${amount}/month`}
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-2 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          I already paid — refresh status
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Sign out
        </button>
      </section>

      <p className="text-center text-xs text-slate-400">
        You can still export a backup of your data below before subscribing.
      </p>
      <DataBackupPanel />
    </div>
  )
}
