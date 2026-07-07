import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { HealthEntry } from '../types/entry'

interface HealthDB extends DBSchema {
  entries: {
    key: string
    value: HealthEntry
    indexes: { 'by-timestamp': string }
  }
  pending: {
    key: string
    value: PendingOp
  }
}

export type PendingOp =
  | { id: string; type: 'create'; entry: HealthEntry }
  | { id: string; type: 'update'; entry: HealthEntry }
  | { id: string; type: 'delete'; entryId: string; rowIndex: number }

let dbPromise: Promise<IDBPDatabase<HealthDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<HealthDB>('healthmetrics', 1, {
      upgrade(db) {
        const entries = db.createObjectStore('entries', { keyPath: 'id' })
        entries.createIndex('by-timestamp', 'timestamp')
        db.createObjectStore('pending', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

function entryIdFromOp(op: PendingOp): string {
  return op.type === 'delete' ? op.entryId : op.entry.id
}

export async function cacheEntries(entries: HealthEntry[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('entries', 'readwrite')
  await Promise.all(entries.map((e) => tx.store.put(e)))
  await tx.done
}

export async function getCachedEntries(): Promise<HealthEntry[]> {
  const db = await getDb()
  return db.getAll('entries')
}

export async function putCachedEntry(entry: HealthEntry): Promise<void> {
  const db = await getDb()
  await db.put('entries', entry)
}

export async function removeCachedEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('entries', id)
}

export async function addPendingOp(op: PendingOp): Promise<void> {
  const db = await getDb()
  await db.put('pending', op)
}

export async function getPendingOps(): Promise<PendingOp[]> {
  const db = await getDb()
  return db.getAll('pending')
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb()
  return db.count('pending')
}

export async function removePendingOp(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('pending', id)
}

export async function removePendingOpsForEntry(entryId: string): Promise<void> {
  const ops = await getPendingOps()
  await Promise.all(
    ops.filter((op) => entryIdFromOp(op) === entryId).map((op) => removePendingOp(op.id)),
  )
}

/** Merge or replace pending ops so offline edits stay consistent across long offline periods */
export async function queuePendingOp(op: PendingOp): Promise<void> {
  const ops = await getPendingOps()
  const entryId = entryIdFromOp(op)

  const existingCreate = ops.find(
    (o): o is Extract<PendingOp, { type: 'create' }> =>
      o.type === 'create' && o.entry.id === entryId,
  )

  if (existingCreate && op.type === 'update') {
    await removePendingOp(existingCreate.id)
    await addPendingOp({ ...existingCreate, entry: op.entry })
    return
  }

  if (op.type === 'delete') {
    await removePendingOpsForEntry(entryId)
    if (existingCreate || !op.rowIndex) return
    await addPendingOp(op)
    return
  }

  for (const existing of ops) {
    if (entryIdFromOp(existing) === entryId) {
      await removePendingOp(existing.id)
    }
  }

  await addPendingOp(op)
}

export async function clearPendingOps(): Promise<void> {
  const db = await getDb()
  await db.clear('pending')
}
