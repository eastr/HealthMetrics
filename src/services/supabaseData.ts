import type {
  CheckInSchedule,
  HealthEntry,
  MedicationPreset,
  MetricCatalogItem,
} from '../types/entry'
import {
  normalizeCheckInSchedule,
  normalizeEntry,
  normalizeMedicationPreset,
  normalizeMetricCatalogItem,
} from '../types/entry'
import { getUserId } from './supabaseAuth'
import { getSupabase } from './supabaseClient'

async function requireUserId(): Promise<string> {
  const userId = await getUserId()
  if (!userId) throw new Error('No signed-in Supabase user')
  return userId
}

interface EntryRow {
  id: string
  user_id: string
  type: string
  timestamp: string
  notes: string
  values: Record<string, number> | null
  medication: string | null
  dose: string | null
  deleted_at: string | null
}

interface RemoteEntryRow {
  id: string
  type: string
  timestamp: string
  notes: string
  values: Record<string, number> | null
  medication: string | null
  dose: string | null
  updated_at: string
  deleted_at: string | null
}

function entryToRow(entry: HealthEntry, userId: string): EntryRow {
  const base = {
    id: entry.id,
    user_id: userId,
    type: entry.type,
    timestamp: entry.timestamp,
    notes: entry.notes,
    values: null as Record<string, number> | null,
    medication: null as string | null,
    dose: null as string | null,
    deleted_at: null,
  }
  return entry.type === 'symptoms'
    ? { ...base, values: entry.values }
    : { ...base, medication: entry.medication, dose: entry.dose }
}

export interface EntryChanges {
  entries: HealthEntry[]
  deletedIds: string[]
  cursor: string | null
  knownIds: string[]
}

export async function fetchEntryChanges(since?: string | null): Promise<EntryChanges> {
  const rows: RemoteEntryRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    let query = getSupabase()
      .from('entries')
      .select('id,type,timestamp,notes,values,medication,dose,updated_at,deleted_at')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (since) query = query.gt('updated_at', since)
    const { data, error } = await query
    if (error) throw error
    rows.push(...((data ?? []) as RemoteEntryRow[]))
    if (!data || data.length < pageSize) break
  }
  return {
    entries: rows
      .filter((row) => !row.deleted_at)
      .map((row) =>
        normalizeEntry({
          ...row,
          syncStatus: 'synced',
        }),
      ),
    deletedIds: rows.filter((row) => Boolean(row.deleted_at)).map((row) => row.id),
    knownIds: rows.map((row) => row.id),
    cursor: rows.length > 0 ? rows[rows.length - 1].updated_at : since ?? null,
  }
}

export async function upsertEntry(entry: HealthEntry): Promise<HealthEntry> {
  const userId = await requireUserId()
  const { error } = await getSupabase()
    .from('entries')
    .upsert(entryToRow(entry, userId), { onConflict: 'id' })
  if (error) throw error
  return { ...normalizeEntry(entry), rowIndex: undefined, syncStatus: 'synced' }
}

export async function deleteEntry(entryId: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await getSupabase()
    .from('entries')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function fetchMedicationPresets(): Promise<MedicationPreset[]> {
  const { data, error } = await getSupabase()
    .from('medication_presets')
    .select('id,name,default_dose,times,days,active,notes,kind')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  type MedRow = {
    id: string
    name: string
    default_dose: string | null
    times: MedicationPreset['times']
    days: MedicationPreset['days']
    active: boolean
    notes: string | null
    kind: MedicationPreset['kind']
  }
  return ((data ?? []) as MedRow[]).map((row) =>
    normalizeMedicationPreset({
      id: row.id,
      name: row.name,
      defaultDose: row.default_dose ?? undefined,
      times: row.times,
      days: row.days,
      active: row.active,
      notes: row.notes ?? undefined,
      kind: row.kind,
    }),
  )
}

export async function replaceMedicationPresets(
  presets: MedicationPreset[],
): Promise<MedicationPreset[]> {
  const userId = await requireUserId()
  const supabase = getSupabase()
  const { error: deleteError } = await supabase
    .from('medication_presets')
    .delete()
    .eq('user_id', userId)
  if (deleteError) throw deleteError
  if (presets.length > 0) {
    const { error } = await supabase.from('medication_presets').insert(
      presets.map((preset) => ({
        id: preset.id,
        user_id: userId,
        name: preset.name,
        default_dose: preset.defaultDose ?? null,
        times: preset.times,
        days: preset.days,
        active: preset.active,
        notes: preset.notes ?? null,
        kind: preset.kind,
      })),
    )
    if (error) throw error
  }
  return presets.map((preset) => normalizeMedicationPreset(preset))
}

export async function fetchMetrics(): Promise<MetricCatalogItem[]> {
  const { data, error } = await getSupabase()
    .from('metrics')
    .select('id,key,label,color,active,sort_order,scale_labels')
    .is('deleted_at', null)
    .order('sort_order')
  if (error) throw error
  type MetricRow = {
    id: string
    key: string
    label: string
    color: string
    active: boolean
    sort_order: number
    scale_labels: MetricCatalogItem['scaleLabels']
  }
  return ((data ?? []) as MetricRow[]).map((row) =>
    normalizeMetricCatalogItem({
      id: row.id,
      key: row.key,
      label: row.label,
      color: row.color,
      active: row.active,
      sortOrder: row.sort_order,
      scaleLabels: row.scale_labels,
    }),
  )
}

export async function replaceMetrics(metrics: MetricCatalogItem[]): Promise<MetricCatalogItem[]> {
  const userId = await requireUserId()
  const supabase = getSupabase()
  const { error: deleteError } = await supabase.from('metrics').delete().eq('user_id', userId)
  if (deleteError) throw deleteError
  if (metrics.length > 0) {
    const { error } = await supabase.from('metrics').insert(
      metrics.map((metric) => ({
        id: metric.id,
        user_id: userId,
        key: metric.key,
        label: metric.label,
        color: metric.color,
        active: metric.active,
        sort_order: metric.sortOrder,
        scale_labels: metric.scaleLabels,
      })),
    )
    if (error) throw error
  }
  return metrics.map((metric) => normalizeMetricCatalogItem(metric))
}

export async function fetchCheckIns(): Promise<CheckInSchedule[]> {
  const { data, error } = await getSupabase()
    .from('check_ins')
    .select('id,label,times,days,active')
    .is('deleted_at', null)
    .order('label')
  if (error) throw error
  type CheckInRow = {
    id: string
    label: string
    times: CheckInSchedule['times']
    days: CheckInSchedule['days']
    active: boolean
  }
  return ((data ?? []) as CheckInRow[]).map((row) =>
    normalizeCheckInSchedule({
      id: row.id,
      label: row.label,
      times: row.times,
      days: row.days,
      active: row.active,
    }),
  )
}

export async function replaceCheckIns(
  schedules: CheckInSchedule[],
): Promise<CheckInSchedule[]> {
  const userId = await requireUserId()
  const supabase = getSupabase()
  const { error: deleteError } = await supabase.from('check_ins').delete().eq('user_id', userId)
  if (deleteError) throw deleteError
  if (schedules.length > 0) {
    const { error } = await supabase.from('check_ins').insert(
      schedules.map((schedule) => ({
        id: schedule.id,
        user_id: userId,
        label: schedule.label,
        times: schedule.times,
        days: schedule.days,
        active: schedule.active,
      })),
    )
    if (error) throw error
  }
  return schedules.map((schedule) => normalizeCheckInSchedule(schedule))
}
