import type {
  CheckInSchedule,
  HealthEntry,
  MedicationPreset,
  MetricCatalogItem,
  SymptomEntry,
} from '../types/entry'
import {
  BUILTIN_METRICS,
  LEGACY_METRIC_KEYS,
  isDoseEntry,
  normalizeCheckInSchedule,
  normalizeMedicationPreset,
  normalizeMetricCatalogItem,
  normalizeEntry,
  normalizeScaleLabels,
  normalizeDoseKind,
} from '../types/entry'
import type { Weekday } from '../types/entry'
import { ensureToken } from './googleAuth'

const SPREADSHEET_TITLE = 'HealthMetrics'
const SHEET_NAME = 'Entries'
const MEDICATIONS_SHEET = 'Medications'
const METRICS_SHEET = 'Metrics'
const CHECKINS_SHEET = 'CheckIns'
const META_SHEET = 'Meta'
const STORAGE_KEY = 'healthmetrics_spreadsheet_id'
const SHEET_RANGE = 'A:M'

const HEADERS = [
  'id',
  'timestamp',
  'type',
  'fatigue',
  'mood',
  'nausea',
  'pain',
  'stiffness',
  'dizziness',
  'medication',
  'dose',
  'notes',
  'metricsJson',
]

const HEADERS_LEGACY_12 = HEADERS.slice(0, 12)

const LEGACY_HEADERS_9 = [
  'id',
  'timestamp',
  'fatigue',
  'mood',
  'nausea',
  'pain',
  'stiffness',
  'dizziness',
  'notes',
]

const MEDICATION_HEADERS = [
  'id',
  'name',
  'defaultDose',
  'times',
  'days',
  'active',
  'notes',
  'kind',
]
const METRIC_HEADERS = ['id', 'key', 'label', 'color', 'active', 'sortOrder', 'scaleLabels']
const CHECKIN_HEADERS = ['id', 'label', 'times', 'days', 'active']
const META_HEADERS = ['key', 'value']

export interface SheetMeta {
  schemaVersion: number
  appVersion: string
  updatedAt: string
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await ensureToken()
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google API error: ${response.status} ${text}`)
  }
  return response
}

export function getStoredSpreadsheetId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setStoredSpreadsheetId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id)
}

export function clearStoredSpreadsheetId(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
}

async function searchSpreadsheet(): Promise<string | null> {
  const query = encodeURIComponent(
    `name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
  )
  const response = await apiFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`,
  )
  const data = (await response.json()) as { files: { id: string }[] }
  return data.files[0]?.id ?? null
}

async function listSheetTitles(spreadsheetId: string): Promise<{ sheetId: number; title: string }[]> {
  const meta = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
  )
  const metaData = (await meta.json()) as {
    sheets: { properties: { sheetId: number; title: string } }[]
  }
  return metaData.sheets.map((s) => s.properties)
}

function columnLetter(n: number): string {
  let result = ''
  let num = n
  while (num > 0) {
    const rem = (num - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    num = Math.floor((num - 1) / 26)
  }
  return result
}

export async function ensureNamedSheet(
  spreadsheetId: string,
  title: string,
  headers: string[],
): Promise<void> {
  const sheets = await listSheetTitles(spreadsheetId)
  if (!sheets.some((s) => s.title === title)) {
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title } } }],
        }),
      },
    )
  }

  const headerRange = encodeURIComponent(`${title}!A1:${columnLetter(headers.length)}1`)
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}`,
  )
  const data = (await response.json()) as { values?: string[][] }
  const current = data.values?.[0] ?? []
  if (current.join('|') === headers.join('|')) return

  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [headers] }),
    },
  )
}

async function ensureSheetHeaders(spreadsheetId: string): Promise<void> {
  const range = encodeURIComponent(`${SHEET_NAME}!A1:M1`)
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  )
  const data = (await response.json()) as { values?: string[][] }
  const current = data.values?.[0] ?? []
  if (current.join('|') === HEADERS.join('|')) return

  // Upgrade known legacy header rows to full schema
  const joined = current.join('|')
  const shouldUpgrade =
    current.length === 0 ||
    joined === LEGACY_HEADERS_9.join('|') ||
    joined === HEADERS_LEGACY_12.join('|') ||
    (current[0] === 'id' && (current[2] === 'fatigue' || current[2] === 'type'))

  if (shouldUpgrade) {
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [HEADERS] }),
      },
    )
  }
}

export async function ensureConfigSheets(spreadsheetId: string): Promise<void> {
  await ensureNamedSheet(spreadsheetId, MEDICATIONS_SHEET, MEDICATION_HEADERS)
  await ensureNamedSheet(spreadsheetId, METRICS_SHEET, METRIC_HEADERS)
  await ensureNamedSheet(spreadsheetId, CHECKINS_SHEET, CHECKIN_HEADERS)
  await ensureNamedSheet(spreadsheetId, META_SHEET, META_HEADERS)
}

export async function readMetaMap(spreadsheetId: string): Promise<Record<string, string>> {
  const range = encodeURIComponent(`${META_SHEET}!A2:B`)
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  )
  const data = (await response.json()) as { values?: string[][] }
  const map: Record<string, string> = {}
  for (const row of data.values ?? []) {
    const key = (row[0] ?? '').trim()
    if (!key || key === 'key') continue
    map[key] = row[1] ?? ''
  }
  return map
}

export async function writeMetaMap(
  spreadsheetId: string,
  map: Record<string, string>,
): Promise<void> {
  await ensureNamedSheet(spreadsheetId, META_SHEET, META_HEADERS)
  const clearRange = encodeURIComponent(`${META_SHEET}!A2:B`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  const values = Object.entries(map).map(([key, value]) => [key, value])
  if (values.length === 0) return
  const writeRange = encodeURIComponent(`${META_SHEET}!A2:B`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    },
  )
}

export async function fetchSheetMeta(spreadsheetId: string): Promise<SheetMeta> {
  await ensureNamedSheet(spreadsheetId, META_SHEET, META_HEADERS)
  const map = await readMetaMap(spreadsheetId)
  return {
    schemaVersion: Number(map.schemaVersion) || 0,
    appVersion: map.appVersion || '',
    updatedAt: map.updatedAt || '',
  }
}

async function createSpreadsheet(): Promise<string> {
  const response = await apiFetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE },
      sheets: [
        { properties: { title: SHEET_NAME } },
        { properties: { title: MEDICATIONS_SHEET } },
        { properties: { title: METRICS_SHEET } },
        { properties: { title: CHECKINS_SHEET } },
        { properties: { title: META_SHEET } },
      ],
    }),
  })
  const data = (await response.json()) as { spreadsheetId: string }
  const spreadsheetId = data.spreadsheetId

  await ensureSheetHeaders(spreadsheetId)
  await ensureConfigSheets(spreadsheetId)
  const { ensureSchema } = await import('./schemaMigrations')
  await ensureSchema(spreadsheetId)
  setStoredSpreadsheetId(spreadsheetId)
  return spreadsheetId
}

export async function findOrCreateSpreadsheet(): Promise<string> {
  const { ensureSchema } = await import('./schemaMigrations')

  const stored = getStoredSpreadsheetId()
  if (stored) {
    try {
      await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${stored}?fields=spreadsheetId`)
      await ensureSheetHeaders(stored)
      await ensureConfigSheets(stored)
      await ensureSchema(stored)
      return stored
    } catch {
      clearStoredSpreadsheetId()
    }
  }

  const existing = await searchSpreadsheet()
  if (existing) {
    setStoredSpreadsheetId(existing)
    await ensureSheetHeaders(existing)
    await ensureConfigSheets(existing)
    await ensureSchema(existing)
    return existing
  }

  return createSpreadsheet()
}

function parseValuesFromRow(row: string[]): Record<string, number> {
  const values: Record<string, number> = {}
  const jsonRaw = row[12]
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as Record<string, unknown>
      for (const [k, v] of Object.entries(parsed)) {
        values[k] = Number(v) || 1
      }
    } catch {
      /* ignore */
    }
  }
  // Legacy columns always fill builtins if missing
  LEGACY_METRIC_KEYS.forEach((key, i) => {
    if (values[key] == null) {
      values[key] = Number(row[3 + i]) || 1
    }
  })
  return values
}

function parseLegacySymptomRow(row: string[], rowIndex: number): SymptomEntry | null {
  if (!row[0] || row[0] === 'id') return null
  const legacy7 = row.length <= 7
  const values: Record<string, number> = {
    fatigue: Number(row[2]) || 1,
    mood: Number(row[3]) || 1,
    nausea: Number(row[4]) || 1,
    pain: Number(row[5]) || 1,
    stiffness: legacy7 ? 1 : Number(row[6]) || 1,
    dizziness: legacy7 ? 1 : Number(row[7]) || 1,
  }
  return {
    type: 'symptoms',
    id: row[0],
    timestamp: row[1] ?? '',
    values,
    notes: legacy7 ? (row[6] ?? '') : (row[8] ?? ''),
    rowIndex,
    syncStatus: 'synced',
  }
}

function rowToEntry(row: string[], rowIndex: number): HealthEntry | null {
  if (!row[0] || row[0] === 'id') return null

  const entryType = row[2]
  if (entryType !== 'symptoms' && entryType !== 'medication' && entryType !== 'vitamin') {
    return parseLegacySymptomRow(row, rowIndex)
  }

  if (entryType === 'medication' || entryType === 'vitamin') {
    return {
      type: entryType,
      id: row[0],
      timestamp: row[1] ?? '',
      medication: row[9] ?? '',
      dose: row[10] ?? '',
      notes: row[11] ?? '',
      rowIndex,
      syncStatus: 'synced',
    }
  }

  return normalizeEntry({
    type: 'symptoms',
    id: row[0],
    timestamp: row[1] ?? '',
    values: parseValuesFromRow(row),
    notes: row[11] ?? '',
    rowIndex,
    syncStatus: 'synced',
  }) as SymptomEntry
}

export function entryToRow(entry: HealthEntry): string[] {
  if (isDoseEntry(entry)) {
    return [
      entry.id,
      entry.timestamp,
      entry.type,
      '',
      '',
      '',
      '',
      '',
      '',
      entry.medication,
      entry.dose,
      entry.notes,
      '',
    ]
  }

  const values = entry.values ?? {}
  return [
    entry.id,
    entry.timestamp,
    'symptoms',
    String(values.fatigue ?? 1),
    String(values.mood ?? 1),
    String(values.nausea ?? 1),
    String(values.pain ?? 1),
    String(values.stiffness ?? 1),
    String(values.dizziness ?? 1),
    '',
    '',
    entry.notes,
    JSON.stringify(values),
  ]
}

function coalesceRowIndexes(rowIndexes: number[]): { start: number; end: number }[] {
  if (rowIndexes.length === 0) return []
  const sorted = [...rowIndexes].sort((a, b) => a - b)
  const ranges: { start: number; end: number }[] = []
  let start = sorted[0]
  let end = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    const row = sorted[i]
    if (row === end + 1) {
      end = row
    } else {
      ranges.push({ start, end })
      start = row
      end = row
    }
  }
  ranges.push({ start, end })
  return ranges
}

async function fetchEntryRowsByRanges(
  spreadsheetId: string,
  ranges: { start: number; end: number }[],
): Promise<HealthEntry[]> {
  const entries: HealthEntry[] = []
  const CHUNK = 80

  for (let i = 0; i < ranges.length; i += CHUNK) {
    const chunk = ranges.slice(i, i + CHUNK)
    const params = chunk
      .map((r) => `ranges=${encodeURIComponent(`${SHEET_NAME}!A${r.start}:M${r.end}`)}`)
      .join('&')
    const response = await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`,
    )
    const data = (await response.json()) as {
      valueRanges?: { range?: string; values?: string[][] }[]
    }

    for (let ri = 0; ri < chunk.length; ri++) {
      const meta = chunk[ri]
      const values = data.valueRanges?.[ri]?.values ?? []
      for (let j = 0; j < values.length; j++) {
        const entry = rowToEntry(values[j], meta.start + j)
        if (entry) entries.push(entry)
      }
    }
  }

  return entries
}

/**
 * Sync entries from Sheets.
 * By default only pulls rows with timestamp on/after `sinceIso` (true partial sync):
 * 1) download timestamp column only, 2) fetch full rows for matching indexes.
 * Pass `full: true` to download the entire Entries sheet (migrations / recovery).
 */
export async function fetchEntries(
  spreadsheetId: string,
  options?: { sinceIso?: string; full?: boolean },
): Promise<HealthEntry[]> {
  if (options?.full) {
    const range = encodeURIComponent(`${SHEET_NAME}!A2:M`)
    const response = await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    )
    const data = (await response.json()) as { values?: string[][] }
    const rows = data.values ?? []
    return rows
      .map((row, i) => rowToEntry(row, i + 2))
      .filter((e): e is HealthEntry => e !== null)
  }

  const sinceIso = options?.sinceIso
  if (!sinceIso) {
    throw new Error('fetchEntries requires sinceIso unless full: true')
  }

  const tsRange = encodeURIComponent(`${SHEET_NAME}!B2:B`)
  const tsResponse = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tsRange}`,
  )
  const tsData = (await tsResponse.json()) as { values?: string[][] }
  const timestamps = tsData.values ?? []

  const matchingRows: number[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const ts = (timestamps[i]?.[0] ?? '').trim()
    if (ts && ts >= sinceIso) matchingRows.push(i + 2)
  }

  if (matchingRows.length === 0) return []

  const sorted = [...matchingRows].sort((a, b) => a - b)
  const minRow = sorted[0]
  const maxRow = sorted[sorted.length - 1]
  const span = maxRow - minRow + 1
  const density = sorted.length / span

  // Typical daily logging: recent rows sit in one dense block — one range fetch.
  // Sparse / heavily backfilled sheets fall back to coalesced batchGet.
  if (density >= 0.2 || span <= 400 || sorted.length <= 150) {
    const range = encodeURIComponent(`${SHEET_NAME}!A${minRow}:M${maxRow}`)
    const response = await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    )
    const data = (await response.json()) as { values?: string[][] }
    const rows = data.values ?? []
    return rows
      .map((row, i) => rowToEntry(row, minRow + i))
      .filter((e): e is HealthEntry => e !== null && e.timestamp >= sinceIso)
  }

  return (await fetchEntryRowsByRanges(spreadsheetId, coalesceRowIndexes(sorted))).filter(
    (e) => e.timestamp >= sinceIso,
  )
}

export async function appendEntry(
  spreadsheetId: string,
  entry: HealthEntry,
): Promise<number> {
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!${SHEET_RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [entryToRow(entry)] }),
    },
  )
  const data = (await response.json()) as {
    updates?: { updatedRange?: string }
  }
  const range = data.updates?.updatedRange ?? ''
  const match = range.match(/!A(\d+):/)
  return match ? Number(match[1]) : 0
}

export async function updateEntry(
  spreadsheetId: string,
  rowIndex: number,
  entry: HealthEntry,
): Promise<void> {
  const range = encodeURIComponent(`${SHEET_NAME}!A${rowIndex}:M${rowIndex}`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [entryToRow(entry)] }),
    },
  )
}

export async function deleteEntry(spreadsheetId: string, rowIndex: number): Promise<void> {
  const sheets = await listSheetTitles(spreadsheetId)
  const sheet = sheets.find((s) => s.title === SHEET_NAME)
  if (!sheet) throw new Error('Entries sheet not found')

  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      }),
    },
  )
}

function daysToCell(days: MedicationPreset['days']): string {
  if (days === 'daily') return 'daily'
  return days.join(',')
}

function cellToDays(value: string): MedicationPreset['days'] {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed === 'daily') return 'daily'
  const nums = trimmed
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n): n is Weekday => n >= 0 && n <= 6)
  return nums.length > 0 ? nums : 'daily'
}

function medicationToRow(preset: MedicationPreset): string[] {
  return [
    preset.id,
    preset.name,
    preset.defaultDose ?? '',
    preset.times.join(','),
    daysToCell(preset.days),
    preset.active ? 'true' : 'false',
    preset.notes ?? '',
    preset.kind,
  ]
}

function rowToMedication(row: string[], rowIndex: number): MedicationPreset | null {
  if (!row[0] || row[0] === 'id') return null
  return normalizeMedicationPreset({
    id: row[0],
    name: row[1] ?? '',
    defaultDose: row[2] || undefined,
    times: (row[3] ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    days: cellToDays(row[4] ?? 'daily'),
    active: (row[5] ?? 'true').toLowerCase() !== 'false',
    notes: row[6] || undefined,
    kind: normalizeDoseKind(row[7]),
    rowIndex,
  })
}

export async function fetchMedications(spreadsheetId: string): Promise<MedicationPreset[]> {
  await ensureConfigSheets(spreadsheetId)
  const range = encodeURIComponent(`${MEDICATIONS_SHEET}!A2:H`)
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  )
  const data = (await response.json()) as { values?: string[][] }
  const rows = data.values ?? []
  return rows
    .map((row, i) => rowToMedication(row, i + 2))
    .filter((e): e is MedicationPreset => e !== null && !!e.name)
}

export async function replaceMedications(
  spreadsheetId: string,
  presets: MedicationPreset[],
): Promise<MedicationPreset[]> {
  await ensureConfigSheets(spreadsheetId)
  const clearRange = encodeURIComponent(`${MEDICATIONS_SHEET}!A2:H`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
    { method: 'POST', body: JSON.stringify({}) },
  )

  if (presets.length === 0) return []

  const values = presets.map(medicationToRow)
  const writeRange = encodeURIComponent(`${MEDICATIONS_SHEET}!A2:H`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    },
  )

  return presets.map((p, i) => ({ ...p, rowIndex: i + 2 }))
}

/**
 * Old schema had the color (a `#hex` value) in column index 2:
 *   key | label | color | active | sortOrder
 * New schema shifts everything right by one for the `id` column and appends
 * `scaleLabels`, so the color lives in column index 3:
 *   id | key | label | color | active | sortOrder | scaleLabels
 * A row is legacy when a hex sits in col 2 but not in col 3.
 */
function isLegacyMetricRow(row: string[]): boolean {
  const colTwo = (row[2] ?? '').trim()
  const colThree = (row[3] ?? '').trim()
  return colTwo.startsWith('#') && !colThree.startsWith('#')
}

function rowToMetric(row: string[], rowIndex: number): MetricCatalogItem | null {
  if (!row[0] || row[0] === 'id' || row[0] === 'key') return null

  if (isLegacyMetricRow(row)) {
    // key, label, color, active, sortOrder — scaleLabels omitted so
    // normalizeMetricCatalogItem restores the built-in texts for known keys.
    return normalizeMetricCatalogItem({
      id: row[0],
      key: row[0],
      label: row[1] || row[0],
      color: row[2] || '#64748b',
      active: (row[3] ?? 'true').toLowerCase() !== 'false',
      sortOrder: Number(row[4]) || 99,
      rowIndex,
    })
  }

  // New schema: id, key, label, color, active, sortOrder, scaleLabels
  let scaleRaw: unknown
  if (row[6]) {
    try {
      scaleRaw = JSON.parse(row[6])
    } catch {
      scaleRaw = undefined
    }
  }
  return normalizeMetricCatalogItem({
    id: row[0],
    key: row[1] || row[0],
    label: row[2] || row[1] || row[0],
    color: row[3] || '#64748b',
    active: (row[4] ?? 'true').toLowerCase() !== 'false',
    sortOrder: Number(row[5]) || 99,
    scaleLabels: scaleRaw !== undefined ? normalizeScaleLabels(scaleRaw) : undefined,
    rowIndex,
  })
}

export function defaultMetricRows(): MetricCatalogItem[] {
  return BUILTIN_METRICS.map((m) => ({ ...m }))
}

export interface FetchMetricsResult {
  metrics: MetricCatalogItem[]
  /** True when any row used the old column layout, so the caller should rewrite the sheet. */
  legacyFormat: boolean
}

export async function fetchMetrics(spreadsheetId: string): Promise<FetchMetricsResult> {
  await ensureConfigSheets(spreadsheetId)
  const range = encodeURIComponent(`${METRICS_SHEET}!A2:G`)
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  )
  const data = (await response.json()) as { values?: string[][] }
  const rows = data.values ?? []
  const legacyFormat = rows.some(
    (row) => row[0] && row[0] !== 'id' && row[0] !== 'key' && isLegacyMetricRow(row),
  )
  const metrics = rows
    .map((row, i) => rowToMetric(row, i + 2))
    .filter((e): e is MetricCatalogItem => e !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return { metrics, legacyFormat }
}

export async function replaceMetrics(
  spreadsheetId: string,
  metrics: MetricCatalogItem[],
): Promise<MetricCatalogItem[]> {
  await ensureConfigSheets(spreadsheetId)
  // Clear wide enough for both old and new schemas
  const clearRange = encodeURIComponent(`${METRICS_SHEET}!A2:G`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
    { method: 'POST', body: JSON.stringify({}) },
  )

  const ordered = [...metrics]
    .map((m) => normalizeMetricCatalogItem(m))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const values = ordered.map((m) => [
    m.id,
    m.key,
    m.label,
    m.color,
    m.active ? 'true' : 'false',
    String(m.sortOrder),
    JSON.stringify(m.scaleLabels),
  ])

  if (values.length > 0) {
    const writeRange = encodeURIComponent(`${METRICS_SHEET}!A2:G`)
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
      {
        method: 'PUT',
        body: JSON.stringify({ values }),
      },
    )
  }

  return ordered.map((m, i) => ({ ...m, rowIndex: i + 2 }))
}

function checkInToRow(schedule: CheckInSchedule): string[] {
  return [
    schedule.id,
    schedule.label,
    schedule.times.join(','),
    daysToCell(schedule.days),
    schedule.active ? 'true' : 'false',
  ]
}

function rowToCheckIn(row: string[], rowIndex: number): CheckInSchedule | null {
  if (!row[0] || row[0] === 'id') return null
  return normalizeCheckInSchedule({
    id: row[0],
    label: row[1] || 'Check-in',
    times: (row[2] ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    days: cellToDays(row[3] ?? 'daily'),
    active: (row[4] ?? 'true').toLowerCase() !== 'false',
    rowIndex,
  })
}

export async function fetchCheckIns(spreadsheetId: string): Promise<CheckInSchedule[]> {
  await ensureConfigSheets(spreadsheetId)
  const range = encodeURIComponent(`${CHECKINS_SHEET}!A2:E`)
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  )
  const data = (await response.json()) as { values?: string[][] }
  const rows = data.values ?? []
  return rows
    .map((row, i) => rowToCheckIn(row, i + 2))
    .filter((e): e is CheckInSchedule => e !== null)
}

export async function replaceCheckIns(
  spreadsheetId: string,
  schedules: CheckInSchedule[],
): Promise<CheckInSchedule[]> {
  await ensureConfigSheets(spreadsheetId)
  const clearRange = encodeURIComponent(`${CHECKINS_SHEET}!A2:E`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
    { method: 'POST', body: JSON.stringify({}) },
  )

  if (schedules.length === 0) return []

  const values = schedules.map(checkInToRow)
  const writeRange = encodeURIComponent(`${CHECKINS_SHEET}!A2:E`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    },
  )

  return schedules.map((s, i) => ({ ...s, rowIndex: i + 2 }))
}
