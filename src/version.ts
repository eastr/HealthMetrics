/** App release version (kept in sync with package.json via Vite define). */
declare const __APP_VERSION__: string

export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

/**
 * Spreadsheet schema version. Bump this when sheet layouts or required data
 * shapes change, and add a migration in `src/services/schemaMigrations.ts`.
 *
 * History:
 * - 0 — pre-versioning (legacy Metrics columns, optional missing tabs)
 * - 1 — Meta tab + full Metrics catalog (id, key, label, color, active,
 *       sortOrder, scaleLabels) + Entries metricsJson column
 * - 2 — Medications sheet `kind` column (medication | vitamin)
 */
export const SCHEMA_VERSION = 2
