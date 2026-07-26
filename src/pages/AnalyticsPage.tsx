import { useDeferredValue, useMemo, useState, useTransition } from 'react'
import { useEntries } from '../hooks/useEntries'
import { useMetrics } from '../hooks/useMetricColors'
import { useMedicationPresets } from '../hooks/useMedicationPresets'
import { useCheckInSchedules } from '../hooks/useCheckInSchedules'
import SummaryCards from '../components/analytics/SummaryCards'
import TrendChart from '../components/analytics/TrendChart'
import TimeOfDayChart from '../components/analytics/TimeOfDayChart'
import MedicationLog from '../components/analytics/MedicationLog'
import MedicationDoseChart from '../components/analytics/MedicationDoseChart'
import AdherenceCard from '../components/analytics/AdherenceCard'
import MetricDeltaCards from '../components/analytics/MetricDeltaCards'
import CalendarHeatmap from '../components/analytics/CalendarHeatmap'
import WeekdayChart from '../components/analytics/WeekdayChart'
import BestWorstDays from '../components/analytics/BestWorstDays'
import DistributionChart from '../components/analytics/DistributionChart'
import CorrelationMatrix from '../components/analytics/CorrelationMatrix'
import MedEffectChart from '../components/analytics/MedEffectChart'
import {
  bestWorstDays,
  computeAdherenceWindow,
  dailyAverages,
  dailySeverityMap,
  entriesForDate,
  entriesInRange,
  medEffectOnSymptoms,
  medicationDosesPerDay,
  medicationEntries,
  metricCorrelations,
  periodDeltas,
  summaryForPeriod,
  symptomEntries,
  timeOfDayAverages,
  vitaminEntries,
  weekdayAverages,
} from '../utils/analytics'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

/** Streak lookback is capped so we don't walk hundreds of empty schedule days. */
const STREAK_LOOKBACK = 90

type RangeAccent = 'primary' | 'violet' | 'emerald'

const RANGE_ACTIVE: Record<RangeAccent, string> = {
  primary: 'bg-primary-700 text-white',
  violet: 'bg-violet-700 text-white',
  emerald: 'bg-emerald-700 text-white',
}

function RangeButtons({
  value,
  onChange,
  accent = 'primary',
}: {
  value: number
  onChange: (days: number) => void
  accent?: RangeAccent
}) {
  return (
    <div className="flex gap-1">
      {RANGES.map(({ days, label }) => (
        <button
          key={days}
          onClick={() => onChange(days)}
          className={`rounded-lg px-3 py-1 text-xs font-medium ${
            value === days
              ? RANGE_ACTIVE[accent]
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {hint && <p className="mb-3 text-xs text-slate-400">{hint}</p>}
      {children}
    </section>
  )
}

export default function AnalyticsPage() {
  const { entries, loading } = useEntries()
  const { metrics } = useMetrics()
  const { presets } = useMedicationPresets()
  const { schedules } = useCheckInSchedules()
  const [rangeDays, setRangeDays] = useState(30)
  const [isPending, startTransition] = useTransition()
  const deferredRange = useDeferredValue(rangeDays)
  const metricKeys = useMemo(() => metrics.map((m) => m.key), [metrics])

  const setRange = (days: number) => {
    startTransition(() => setRangeDays(days))
  }

  const todaySymptoms = useMemo(
    () => symptomEntries(entriesForDate(entries, new Date())),
    [entries],
  )
  const rangeEntries = useMemo(
    () => entriesInRange(entries, deferredRange),
    [entries, deferredRange],
  )
  const weekSymptoms = useMemo(
    () => symptomEntries(entriesInRange(entries, 7)),
    [entries],
  )

  const todaySummary = useMemo(
    () => summaryForPeriod(todaySymptoms, metricKeys),
    [todaySymptoms, metricKeys],
  )
  const weekSummary = useMemo(
    () => summaryForPeriod(weekSymptoms, metricKeys),
    [weekSymptoms, metricKeys],
  )
  const trendData = useMemo(
    () => dailyAverages(entries, deferredRange, metricKeys),
    [entries, deferredRange, metricKeys],
  )
  const timeData = useMemo(
    () => timeOfDayAverages(rangeEntries, metricKeys),
    [rangeEntries, metricKeys],
  )
  const doseChartData = useMemo(
    () => medicationDosesPerDay(entries, deferredRange),
    [entries, deferredRange],
  )
  const vitaminDoseChartData = useMemo(
    () => medicationDosesPerDay(entries, deferredRange, 'vitamin'),
    [entries, deferredRange],
  )
  const medCount = useMemo(() => medicationEntries(rangeEntries).length, [rangeEntries])
  const vitCount = useMemo(() => vitaminEntries(rangeEntries).length, [rangeEntries])

  // Single pass for adherence %, streaks, and heatmap cells.
  const adherenceWindow = useMemo(
    () =>
      computeAdherenceWindow(
        entries,
        presets,
        schedules,
        Math.max(deferredRange, STREAK_LOOKBACK),
        deferredRange,
      ),
    [entries, presets, schedules, deferredRange],
  )

  const severityByDay = useMemo(
    () => dailySeverityMap(entries, deferredRange, metricKeys),
    [entries, deferredRange, metricKeys],
  )
  const deltas = useMemo(
    () => periodDeltas(entries, deferredRange, metricKeys),
    [entries, deferredRange, metricKeys],
  )
  const weekdayData = useMemo(
    () => weekdayAverages(rangeEntries, metricKeys),
    [rangeEntries, metricKeys],
  )
  const ranked = useMemo(
    () => bestWorstDays(entries, deferredRange, metricKeys),
    [entries, deferredRange, metricKeys],
  )
  const correlations = useMemo(
    () => metricCorrelations(rangeEntries, metricKeys),
    [rangeEntries, metricKeys],
  )
  const medEffects = useMemo(
    () => medEffectOnSymptoms(entries, deferredRange, metricKeys, 'medication'),
    [entries, deferredRange, metricKeys],
  )
  const vitaminEffects = useMemo(
    () => medEffectOnSymptoms(entries, deferredRange, metricKeys, 'vitamin'),
    [entries, deferredRange, metricKeys],
  )

  if (loading && entries.length === 0) {
    return <p className="py-8 text-center text-slate-400">Loading analytics…</p>
  }

  return (
    <div className={`space-y-6 ${isPending ? 'opacity-80' : ''}`}>
      <SummaryCards today={todaySummary} week={weekSummary} />

      <Section
        title="Adherence"
        hint={`Scheduled doses and check-ins logged over the last ${deferredRange} days`}
        action={<RangeButtons value={rangeDays} onChange={setRange} />}
      >
        <AdherenceCard stats={adherenceWindow.stats} streaks={adherenceWindow.streaks} />
      </Section>

      <Section
        title="Change"
        hint={`This period versus the previous ${deferredRange} days — a rise means worse`}
        action={<RangeButtons value={rangeDays} onChange={setRange} />}
      >
        <MetricDeltaCards deltas={deltas} rangeDays={deferredRange} />
      </Section>

      <Section
        title="Trends"
        action={<RangeButtons value={rangeDays} onChange={setRange} />}
      >
        <TrendChart data={trendData} entries={entries} rangeDays={deferredRange} />
      </Section>

      <Section
        title="Calendar"
        hint="Each square is a day — tap one for details"
        action={<RangeButtons value={rangeDays} onChange={setRange} />}
      >
        <CalendarHeatmap
          severity={severityByDay}
          adherence={adherenceWindow.byDay}
          days={deferredRange}
        />
      </Section>

      <Section
        title="Time of day"
        hint="Average scores by morning (6–12), afternoon (12–18), and evening (18–6)"
      >
        <TimeOfDayChart data={timeData} />
      </Section>

      <Section
        title="Day of week"
        hint="Average scores by weekday across the selected range"
        action={<RangeButtons value={rangeDays} onChange={setRange} />}
      >
        <WeekdayChart data={weekdayData} />
      </Section>

      <Section
        title="Best and worst days"
        hint="Ranked by the mean score across all metrics"
        action={<RangeButtons value={rangeDays} onChange={setRange} />}
      >
        <BestWorstDays best={ranked.best} worst={ranked.worst} />
      </Section>

      <Section
        title="Score distribution"
        hint="How often each level was recorded"
        action={<RangeButtons value={rangeDays} onChange={setRange} />}
      >
        <DistributionChart entries={rangeEntries} />
      </Section>

      <Section
        title="Correlations"
        hint="How closely metrics track each other, using daily averages"
        action={<RangeButtons value={rangeDays} onChange={setRange} />}
      >
        <CorrelationMatrix correlations={correlations} />
      </Section>

      <Section
        title="Medications"
        action={<RangeButtons value={rangeDays} onChange={setRange} accent="violet" />}
      >
        <MedicationLog entries={entries} days={deferredRange} kind="medication" />
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Doses per day</h3>
          <MedicationDoseChart data={doseChartData} />
        </div>
        <div className="mt-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Symptoms on days taken</h3>
          <p className="mb-3 text-xs text-slate-400">
            Mean severity on days each medication was logged versus days it was not
          </p>
          <MedEffectChart effects={medEffects} kind="medication" />
        </div>
      </Section>

      <Section
        title="Vitamins"
        action={<RangeButtons value={rangeDays} onChange={setRange} accent="emerald" />}
      >
        <MedicationLog entries={entries} days={deferredRange} kind="vitamin" />
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Doses per day</h3>
          <MedicationDoseChart data={vitaminDoseChartData} />
        </div>
        <div className="mt-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Symptoms on days taken</h3>
          <p className="mb-3 text-xs text-slate-400">
            Mean severity on days each vitamin was logged versus days it was not
          </p>
          <MedEffectChart effects={vitaminEffects} kind="vitamin" />
        </div>
      </Section>

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
          <div>
            <dt className="text-slate-400">Vitamins in range</dt>
            <dd className="text-xl font-bold text-slate-800">{vitCount}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Adherence in range</dt>
            <dd className="text-xl font-bold text-slate-800">
              {adherenceWindow.stats.pct == null ? '—' : `${adherenceWindow.stats.pct}%`}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Logging streak</dt>
            <dd className="text-xl font-bold text-slate-800">
              {adherenceWindow.streaks.currentLogged}d
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
