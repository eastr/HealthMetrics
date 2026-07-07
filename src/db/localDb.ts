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

export async function removePendingOp(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('pending', id)
}

export async function clearPendingOps(): Promise<void> {
  const db = await getDb()
  await db.clear('pending')
}
