import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { MetricColorsProvider } from '../hooks/useMetricColors'
import { MedicationPresetsProvider } from '../hooks/useMedicationPresets'
import ShareAnalyticsPanel from '../components/share/ShareAnalyticsPanel'
import { fetchShareRecord } from '../services/shareApi'
import { sharedEntriesToHealth } from '../utils/shareSnapshot'
import type { ShareRecordPublic } from '../types/share'

export default function ShareViewPage() {
  const { token } = useParams<{ token: string }>()
  const [record, setRecord] = useState<ShareRecordPublic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setError('Invalid share link')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchShareRecord(token)
      .then((data) => {
        if (!cancelled) {
          setRecord(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRecord(null)
          setError(err instanceof Error ? err.message : 'Failed to load share link')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const entries = useMemo(
    () => (record ? sharedEntriesToHealth(record.entries) : []),
    [record],
  )

  return (
    <MetricColorsProvider>
      <MedicationPresetsProvider>
        <div className="mx-auto min-h-dvh max-w-3xl bg-slate-50">
          <header className="border-b border-primary-100 bg-white px-4 py-4">
            <h1 className="text-lg font-bold text-primary-800">Shared health summary</h1>
            {record?.label && (
              <p className="mt-1 text-sm font-medium text-slate-700">{record.label}</p>
            )}
            {record && (
              <p className="mt-1 text-xs text-slate-500">
                Data from {format(parseISO(record.dateFrom), 'd MMM yyyy')} to{' '}
                {format(parseISO(record.dateTo), 'd MMM yyyy')}
                {' · '}
                Expires {format(parseISO(record.expiresAt), 'd MMM yyyy')}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Read-only snapshot. Choose a section and date range below.
            </p>
          </header>

          <main className="px-4 py-4">
            {loading && (
              <p className="py-12 text-center text-slate-400">Loading shared data…</p>
            )}
            {!loading && error && (
              <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
                <p className="font-medium text-slate-800">Unable to load this link</p>
                <p className="mt-2 text-sm text-slate-500">{error}</p>
              </div>
            )}
            {!loading && record && (
              <ShareAnalyticsPanel record={record} entries={entries} />
            )}
          </main>
        </div>
      </MedicationPresetsProvider>
    </MetricColorsProvider>
  )
}
