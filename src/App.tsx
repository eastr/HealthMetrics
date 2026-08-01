import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { MetricColorsProvider } from './hooks/useMetricColors'
import { MedicationPresetsProvider } from './hooks/useMedicationPresets'
import { CheckInSchedulesProvider } from './hooks/useCheckInSchedules'
import { EntriesProvider } from './hooks/useEntries'
import { SubscriptionProvider, useSubscription } from './hooks/useSubscription'
import { useReminders } from './hooks/useReminders'
import Layout from './components/Layout'
import LoginScreen from './components/LoginScreen'
import SubscriptionGate from './components/SubscriptionGate'
import LogPage from './pages/LogPage'

const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ShareViewPage = lazy(() => import('./pages/ShareViewPage'))

function PageFallback() {
  return <p className="py-8 text-center text-slate-400">Loading…</p>
}

function RemindersHost() {
  useReminders()
  return null
}

function PaidApp() {
  const { loading, hasAccess } = useSubscription()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-400">
        Checking subscription…
      </div>
    )
  }

  if (!hasAccess) {
    return <SubscriptionGate />
  }

  return (
    <>
      <RemindersHost />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LogPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

function PrivateApp() {
  const { signedIn, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  if (!signedIn) {
    return <LoginScreen />
  }

  return (
    <EntriesProvider>
      <MedicationPresetsProvider>
        <CheckInSchedulesProvider>
          <MetricColorsProvider>
            <SubscriptionProvider>
              <PaidApp />
            </SubscriptionProvider>
          </MetricColorsProvider>
        </CheckInSchedulesProvider>
      </MedicationPresetsProvider>
    </EntriesProvider>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/share/:token" element={<ShareViewPage />} />
        <Route path="*" element={<PrivateApp />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
