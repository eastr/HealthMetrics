import type { HealthEntry } from '../types/entry'
import { ensureToken } from './googleAuth'

const SPREADSHEET_TITLE = 'HealthMetrics'
const SHEET_NAME = 'Entries'
const STORAGE_KEY = 'healthmetrics_spreadsheet_id'
const SHEET_RANGE = 'A:I'

const HEADERS = [
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

async function ensureSheetHeaders(spreadsheetId: string): Promise<void> {
  const range = encodeURIComponent(`${SHEET_NAME}!A1:I1`)
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  )
  const data = (await response.json()) as { values?: string[][] }
  const current = data.values?.[0] ?? []
  if (current.join('|') === HEADERS.join('|')) return

  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [HEADERS] }),
    },
  )
}

async function createSpreadsheet(): Promise<string> {
  const response = await apiFetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE },
      sheets: [{ properties: { title: SHEET_NAME } }],
    }),
  })
  const data = (await response.json()) as { spreadsheetId: string }
  const spreadsheetId = data.spreadsheetId

  await ensureSheetHeaders(spreadsheetId)
  setStoredSpreadsheetId(spreadsheetId)
  return spreadsheetId
}

export async function findOrCreateSpreadsheet(): Promise<string> {
  const stored = getStoredSpreadsheetId()
  if (stored) {
    try {
      await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${stored}?fields=spreadsheetId`)
      await ensureSheetHeaders(stored)
      return stored
    } catch {
      clearStoredSpreadsheetId()
    }
  }

  const existing = await searchSpreadsheet()
  if (existing) {
    setStoredSpreadsheetId(existing)
    await ensureSheetHeaders(existing)
    return existing
  }

  return createSpreadsheet()
}

function rowToEntry(row: string[], rowIndex: number): HealthEntry | null {
  if (!row[0] || row[0] === 'id') return null

  const legacy = row.length <= 7

  return {
    id: row[0],
    timestamp: row[1] ?? '',
    fatigue: Number(row[2]) || 1,
    mood: Number(row[3]) || 1,
    nausea: Number(row[4]) || 1,
    pain: Number(row[5]) || 1,
    stiffness: legacy ? 1 : Number(row[6]) || 1,
    dizziness: legacy ? 1 : Number(row[7]) || 1,
    notes: legacy ? (row[6] ?? '') : (row[8] ?? ''),
    rowIndex,
    syncStatus: 'synced',
  }
}

export function entryToRow(entry: HealthEntry): string[] {
  return [
    entry.id,
    entry.timestamp,
    String(entry.fatigue),
    String(entry.mood),
    String(entry.nausea),
    String(entry.pain),
    String(entry.stiffness),
    String(entry.dizziness),
    entry.notes,
  ]
}

export async function fetchEntries(spreadsheetId: string): Promise<HealthEntry[]> {
  const range = encodeURIComponent(`${SHEET_NAME}!A2:${SHEET_RANGE.split(':')[1]}`)
  const response = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  )
  const data = (await response.json()) as { values?: string[][] }
  const rows = data.values ?? []
  return rows
    .map((row, i) => rowToEntry(row, i + 2))
    .filter((e): e is HealthEntry => e !== null)
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
  const range = encodeURIComponent(`${SHEET_NAME}!A${rowIndex}:I${rowIndex}`)
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [entryToRow(entry)] }),
    },
  )
}

export async function deleteEntry(spreadsheetId: string, rowIndex: number): Promise<void> {
  const meta = await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
  )
  const metaData = (await meta.json()) as {
    sheets: { properties: { sheetId: number; title: string } }[]
  }
  const sheet = metaData.sheets.find((s) => s.properties.title === SHEET_NAME)
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
                sheetId: sheet.properties.sheetId,
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
