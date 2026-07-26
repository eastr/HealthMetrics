import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { CheckInSchedule, ScheduleDays } from '../types/entry'
import { normalizeCheckInSchedule } from '../types/entry'
import { useAuth } from './useAuth'
import { fetchCheckIns, replaceCheckIns } from '../services/supabaseData'

const STORAGE_KEY = 'healthmetrics_checkins'
const DIRTY_KEY = 'healthmetrics_checkins_supabase_dirty'

export type CheckInInput = {
  label: string
  times?: string[]
  days?: ScheduleDays
  active?: boolean
}

interface CheckInSchedulesContextValue {
  schedules: CheckInSchedule[]
  loading: boolean
  addSchedule: (input: CheckInInput) => Promise<void>
  updateSchedule: (id: string, input: CheckInInput) => Promise<void>
  removeSchedule: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const CheckInSchedulesContext = createContext<CheckInSchedulesContextValue | null>(null)

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function loadLocal(): CheckInSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<CheckInSchedule> & { id: string }>
    if (!Array.isArray(parsed)) return []
    return parsed.map((p) => normalizeCheckInSchedule(p))
  } catch {
    return []
  }
}

function saveLocal(schedules: CheckInSchedule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
}

export function CheckInSchedulesProvider({ children }: { children: ReactNode }) {
  const { signedIn, offlineMode } = useAuth()
  const [schedules, setSchedules] = useState<CheckInSchedule[]>(() => loadLocal())
  const [loading, setLoading] = useState(false)
  const syncing = useRef(false)

  const persist = useCallback(
    async (next: CheckInSchedule[]) => {
      const normalized = next.map((s) => normalizeCheckInSchedule(s))
      setSchedules(normalized)
      saveLocal(normalized)

      if (!signedIn || !isOnline() || offlineMode) {
        localStorage.setItem(DIRTY_KEY, '1')
        return
      }

      try {
        const saved = await replaceCheckIns(normalized)
        setSchedules(saved)
        saveLocal(saved)
        localStorage.removeItem(DIRTY_KEY)
      } catch (err) {
        console.error('Failed to sync check-ins to Supabase:', err)
      }
    },
    [signedIn, offlineMode],
  )

  const refresh = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    try {
      if (!isOnline() || offlineMode) {
        setSchedules(loadLocal())
        return
      }

      let remote: CheckInSchedule[]
      if (localStorage.getItem(DIRTY_KEY) === '1') {
        remote = await replaceCheckIns(loadLocal())
        localStorage.removeItem(DIRTY_KEY)
      } else {
        remote = await fetchCheckIns()
      }
      if (remote.length === 0) {
        const local = loadLocal()
        if (local.length > 0) {
          const saved = await replaceCheckIns(local)
          setSchedules(saved)
          saveLocal(saved)
          return
        }
      }
      setSchedules(remote)
      saveLocal(remote)
    } catch (err) {
      console.error('Failed to load check-ins from Supabase:', err)
      setSchedules(loadLocal())
    } finally {
      setLoading(false)
    }
  }, [signedIn, offlineMode])

  useEffect(() => {
    if (!signedIn) return
    if (syncing.current) return
    syncing.current = true
    refresh().finally(() => {
      syncing.current = false
    })
  }, [signedIn, refresh])

  const addSchedule = useCallback(
    async (input: CheckInInput) => {
      const schedule = normalizeCheckInSchedule({
        id: uuidv4(),
        label: input.label,
        times: input.times ?? [],
        days: input.days ?? 'daily',
        active: input.active !== false,
      })
      await persist([...schedules, schedule])
    },
    [schedules, persist],
  )

  const updateSchedule = useCallback(
    async (id: string, input: CheckInInput) => {
      const next = schedules.map((s) =>
        s.id === id
          ? normalizeCheckInSchedule({
              ...s,
              label: input.label,
              times: input.times ?? s.times,
              days: input.days ?? s.days,
              active: input.active ?? s.active,
            })
          : s,
      )
      await persist(next)
    },
    [schedules, persist],
  )

  const removeSchedule = useCallback(
    async (id: string) => {
      await persist(schedules.filter((s) => s.id !== id))
    },
    [schedules, persist],
  )

  return (
    <CheckInSchedulesContext.Provider
      value={{ schedules, loading, addSchedule, updateSchedule, removeSchedule, refresh }}
    >
      {children}
    </CheckInSchedulesContext.Provider>
  )
}

export function useCheckInSchedules() {
  const ctx = useContext(CheckInSchedulesContext)
  if (!ctx) throw new Error('useCheckInSchedules must be used within CheckInSchedulesProvider')
  return ctx
}
