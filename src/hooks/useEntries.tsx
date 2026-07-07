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
  getStoredSpreadsheetId,
} from '../services/sheetsApi'
import {
  cacheEntries,
  getCachedEntries,
  putCachedEntry,
  removeCachedEntry,
  queuePendingOp,
  getPendingOps,
  getPendingCount,
  removePendingOp,
  type PendingOp,
} from '../db/localDb'

interface EntriesContextValue {
  entries: HealthEntry[]
  loading: boolean
  syncStatus: SyncStatus
  pendingCount: number
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

async function loadFromLocalCache(): Promise<{
  entries: HealthEntry[]
  pendingCount: number
  syncStatus: SyncStatus
}> {
  const cached = await getCachedEntries()
  const pendingCount = await getPendingCount()
  return {
    entries: cached,
    pendingCount,
    syncStatus: pendingCount > 0 ? 'pending' : 'offline',
  }
}

export function EntriesProvider({ children }: { children: ReactNode }) {
  const { signedIn, spreadsheetId, offlineMode } = useAuth()
  const [entries, setEntries] = useState<HealthEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const applyEntries = useCallback((list: HealthEntry[]) => {
    const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    setEntries(sorted)
  }, [])

  const applyLocalState = useCallback(
    async (status?: SyncStatus) => {
      const local = await loadFromLocalCache()
      applyEntries(local.entries)
      setPendingCount(local.pendingCount)
      setSyncStatus(status ?? local.syncStatus)
    },
    [applyEntries],
  )

  const flushPending = useCallback(async (sheetId: string) => {
    const ops = await getPendingOps()
    if (ops.length === 0) {
      setSyncStatus('synced')
      setPendingCount(0)
      return
    }

    setSyncStatus('pending')
    const rowIndexByEntryId = new Map<string, number>()

    for (const op of ops) {
      try {
        await processPendingOp(sheetId, op, rowIndexByEntryId)
        await removePendingOp(op.id)
        setPendingCount(await getPendingCount())
      } catch (err) {
        console.error('Sync failed for op:', op, err)
        setSyncStatus('error')
        return
      }
    }
    setSyncStatus('synced')
    setPendingCount(0)
  }, [])

  const loadEntries = useCallback(async () => {
    if (!signedIn) return

    setLoading(true)
    setError(null)

    if (!isOnline() || offlineMode) {
      await applyLocalState()
      setLoading(false)
      return
    }

    try {
      const sheetId = spreadsheetId ?? getStoredSpreadsheetId() ?? (await findOrCreateSpreadsheet())
      await flushPending(sheetId)
      const remote = await fetchEntries(sheetId)
      await cacheEntries(remote)
      applyEntries(remote)
      setPendingCount(0)
      setSyncStatus('synced')
    } catch (err) {
      await applyLocalState('offline')
      if (!offlineMode) {
        setError(err instanceof Error ? err.message : 'Failed to load entries')
      }
    } finally {
      setLoading(false)
    }
  }, [signedIn, spreadsheetId, offlineMode, applyEntries, flushPending, applyLocalState])

  useEffect(() => {
    if (signedIn) {
      loadEntries()
    } else {
      setEntries([])
      setPendingCount(0)
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

      if (!isOnline() || offlineMode) {
        await queuePendingOp({ id: uuidv4(), type: 'create', entry })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
        return
      }

      try {
        const sheetId = spreadsheetId ?? getStoredSpreadsheetId() ?? (await findOrCreateSpreadsheet())
        const rowIndex = await appendEntry(sheetId, entry)
        const synced = { ...entry, rowIndex, syncStatus: 'synced' as const }
        await putCachedEntry(synced)
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? synced : e)))
        setSyncStatus('synced')
      } catch {
        await queuePendingOp({ id: uuidv4(), type: 'create', entry })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
      }
    },
    [offlineMode, spreadsheetId],
  )

  const editEntry = useCallback(
    async (entry: HealthEntry) => {
      const pending = { ...entry, syncStatus: 'pending' as const }
      await putCachedEntry(pending)
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? pending : e)))

      if (!isOnline() || offlineMode) {
        await queuePendingOp({ id: uuidv4(), type: 'update', entry: pending })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
        return
      }

      try {
        const sheetId = spreadsheetId ?? getStoredSpreadsheetId() ?? (await findOrCreateSpreadsheet())
        let updated = entry
        if (entry.rowIndex) {
          await updateEntry(sheetId, entry.rowIndex, entry)
        } else {
          const rowIndex = await appendEntry(sheetId, entry)
          updated = { ...entry, rowIndex }
        }
        const synced = { ...updated, syncStatus: 'synced' as const }
        await putCachedEntry(synced)
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? synced : e)))
        setSyncStatus('synced')
      } catch {
        await queuePendingOp({ id: uuidv4(), type: 'update', entry: pending })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
      }
    },
    [offlineMode, spreadsheetId],
  )

  const removeEntry = useCallback(
    async (entry: HealthEntry) => {
      await removeCachedEntry(entry.id)
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))

      if (!isOnline() || offlineMode) {
        await queuePendingOp({
          id: uuidv4(),
          type: 'delete',
          entryId: entry.id,
          rowIndex: entry.rowIndex ?? 0,
        })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
        return
      }

      try {
        const sheetId = spreadsheetId ?? getStoredSpreadsheetId() ?? (await findOrCreateSpreadsheet())
        if (entry.rowIndex) {
          await deleteEntry(sheetId, entry.rowIndex)
        }
        setSyncStatus('synced')
        await loadEntries()
      } catch {
        await queuePendingOp({
          id: uuidv4(),
          type: 'delete',
          entryId: entry.id,
          rowIndex: entry.rowIndex ?? 0,
        })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
      }
    },
    [offlineMode, spreadsheetId, loadEntries],
  )

  return (
    <EntriesContext.Provider
      value={{
        entries,
        loading,
        syncStatus,
        pendingCount,
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

async function processPendingOp(
  sheetId: string,
  op: PendingOp,
  rowIndexByEntryId: Map<string, number>,
): Promise<void> {
  switch (op.type) {
    case 'create': {
      const rowIndex = await appendEntry(sheetId, op.entry)
      rowIndexByEntryId.set(op.entry.id, rowIndex)
      await putCachedEntry({ ...op.entry, rowIndex, syncStatus: 'synced' })
      break
    }
    case 'update': {
      const rowIndex = op.entry.rowIndex ?? rowIndexByEntryId.get(op.entry.id)
      if (rowIndex) {
        await updateEntry(sheetId, rowIndex, op.entry)
        await putCachedEntry({ ...op.entry, rowIndex, syncStatus: 'synced' })
        rowIndexByEntryId.set(op.entry.id, rowIndex)
      } else {
        const newRowIndex = await appendEntry(sheetId, op.entry)
        rowIndexByEntryId.set(op.entry.id, newRowIndex)
        await putCachedEntry({ ...op.entry, rowIndex: newRowIndex, syncStatus: 'synced' })
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
