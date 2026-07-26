import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { DoseEntry, DoseKind, HealthEntry, SymptomEntry, SyncStatus } from '../types/entry'
import { normalizeEntry } from '../types/entry'
import { useAuth } from './useAuth'
import { deleteEntry, fetchEntryChanges, upsertEntry } from '../services/supabaseData'
import { getUserId } from '../services/supabaseAuth'
import {
  getCachedEntries,
  putCachedEntry,
  removeCachedEntry,
  queuePendingOp,
  getPendingOps,
  getPendingCount,
  removePendingOp,
  replaceCachedEntries,
  type PendingOp,
} from '../db/localDb'

type SymptomInput = Omit<SymptomEntry, 'id' | 'timestamp' | 'syncStatus' | 'type'> & {
  timestamp?: string
}

type DoseInput = Omit<DoseEntry, 'id' | 'timestamp' | 'syncStatus' | 'type'> & {
  timestamp?: string
  type?: DoseKind
}

interface EntriesContextValue {
  entries: HealthEntry[]
  loading: boolean
  syncStatus: SyncStatus
  pendingCount: number
  error: string | null
  refresh: () => Promise<void>
  addSymptomEntry: (data: SymptomInput) => Promise<void>
  addMedication: (data: DoseInput) => Promise<void>
  addVitamin: (data: DoseInput) => Promise<void>
  editEntry: (entry: HealthEntry) => Promise<void>
  removeEntry: (entry: HealthEntry) => Promise<void>
}

const EntriesContext = createContext<EntriesContextValue | null>(null)

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

async function syncRemoteEntries(): Promise<HealthEntry[]> {
  const userId = await getUserId()
  if (!userId) throw new Error('No signed-in Supabase user')
  const cursorKey = `healthmetrics_supabase_entries_cursor_${userId}`
  const since = localStorage.getItem(cursorKey)
  let changes = await fetchEntryChanges(since)

  const cached = await getCachedEntries()
  const migrationKey = `healthmetrics_supabase_entries_migrated_${userId}`
  if (localStorage.getItem(migrationKey) !== '1') {
    const knownRemoteIds = new Set(changes.knownIds)
    const localOnly = cached.filter((entry) => !knownRemoteIds.has(entry.id))
    if (localOnly.length > 0) {
      await Promise.all(localOnly.map((entry) => upsertEntry(entry)))
      changes = await fetchEntryChanges(null)
    }
    localStorage.setItem(migrationKey, '1')
  }

  const merged = new Map(cached.map((entry) => [entry.id, normalizeEntry(entry)]))
  for (const id of changes.deletedIds) merged.delete(id)
  for (const entry of changes.entries) merged.set(entry.id, entry)

  const result = [...merged.values()]
  await replaceCachedEntries(result)
  if (changes.cursor) localStorage.setItem(cursorKey, changes.cursor)
  return result
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

async function persistEntry(entry: HealthEntry, offlineMode: boolean) {
  await putCachedEntry(entry)

  if (!isOnline() || offlineMode) {
    await queuePendingOp({ id: uuidv4(), type: 'create', entry })
    return { synced: false as const }
  }

  try {
    const synced = await upsertEntry(entry)
    await putCachedEntry(synced)
    return { synced: true as const, entry: synced }
  } catch {
    await queuePendingOp({ id: uuidv4(), type: 'create', entry })
    return { synced: false as const }
  }
}

export function EntriesProvider({ children }: { children: ReactNode }) {
  const { signedIn, offlineMode } = useAuth()
  const [entries, setEntries] = useState<HealthEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const applyEntries = useCallback((list: HealthEntry[]) => {
    const sorted = list
      .map(normalizeEntry)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
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

  const flushPending = useCallback(async () => {
    const ops = await getPendingOps()
    if (ops.length === 0) {
      setSyncStatus('synced')
      setPendingCount(0)
      return
    }

    setSyncStatus('pending')
    for (const op of ops) {
      try {
        await processPendingOp(op)
        await removePendingOp(op.id)
        setPendingCount(await getPendingCount())
      } catch (err) {
        console.error('Sync failed for op:', op, err)
        setSyncStatus('error')
        throw err
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
      await flushPending()
      const remote = await syncRemoteEntries()
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
  }, [signedIn, offlineMode, applyEntries, flushPending, applyLocalState])

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

  const addSymptomEntry = useCallback(
    async (data: SymptomInput) => {
      const entry: SymptomEntry = {
        type: 'symptoms',
        id: uuidv4(),
        timestamp: data.timestamp ?? new Date().toISOString(),
        values: { ...(data.values ?? {}) },
        notes: data.notes ?? '',
        syncStatus: 'pending',
      }

      setEntries((prev) => [entry, ...prev])
      const result = await persistEntry(entry, offlineMode)
      if (result.synced) {
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? result.entry : e)))
        setSyncStatus('synced')
      } else {
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
      }
    },
    [offlineMode],
  )

  const addDoseEntry = useCallback(
    async (data: DoseInput, kind: DoseKind) => {
      const entry: DoseEntry = {
        type: kind,
        id: uuidv4(),
        timestamp: data.timestamp ?? new Date().toISOString(),
        medication: data.medication.trim(),
        dose: data.dose?.trim() ?? '',
        notes: data.notes ?? '',
        syncStatus: 'pending',
      }

      setEntries((prev) => [entry, ...prev])
      const result = await persistEntry(entry, offlineMode)
      if (result.synced) {
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? result.entry : e)))
        setSyncStatus('synced')
      } else {
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
      }
    },
    [offlineMode],
  )

  const addMedication = useCallback(
    async (data: DoseInput) => addDoseEntry(data, 'medication'),
    [addDoseEntry],
  )

  const addVitamin = useCallback(
    async (data: DoseInput) => addDoseEntry(data, 'vitamin'),
    [addDoseEntry],
  )

  const editEntry = useCallback(
    async (entry: HealthEntry) => {
      const pending = { ...normalizeEntry(entry), syncStatus: 'pending' as const }
      await putCachedEntry(pending)
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? pending : e)))

      if (!isOnline() || offlineMode) {
        await queuePendingOp({ id: uuidv4(), type: 'update', entry: pending })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
        return
      }

      try {
        const synced = await upsertEntry(pending)
        await putCachedEntry(synced)
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? synced : e)))
        setSyncStatus('synced')
      } catch {
        await queuePendingOp({ id: uuidv4(), type: 'update', entry: pending })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
      }
    },
    [offlineMode],
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
        })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
        return
      }

      try {
        await deleteEntry(entry.id)
        setSyncStatus('synced')
        await loadEntries()
      } catch {
        await queuePendingOp({
          id: uuidv4(),
          type: 'delete',
          entryId: entry.id,
        })
        setPendingCount(await getPendingCount())
        setSyncStatus('pending')
      }
    },
    [offlineMode, loadEntries],
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
        addSymptomEntry,
        addMedication,
        addVitamin,
        editEntry,
        removeEntry,
      }}
    >
      {children}
    </EntriesContext.Provider>
  )
}

async function processPendingOp(
  op: PendingOp,
): Promise<void> {
  switch (op.type) {
    case 'create': {
      const entry = normalizeEntry(op.entry)
      await putCachedEntry(await upsertEntry(entry))
      break
    }
    case 'update': {
      const entry = normalizeEntry(op.entry)
      await putCachedEntry(await upsertEntry(entry))
      break
    }
    case 'delete': {
      await deleteEntry(op.entryId)
      break
    }
  }
}

export function useEntries() {
  const ctx = useContext(EntriesContext)
  if (!ctx) throw new Error('useEntries must be used within EntriesProvider')
  return ctx
}
