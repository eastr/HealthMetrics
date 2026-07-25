import { BUILTIN_METRICS } from '../types/entry'
import { APP_VERSION, SCHEMA_VERSION } from '../version'
import {
  ensureNamedSheet,
  fetchMetrics,
  fetchMedications,
  replaceMetrics,
  replaceMedications,
  readMetaMap,
  writeMetaMap,
  type SheetMeta,
} from './sheetsApi'

export const META_SHEET = 'Meta'
export const META_HEADERS = ['key', 'value']

type Migration = (spreadsheetId: string) => Promise<void>

/**
 * Migrations run in order from (current+1) … SCHEMA_VERSION.
 * Key = target version after the migration completes.
 *
 * When bumping SCHEMA_VERSION in `src/version.ts`, add a matching entry here.
 */
const MIGRATIONS: Record<number, Migration> = {
  /**
   * v1 — Meta tab + full Metrics catalog. Rewrites legacy color-only / shifted
   * Metrics rows and seeds the five defaults when the catalog is empty.
   */
  1: async (spreadsheetId) => {
    const { metrics, legacyFormat } = await fetchMetrics(spreadsheetId)
    if (metrics.length === 0) {
      await replaceMetrics(
        spreadsheetId,
        BUILTIN_METRICS.map((m) => ({ ...m })),
      )
    } else if (legacyFormat) {
      await replaceMetrics(spreadsheetId, metrics)
    }
  },
  /**
   * v2 — Medications catalog gains a `kind` column so vitamins share the same
   * sheet/shape. Existing rows default to medication.
   */
  2: async (spreadsheetId) => {
    const presets = await fetchMedications(spreadsheetId)
    if (presets.length > 0) {
      await replaceMedications(spreadsheetId, presets)
    }
  },
}

/**
 * Ensure the Meta sheet exists, run any pending migrations, and stamp
 * schemaVersion + appVersion. Safe to call on every spreadsheet open.
 */
export async function ensureSchema(spreadsheetId: string): Promise<SheetMeta> {
  await ensureNamedSheet(spreadsheetId, META_SHEET, META_HEADERS)

  const map = await readMetaMap(spreadsheetId)
  let current = Number(map.schemaVersion)
  if (!Number.isFinite(current) || current < 0) current = 0

  if (current > SCHEMA_VERSION) {
    console.warn(
      `Sheet schema v${current} is newer than this app (expects v${SCHEMA_VERSION}). Skipping migrations.`,
    )
    return {
      schemaVersion: current,
      appVersion: map.appVersion || APP_VERSION,
      updatedAt: map.updatedAt || '',
    }
  }

  for (let next = current + 1; next <= SCHEMA_VERSION; next++) {
    const migrate = MIGRATIONS[next]
    if (!migrate) {
      throw new Error(`Missing migration for schema version ${next}`)
    }
    console.info(`Migrating sheet schema ${next - 1} → ${next}`)
    await migrate(spreadsheetId)
    current = next
    await writeMetaMap(spreadsheetId, {
      schemaVersion: String(current),
      appVersion: APP_VERSION,
      updatedAt: new Date().toISOString(),
    })
  }

  // Refresh appVersion stamp when already on latest schema
  const updatedAt = new Date().toISOString()
  await writeMetaMap(spreadsheetId, {
    schemaVersion: String(SCHEMA_VERSION),
    appVersion: APP_VERSION,
    updatedAt,
  })

  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    updatedAt,
  }
}
