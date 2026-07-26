import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  BUILTIN_METRICS,
  normalizeMetricCatalogItem,
  slugifyMetricKey,
  type MetricCatalogItem,
  type ScaleLabels,
} from '../types/entry'
import { useAuth } from './useAuth'
import {
  fetchMetrics,
  replaceMetrics,
} from '../services/supabaseData'

const STORAGE_KEY = 'healthmetrics_metric_catalog'
const LEGACY_COLORS_KEY = 'healthmetrics_metric_colors'
const DIRTY_KEY = 'healthmetrics_metrics_supabase_dirty'

function loadLocalCatalog(): MetricCatalogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const colorsRaw = localStorage.getItem(LEGACY_COLORS_KEY)
      const colors = colorsRaw
        ? (JSON.parse(colorsRaw) as Partial<Record<string, string>>)
        : {}
      return BUILTIN_METRICS.map((m) =>
        normalizeMetricCatalogItem({ ...m, color: colors[m.key] ?? m.color }),
      )
    }
    const parsed = JSON.parse(raw) as MetricCatalogItem[]
    if (!Array.isArray(parsed) || parsed.length === 0) return BUILTIN_METRICS.map((m) => ({ ...m }))
    return parsed.map((m) => normalizeMetricCatalogItem(m))
  } catch {
    return BUILTIN_METRICS.map((m) => ({ ...m }))
  }
}

function saveLocalCatalog(metrics: MetricCatalogItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics))
}

interface MetricsCatalogContextValue {
  /** Active metrics in sort order (for forms/charts) */
  metrics: MetricCatalogItem[]
  /** All metrics including inactive */
  allMetrics: MetricCatalogItem[]
  setMetricColor: (key: string, color: string) => void
  updateMetric: (id: string, patch: Partial<MetricCatalogItem>) => Promise<void>
  addMetric: (input: {
    label: string
    color?: string
    scaleLabels?: ScaleLabels
  }) => Promise<void>
  removeMetric: (id: string) => Promise<void>
  resetToBuiltins: () => Promise<void>
  getMetricColor: (key: string) => string
  getMetric: (key: string) => MetricCatalogItem | undefined
}

const MetricsCatalogContext = createContext<MetricsCatalogContextValue | null>(null)

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export function MetricColorsProvider({ children }: { children: ReactNode }) {
  const { signedIn, offlineMode } = useAuth()
  const [catalog, setCatalog] = useState<MetricCatalogItem[]>(() => loadLocalCatalog())
  const syncing = useRef(false)

  const activeMetrics = useMemo(
    () => [...catalog].filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog],
  )

  const persist = useCallback(
    async (next: MetricCatalogItem[]) => {
      const normalized = next.map((m) => normalizeMetricCatalogItem(m))
      setCatalog(normalized)
      saveLocalCatalog(normalized)

      if (!signedIn || !isOnline() || offlineMode) {
        localStorage.setItem(DIRTY_KEY, '1')
        return
      }
      try {
        const saved = await replaceMetrics(normalized)
        setCatalog(saved)
        saveLocalCatalog(saved)
        localStorage.removeItem(DIRTY_KEY)
      } catch (err) {
        console.error('Failed to sync metrics catalog to Supabase:', err)
      }
    },
    [signedIn, offlineMode],
  )

  const refreshFromSupabase = useCallback(async () => {
    if (!signedIn || !isOnline() || offlineMode) return
    try {
      let remote: MetricCatalogItem[]
      if (localStorage.getItem(DIRTY_KEY) === '1') {
        remote = await replaceMetrics(loadLocalCatalog())
        localStorage.removeItem(DIRTY_KEY)
      } else {
        remote = await fetchMetrics()
      }
      if (remote.length === 0) {
        remote = await replaceMetrics(loadLocalCatalog())
      }
      if (remote.length > 0) {
        setCatalog(remote)
        saveLocalCatalog(remote)
      }
    } catch (err) {
      console.error('Failed to load metrics catalog from Supabase:', err)
    }
  }, [signedIn, offlineMode])

  useEffect(() => {
    if (!signedIn) return
    if (syncing.current) return
    syncing.current = true
    refreshFromSupabase().finally(() => {
      syncing.current = false
    })
  }, [signedIn, refreshFromSupabase])

  const setMetricColor = useCallback(
    (key: string, color: string) => {
      void persist(catalog.map((m) => (m.key === key ? { ...m, color } : m)))
    },
    [catalog, persist],
  )

  const updateMetric = useCallback(
    async (id: string, patch: Partial<MetricCatalogItem>) => {
      await persist(
        catalog.map((m) =>
          m.id === id
            ? normalizeMetricCatalogItem({ ...m, ...patch, key: patch.key ?? m.key })
            : m,
        ),
      )
    },
    [catalog, persist],
  )

  const addMetric = useCallback(
    async (input: { label: string; color?: string; scaleLabels?: ScaleLabels }) => {
      const label = input.label.trim()
      if (!label) return
      let key = slugifyMetricKey(label)
      const existing = new Set(catalog.map((m) => m.key))
      if (existing.has(key)) {
        key = `${key}_${Date.now().toString(36)}`
      }
      const maxOrder = catalog.reduce((n, m) => Math.max(n, m.sortOrder), 0)
      const item = normalizeMetricCatalogItem({
        id: uuidv4(),
        key,
        label,
        color: input.color ?? '#64748b',
        active: true,
        sortOrder: maxOrder + 1,
        scaleLabels: input.scaleLabels,
      })
      await persist([...catalog, item])
    },
    [catalog, persist],
  )

  const removeMetric = useCallback(
    async (id: string) => {
      const target = catalog.find((m) => m.id === id)
      if (!target) return
      // Every metric (including built-ins) is fully removable. Past entries keep
      // their recorded values; the metric just stops appearing going forward.
      await persist(catalog.filter((m) => m.id !== id))
    },
    [catalog, persist],
  )

  const resetToBuiltins = useCallback(async () => {
    await persist(BUILTIN_METRICS.map((m) => ({ ...m })))
  }, [persist])

  const getMetricColor = useCallback(
    (key: string) => catalog.find((m) => m.key === key)?.color ?? '#64748b',
    [catalog],
  )

  const getMetric = useCallback(
    (key: string) => catalog.find((m) => m.key === key),
    [catalog],
  )

  return (
    <MetricsCatalogContext.Provider
      value={{
        metrics: activeMetrics,
        allMetrics: catalog,
        setMetricColor,
        updateMetric,
        addMetric,
        removeMetric,
        resetToBuiltins,
        getMetricColor,
        getMetric,
      }}
    >
      {children}
    </MetricsCatalogContext.Provider>
  )
}

export function useMetrics() {
  const ctx = useContext(MetricsCatalogContext)
  if (!ctx) throw new Error('useMetrics must be used within MetricColorsProvider')
  return ctx
}

export function useMetricColorsSettings() {
  const {
    metrics,
    allMetrics,
    setMetricColor,
    updateMetric,
    addMetric,
    removeMetric,
    resetToBuiltins,
  } = useMetrics()
  return {
    metrics,
    allMetrics,
    setMetricColor,
    updateMetric,
    addMetric,
    removeMetric,
    resetToBuiltins,
    resetMetricColors: resetToBuiltins,
    hasCustomColors: true,
  }
}
