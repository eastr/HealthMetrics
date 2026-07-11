import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { HealthEntry } from '../../types/entry'
import type { ActivityFilter } from '../../types/entry'
import { filterEntries } from '../../types/entry'
import type { ShareRecordPublic, ShareSection, ShareViewerRange } from '../../types/share'
import { filterEntriesForViewer } from '../../utils/shareSnapshot'
import SummaryCards from '../analytics/SummaryCards'
import TrendChart from '../analytics/TrendChart'
import TimeOfDayChart from '../analytics/TimeOfDayChart'
import MedicationDoseChart from '../analytics/MedicationDoseChart'
import ActivityList from '../ActivityList'
import {
  dailyAveragesEndingAt,
  entriesForDate,
  formatDate,
  medicationDosesPerDayEndingAt,
  medicationEntries,
  medicationFrequencyFromEntries,
  medicationsByDayFromEntries,
  summaryForPeriod,
  symptomEntries,
  timeOfDayAverages,
  viewerRangeDays,
} from '../../utils/analytics'

const SECTIONS: { value: ShareSection; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'trends', label: 'Trends' },
  { value: 'medications', label: 'Medications' },
  { value: 'daily', label: 'Daily log' },
]

const VIEWER_RANGES: { value: ShareViewerRange; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 'full', label: 'Full snapshot' },
]

const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'symptoms', label: 'Symptoms' },
  { value: 'medication', label: 'Medications' },
]

interface ShareAnalyticsPanelProps {
  record: ShareRecordPublic
  entries: HealthEntry[]
}

export default function ShareAnalyticsPanel({ record, entries }: ShareAnalyticsPanelProps) {
  const [section, setSection] = useState<ShareSection>('summary')
  const [viewerRange, setViewerRange] = useState<ShareViewerRange>(30)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')

  const snapshotEnd = parseISO(record.dateTo)

  const viewerEntries = useMemo(
    () => filterEntriesForViewer(entries, record.dateFrom, record.dateTo, viewerRange),
    [entries, record.dateFrom, record.dateTo, viewerRange],
  )

  const chartDays = viewerRangeDays(viewerRange, record.dateFrom, record.dateTo)
  const rangeSymptoms = symptomEntries(viewerEntries)
  const todayInSnapshot = symptomEntries(entriesForDate(viewerEntries, snapshotEnd))
  const weekInSnapshot = symptomEntries(
    filterEntriesForViewer(entries, record.dateFrom, record.dateTo, 7),
  )

  const todaySummary = summaryForPeriod(todayInSnapshot.length > 0 ? todayInSnapshot : rangeSymptoms)
  const weekSummary = summaryForPeriod(weekInSnapshot.length > 0 ? weekInSnapshot : rangeSymptoms)
  const trendData = dailyAveragesEndingAt(viewerEntries, snapshotEnd, chartDays)
  const timeData = timeOfDayAverages(viewerEntries)
  const doseChartData = medicationDosesPerDayEndingAt(viewerEntries, snapshotEnd, chartDays)
  const medFrequency = medicationFrequencyFromEntries(viewerEntries)
  const medByDay = medicationsByDayFromEntries(viewerEntries)
  const dailyLogEntries = filterEntries(viewerEntries, activityFilter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {VIEWER_RANGES.map(({ value, label }) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setViewerRange(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              viewerRange === value
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {SECTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSection(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              section === value
                ? 'bg-white text-primary-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'summary' && (
        <div className="space-y-4">
          <SummaryCards today={todaySummary} week={weekSummary} />
          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">Time of day</h2>
            <TimeOfDayChart data={timeData} />
          </section>
          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-2 text-lg font-semibold text-slate-800">Overview</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-400">Entries in view</dt>
                <dd className="text-xl font-bold text-slate-800">{viewerEntries.length}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Medications in view</dt>
                <dd className="text-xl font-bold text-slate-800">
                  {medicationEntries(viewerEntries).length}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {section === 'trends' && (
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Trends</h2>
          <TrendChart data={trendData} entries={viewerEntries} rangeDays={chartDays} />
        </section>
      )}

      {section === 'medications' && (
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Medications</h2>
          {medByDay.length === 0 && medFrequency.length === 0 ? (
            <p className="text-sm text-slate-400">No medications in this view.</p>
          ) : (
            <>
              <div className="mb-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Daily log</h3>
                <ul className="space-y-4">
                  {medByDay.map((group) => (
                    <li key={group.date}>
                      <div className="mb-2 font-medium text-slate-800">{group.label}</div>
                      <ul className="space-y-1.5 border-l-2 border-violet-200 pl-3">
                        {group.entries.map((entry) => (
                          <li key={entry.id} className="text-sm text-slate-700">
                            <span className="tabular-nums text-slate-500">
                              {format(parseISO(entry.timestamp), 'HH:mm')}
                            </span>
                            {'  '}
                            <span className="font-medium">{entry.medication}</span>
                            {entry.dose && (
                              <span className="text-slate-600"> {entry.dose}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Frequency</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {medFrequency.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-lg bg-violet-50 px-4 py-3 ring-1 ring-violet-100"
                    >
                      <div className="font-semibold text-violet-900">{item.name}</div>
                      <div className="text-sm text-violet-700">
                        {item.count} {item.count === 1 ? 'dose' : 'doses'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Doses per day</h3>
                <MedicationDoseChart data={doseChartData} />
              </div>
            </>
          )}
        </section>
      )}

      {section === 'daily' && (
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-4 flex gap-1">
            {ACTIVITY_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setActivityFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  activityFilter === value
                    ? 'bg-primary-700 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Snapshot covers {formatDate(record.dateFrom)} to {formatDate(record.dateTo)}
          </p>
          <ActivityList
            entries={dailyLogEntries}
            emptyMessage="No entries in this view"
          />
        </section>
      )}
    </div>
  )
}
