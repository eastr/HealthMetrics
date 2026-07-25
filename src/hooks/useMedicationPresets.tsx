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
import type { MedicationPreset, ScheduleDays } from '../types/entry'
import { normalizeMedicationPreset } from '../types/entry'
import { useAuth } from './useAuth'
import {
  fetchMedications,
  findOrCreateSpreadsheet,
  getStoredSpreadsheetId,
  replaceMedications,
} from '../services/sheetsApi'

const STORAGE_KEY = 'healthmetrics_medication_presets'
const MIGRATED_KEY = 'healthmetrics_medications_migrated'

export type MedicationInput = {
  name: string
  defaultDose?: string
  times?: string[]
  days?: ScheduleDays
  active?: boolean
  notes?: string
  kind?: 'medication' | 'vitamin'
}

interface MedicationPresetsContextValue {
  presets: MedicationPreset[]
  loading: boolean
  addPreset: (input: MedicationInput) => Promise<void>
  updatePreset: (id: string, input: MedicationInput) => Promise<void>
  removePreset: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const MedicationPresetsContext = createContext<MedicationPresetsContextValue | null>(null)

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function loadLocalPresets(): MedicationPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<MedicationPreset> & { id: string; name: string }>
    if (!Array.isArray(parsed)) return []
    return parsed.map((p) => normalizeMedicationPreset(p))
  } catch {
    return []
  }
}

function saveLocalPresets(presets: MedicationPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function MedicationPresetsProvider({ children }: { children: ReactNode }) {
  const { signedIn, spreadsheetId, offlineMode } = useAuth()
  const [presets, setPresets] = useState<MedicationPreset[]>(() => loadLocalPresets())
  const [loading, setLoading] = useState(false)
  const syncing = useRef(false)

  const persist = useCallback(
    async (next: MedicationPreset[]) => {
      const normalized = next.map((p) => normalizeMedicationPreset(p))
      setPresets(normalized)
      saveLocalPresets(normalized)

      if (!signedIn || !isOnline() || offlineMode) return

      try {
        const sheetId =
          spreadsheetId ?? getStoredSpreadsheetId() ?? (await findOrCreateSpreadsheet())
        const saved = await replaceMedications(sheetId, normalized)
        setPresets(saved)
        saveLocalPresets(saved)
      } catch (err) {
        console.error('Failed to sync medications to Sheets:', err)
      }
    },
    [signedIn, spreadsheetId, offlineMode],
  )

  const refresh = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    try {
      if (!isOnline() || offlineMode) {
        setPresets(loadLocalPresets())
        return
      }

      const sheetId =
        spreadsheetId ?? getStoredSpreadsheetId() ?? (await findOrCreateSpreadsheet())
      let remote = await fetchMedications(sheetId)

      if (remote.length === 0 && !localStorage.getItem(MIGRATED_KEY)) {
        const local = loadLocalPresets()
        if (local.length > 0) {
          remote = await replaceMedications(sheetId, local)
        }
        localStorage.setItem(MIGRATED_KEY, '1')
      }

      setPresets(remote)
      saveLocalPresets(remote)
    } catch (err) {
      console.error('Failed to load medications:', err)
      setPresets(loadLocalPresets())
    } finally {
      setLoading(false)
    }
  }, [signedIn, spreadsheetId, offlineMode])

  useEffect(() => {
    if (!signedIn) return
    if (syncing.current) return
    syncing.current = true
    refresh().finally(() => {
      syncing.current = false
    })
  }, [signedIn, refresh])

  const addPreset = useCallback(
    async (input: MedicationInput) => {
      const name = input.name.trim()
      if (!name) return
      const preset = normalizeMedicationPreset({
        id: uuidv4(),
        name,
        defaultDose: input.defaultDose,
        times: input.times ?? [],
        days: input.days ?? 'daily',
        active: input.active !== false,
        notes: input.notes,
        kind: input.kind ?? 'medication',
      })
      await persist([...presets, preset])
    },
    [presets, persist],
  )

  const updatePreset = useCallback(
    async (id: string, input: MedicationInput) => {
      const name = input.name.trim()
      if (!name) return
      const next = presets.map((p) =>
        p.id === id
          ? normalizeMedicationPreset({
              ...p,
              name,
              defaultDose: input.defaultDose,
              times: input.times ?? p.times,
              days: input.days ?? p.days,
              active: input.active ?? p.active,
              notes: input.notes,
              kind: input.kind ?? p.kind,
            })
          : p,
      )
      await persist(next)
    },
    [presets, persist],
  )

  const removePreset = useCallback(
    async (id: string) => {
      await persist(presets.filter((p) => p.id !== id))
    },
    [presets, persist],
  )

  return (
    <MedicationPresetsContext.Provider
      value={{ presets, loading, addPreset, updatePreset, removePreset, refresh }}
    >
      {children}
    </MedicationPresetsContext.Provider>
  )
}

export function useMedicationPresets() {
  const ctx = useContext(MedicationPresetsContext)
  if (!ctx) throw new Error('useMedicationPresets must be used within MedicationPresetsProvider')
  return ctx
}
