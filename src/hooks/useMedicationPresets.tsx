import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { MedicationPreset } from '../types/entry'

const STORAGE_KEY = 'healthmetrics_medication_presets'

interface MedicationPresetsContextValue {
  presets: MedicationPreset[]
  addPreset: (name: string, defaultDose?: string) => void
  updatePreset: (id: string, name: string, defaultDose?: string) => void
  removePreset: (id: string) => void
}

const MedicationPresetsContext = createContext<MedicationPresetsContextValue | null>(null)

function loadPresets(): MedicationPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MedicationPreset[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function savePresets(presets: MedicationPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function MedicationPresetsProvider({ children }: { children: ReactNode }) {
  const [presets, setPresets] = useState<MedicationPreset[]>(() => loadPresets())

  useEffect(() => {
    savePresets(presets)
  }, [presets])

  const addPreset = useCallback((name: string, defaultDose?: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setPresets((prev) => [
      ...prev,
      { id: uuidv4(), name: trimmed, defaultDose: defaultDose?.trim() || undefined },
    ])
  }, [])

  const updatePreset = useCallback((id: string, name: string, defaultDose?: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setPresets((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name: trimmed, defaultDose: defaultDose?.trim() || undefined } : p,
      ),
    )
  }, [])

  const removePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return (
    <MedicationPresetsContext.Provider value={{ presets, addPreset, updatePreset, removePreset }}>
      {children}
    </MedicationPresetsContext.Provider>
  )
}

export function useMedicationPresets() {
  const ctx = useContext(MedicationPresetsContext)
  if (!ctx) throw new Error('useMedicationPresets must be used within MedicationPresetsProvider')
  return ctx
}
