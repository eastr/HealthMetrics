import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  buildMetrics,
  DEFAULT_METRIC_COLORS,
  type MetricConfig,
  type MetricKey,
} from '../types/entry'

const STORAGE_KEY = 'healthmetrics_metric_colors'

function loadCustomColors(): Partial<Record<MetricKey, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<Record<MetricKey, string>>
  } catch {
    return {}
  }
}

function saveCustomColors(colors: Partial<Record<MetricKey, string>>): void {
  if (Object.keys(colors).length === 0) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
}

interface MetricColorsContextValue {
  metrics: MetricConfig[]
  setMetricColor: (key: MetricKey, color: string) => void
  resetMetricColors: () => void
  getMetricColor: (key: MetricKey) => string
}

const MetricColorsContext = createContext<MetricColorsContextValue | null>(null)

export function MetricColorsProvider({ children }: { children: ReactNode }) {
  const [customColors, setCustomColors] = useState(loadCustomColors)

  const metrics = useMemo(() => buildMetrics(customColors), [customColors])

  const setMetricColor = useCallback((key: MetricKey, color: string) => {
    setCustomColors((prev) => {
      const next = { ...prev }
      if (color === DEFAULT_METRIC_COLORS[key]) {
        delete next[key]
      } else {
        next[key] = color
      }
      saveCustomColors(next)
      return next
    })
  }, [])

  const resetMetricColors = useCallback(() => {
    setCustomColors({})
    saveCustomColors({})
  }, [])

  const getMetricColor = useCallback(
    (key: MetricKey) => customColors[key] ?? DEFAULT_METRIC_COLORS[key],
    [customColors],
  )

  return (
    <MetricColorsContext.Provider
      value={{ metrics, setMetricColor, resetMetricColors, getMetricColor }}
    >
      {children}
    </MetricColorsContext.Provider>
  )
}

export function useMetrics() {
  const ctx = useContext(MetricColorsContext)
  if (!ctx) throw new Error('useMetrics must be used within MetricColorsProvider')
  return ctx
}

export function useMetricColorsSettings() {
  const { metrics, setMetricColor, resetMetricColors } = useMetrics()
  const hasCustomColors = metrics.some((m) => m.color !== DEFAULT_METRIC_COLORS[m.key])
  return { metrics, setMetricColor, resetMetricColors, hasCustomColors, defaults: DEFAULT_METRIC_COLORS }
}
