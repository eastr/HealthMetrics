import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { HealthEntry, SyncStatus } from '../types/entry'
import { useAuth } from './useAuth'
import {
  fetchEntries,
  appendEntry,
  updateEntry,
  deleteEntry,
  findOrCreateSpreadsheet,
} from '../services/sheetsApi'
import {
  cacheEntries,
  getCachedEntries,
  putCachedEntry,
  removeCachedEntry,
  addPendingOp,
  getPendingOps,
  removePendingOp,
  type PendingOp,
} from '../db/localDb'

interface EntriesContextValue {
  entries: HealthEntry[]
  loading: boolean
  syncStatus: SyncStatus
  error: string | null
  refresh: () => Promise<void>
  addEntry: (data: Omit<HealthEntry, 'id' | 'timestamp' | 'syncStatus'> & { timestamp?: string }) => Promise<void>
  editEntry: (entry: HealthEntry) => Promise<void>
  removeEntry: (entry: HealthEntry) => Promise<void>
}

const EntriesContext = createContext<EntriesContextValue | null>(null)

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export function EntriesProvider({ children }: { children: ReactNode }) {
  const { signedIn, spreadsheetId } = useAuth()
  const [entries, setEntries] = useState<HealthEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [error, setError] = useState<string | null>(null)

  const applyEntries = useCallback((list: HealthEntry[]) => {
    const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    setEntries(sorted)
  }, [])

  const flushPending = useCallback(async (sheetId: string) => {
    const ops = await getPendingOps()
    if (ops.length === 0) {
      setSyncStatus('synced')
      return
    }

    setSyncStatus('pending')
    for (const op of ops) {
      try {
        await processPendingOp(sheetId, op)
        await removePendingOp(op.id)
      } catch (err) {
        console.error('Sync failed for op:', op, err)
        setSyncStatus('error')
        return
      }
    }
    setSyncStatus('synced')
  }, [])

  const loadEntries = useCallback(async () => {
    if (!signedIn) return

    setLoading(true)
    setError(null)

    try {
      let sheetId = spreadsheetId
      if (!sheetId) {
        sheetId = await findOrCreateSpreadsheet()
      }

      if (isOnline()) {
        await flushPending(sheetId)
        const remote = await fetchEntries(sheetId)
        await cacheEntries(remote)
        applyEntries(remote)
        setSyncStatus('synced')
      } else {
        const cached = await getCachedEntries()
        applyEntries(cached)
        const pending = await getPendingOps()
        setSyncStatus(pending.length > 0 ? 'pending' : 'offline')
      }
    } catch (err) {
      const cached = await getCachedEntries()
      if (cached.length > 0) {
        applyEntries(cached)
        setSyncStatus('offline')
      }
      setError(err instanceof Error ? err.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [signedIn, spreadsheetId, applyEntries, flushPending])

  useEffect(() => {
    if (signedIn) {
      loadEntries()
    } else {
      setEntries([])
    }
  }, [signedIn, loadEntries])

  useEffect(() => {
    const onOnline = () => {
      if (signedIn) loadEntries()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [signedIn, loadEntries])

  const addEntry = useCallback(
    async (
      data: Omit<HealthEntry, 'id' | 'timestamp' | 'syncStatus'> & { timestamp?: string },
    ) => {
      const entry: HealthEntry = {
        id: uuidv4(),
        timestamp: data.timestamp ?? new Date().toISOString(),
        fatigue: data.fatigue,
        mood: data.mood,
        nausea: data.nausea,
        pain: data.pain,
        stiffness: data.stiffness,
        dizziness: data.dizziness,
        notes: data.notes ?? '',
        syncStatus: 'pending',
      }

      await putCachedEntry(entry)
      setEntries((prev) => [entry, ...prev])

      if (!isOnline() || !signedIn) {
        await addPendingOp({ id: uuidv4(), type: 'create', entry })
        setSyncStatus('pending')
        return
      }

      try {
        const sheetId = spreadsheetId ?? (await findOrCreateSpreadsheet())
        const rowIndex = await appendEntry(sheetId, entry)
        const synced = { ...entry, rowIndex, syncStatus: 'synced' as const }
        await putCachedEntry(synced)
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? synced : e)))
        setSyncStatus('synced')
      } catch {
        await addPendingOp({ id: uuidv4(), type: 'create', entry })
        setSyncStatus('pending')
      }
    },
    [signedIn, spreadsheetId],
  )

  const editEntry = useCallback(
    async (entry: HealthEntry) => {
      await putCachedEntry({ ...entry, syncStatus: 'pending' })
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...entry, syncStatus: 'pending' } : e)))

      if (!isOnline() || !signedIn) {
        await addPendingOp({ id: uuidv4(), type: 'update', entry })
        setSyncStatus('pending')
        return
      }

      try {
        const sheetId = spreadsheetId ?? (await findOrCreateSpreadsheet())
        if (entry.rowIndex) {
          await updateEntry(sheetId, entry.rowIndex, entry)
        } else {
          const rowIndex = await appendEntry(sheetId, entry)
          entry = { ...entry, rowIndex }
        }
        const synced = { ...entry, syncStatus: 'synced' as const }
        await putCachedEntry(synced)
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? synced : e)))
        setSyncStatus('synced')
      } catch {
        await addPendingOp({ id: uuidv4(), type: 'update', entry })
        setSyncStatus('pending')
      }
    },
    [signedIn, spreadsheetId],
  )

  const removeEntry = useCallback(
    async (entry: HealthEntry) => {
      await removeCachedEntry(entry.id)
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))

      if (!isOnline() || !signedIn) {
        if (entry.rowIndex) {
          await addPendingOp({
            id: uuidv4(),
            type: 'delete',
            entryId: entry.id,
            rowIndex: entry.rowIndex,
          })
        }
        setSyncStatus('pending')
        return
      }

      try {
        const sheetId = spreadsheetId ?? (await findOrCreateSpreadsheet())
        if (entry.rowIndex) {
          await deleteEntry(sheetId, entry.rowIndex)
        }
        setSyncStatus('synced')
        await loadEntries()
      } catch {
        if (entry.rowIndex) {
          await addPendingOp({
            id: uuidv4(),
            type: 'delete',
            entryId: entry.id,
            rowIndex: entry.rowIndex,
          })
        }
        setSyncStatus('pending')
      }
    },
    [signedIn, spreadsheetId, loadEntries],
  )

  return (
    <EntriesContext.Provider
      value={{
        entries,
        loading,
        syncStatus,
        error,
        refresh: loadEntries,
        addEntry,
        editEntry,
        removeEntry,
      }}
    >
      {children}
    </EntriesContext.Provider>
  )
}

async function processPendingOp(sheetId: string, op: PendingOp): Promise<void> {
  switch (op.type) {
    case 'create': {
      const rowIndex = await appendEntry(sheetId, op.entry)
      await putCachedEntry({ ...op.entry, rowIndex, syncStatus: 'synced' })
      break
    }
    case 'update': {
      if (op.entry.rowIndex) {
        await updateEntry(sheetId, op.entry.rowIndex, op.entry)
      } else {
        const rowIndex = await appendEntry(sheetId, op.entry)
        await putCachedEntry({ ...op.entry, rowIndex, syncStatus: 'synced' })
      }
      break
    }
    case 'delete': {
      await deleteEntry(sheetId, op.rowIndex)
      break
    }
  }
}

export function useEntries() {
  const ctx = useContext(EntriesContext)
  if (!ctx) throw new Error('useEntries must be used within EntriesProvider')
  return ctx
}
