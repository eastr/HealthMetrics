import { useAuth } from '../hooks/useAuth'
import { useEntries } from '../hooks/useEntries'
import { useMetricColorsSettings } from '../hooks/useMetricColors'

export default function SettingsPage() {
  const { spreadsheetUrl, signOut, offlineMode } = useAuth()
  const { syncStatus, pendingCount, refresh, error } = useEntries()
  const { metrics, setMetricColor, resetMetricColors, hasCustomColors } =
    useMetricColorsSettings()

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Google Sheet</h2>
        <p className="mb-3 text-sm text-slate-500">
          Your entries are stored in a spreadsheet named <strong>HealthMetrics</strong> in
          your Google Drive.
        </p>
        {spreadsheetUrl && (
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100"
          >
            Open in Google Sheets ↗
          </a>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Metric colors</h2>
          {hasCustomColors && (
            <button
              type="button"
              onClick={resetMetricColors}
              className="text-xs font-medium text-primary-600 hover:text-primary-800"
            >
              Reset to defaults
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Choose a color for each metric. Used in charts, logs, and entry lists.
        </p>
        <ul className="space-y-3">
          {metrics.map((m) => (
            <li key={m.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">{m.label}</span>
              <div className="flex items-center gap-2">
                <span
                  className="h-8 w-8 rounded-lg ring-1 ring-slate-200"
                  style={{ backgroundColor: m.color }}
                  aria-hidden
                />
                <input
                  type="color"
                  value={m.color}
                  onChange={(e) => setMetricColor(m.key, e.target.value)}
                  aria-label={`Color for ${m.label}`}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Sync</h2>
        <p className="text-sm text-slate-500">
          Status: <span className="font-medium capitalize text-slate-700">{syncStatus}</span>
          {pendingCount > 0 && ` · ${pendingCount} entr${pendingCount === 1 ? 'y' : 'ies'} waiting to sync`}
          {offlineMode && ' · offline mode — data saved on this device'}
        </p>
        {offlineMode && (
          <p className="mt-2 text-sm text-slate-500">
            You can keep logging without internet. Everything will upload to Google Sheets when
            you&apos;re back online.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Travel / no internet</h2>
        <p className="text-sm text-slate-500">
          Before a trip: open the app while online and let it load your data once. Install the
          PWA to your home screen. While away, log as usual — entries stay on your phone and
          sync automatically when you have internet again. Don&apos;t sign out until you&apos;re
          back online.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={() => refresh()}
          className="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Refresh data
        </button>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Install app</h2>
        <p className="text-sm text-slate-500">
          On Android, open this site in Chrome and tap <strong>Add to Home screen</strong>{' '}
          from the menu. On desktop, use your browser&apos;s install option if available.
        </p>
      </section>

      <button
        onClick={signOut}
        className="w-full rounded-xl border border-red-200 bg-white py-3 font-medium text-red-600 hover:bg-red-50"
      >
        Sign out
      </button>
    </div>
  )
}
