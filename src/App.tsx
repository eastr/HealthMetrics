import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { MetricColorsProvider } from './hooks/useMetricColors'
import { MedicationPresetsProvider } from './hooks/useMedicationPresets'
import { EntriesProvider } from './hooks/useEntries'
import Layout from './components/Layout'
import LoginScreen from './components/LoginScreen'
import LogPage from './pages/LogPage'
import HistoryPage from './pages/HistoryPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import ShareViewPage from './pages/ShareViewPage'

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
        <MetricColorsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<LogPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MetricColorsProvider>
      </MedicationPresetsProvider>
    </EntriesProvider>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/share/:token" element={<ShareViewPage />} />
      <Route path="*" element={<PrivateApp />} />
    </Routes>
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
