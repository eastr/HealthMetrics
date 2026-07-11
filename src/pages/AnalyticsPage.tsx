import { useState } from 'react'
import { useEntries } from '../hooks/useEntries'
import SummaryCards from '../components/analytics/SummaryCards'
import TrendChart from '../components/analytics/TrendChart'
import TimeOfDayChart from '../components/analytics/TimeOfDayChart'
import MedicationLog from '../components/analytics/MedicationLog'
import MedicationDoseChart from '../components/analytics/MedicationDoseChart'
import {
  entriesForDate,
  entriesInRange,
  dailyAverages,
  timeOfDayAverages,
  summaryForPeriod,
  medicationDosesPerDay,
  symptomEntries,
  medicationEntries,
} from '../utils/analytics'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

export default function AnalyticsPage() {
  const { entries, loading } = useEntries()
  const [rangeDays, setRangeDays] = useState(30)

  const todaySymptoms = symptomEntries(entriesForDate(entries, new Date()))
  const rangeEntries = entriesInRange(entries, rangeDays)
  const weekSymptoms = symptomEntries(entriesInRange(entries, 7))

  const todaySummary = summaryForPeriod(todaySymptoms)
  const weekSummary = summaryForPeriod(weekSymptoms)
  const trendData = dailyAverages(entries, rangeDays)
  const timeData = timeOfDayAverages(rangeEntries)
  const doseChartData = medicationDosesPerDay(entries, rangeDays)
  const medCount = medicationEntries(rangeEntries).length

  if (loading && entries.length === 0) {
    return <p className="py-8 text-center text-slate-400">Loading analytics…</p>
  }

  return (
    <div className="space-y-6">
      <SummaryCards today={todaySummary} week={weekSummary} />

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Trends</h2>
          <div className="flex gap-1">
            {RANGES.map(({ days, label }) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                  rangeDays === days
                    ? 'bg-primary-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <TrendChart data={trendData} entries={entries} rangeDays={rangeDays} />
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Time of day</h2>
        <p className="mb-3 text-xs text-slate-400">
          Average scores by morning (6–12), afternoon (12–18), and evening (18–6)
        </p>
        <TimeOfDayChart data={timeData} />
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Medications</h2>
          <div className="flex gap-1">
            {RANGES.map(({ days, label }) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                  rangeDays === days
                    ? 'bg-violet-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <MedicationLog entries={entries} days={rangeDays} />
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Doses per day</h3>
          <MedicationDoseChart data={doseChartData} />
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Overview</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-400">Total entries</dt>
            <dd className="text-xl font-bold text-slate-800">{entries.length}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Entries in range</dt>
            <dd className="text-xl font-bold text-slate-800">{rangeEntries.length}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Medications in range</dt>
            <dd className="text-xl font-bold text-slate-800">{medCount}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
