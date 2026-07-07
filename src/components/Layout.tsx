import { NavLink, Outlet } from 'react-router-dom'
import { useEntries } from '../hooks/useEntries'
import type { SyncStatus } from '../types/entry'

const NAV = [
  { to: '/', label: 'Log', icon: '✏️' },
  { to: '/history', label: 'History', icon: '📅' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

function SyncBadge({ status }: { status: SyncStatus }) {
  const config: Record<SyncStatus, { label: string; className: string }> = {
    synced: { label: 'Synced', className: 'bg-emerald-100 text-emerald-700' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
    offline: { label: 'Offline', className: 'bg-slate-200 text-slate-600' },
    error: { label: 'Sync error', className: 'bg-red-100 text-red-700' },
  }
  const { label, className } = config[status]
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export default function Layout() {
  const { syncStatus } = useEntries()

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b border-primary-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-primary-800">Health Metrics</h1>
            <p className="text-xs text-slate-500">Fatigue · Mood · Nausea · Pain</p>
          </div>
          <SyncBadge status={syncStatus} />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-primary-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl justify-around py-2">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-primary-700'
                    : 'text-slate-500 hover:text-primary-600'
                }`
              }
            >
              <span className="text-lg">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
