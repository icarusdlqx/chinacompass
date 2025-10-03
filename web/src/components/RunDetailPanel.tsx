import { useMemo } from 'react'
import CategoryColumn, { type CategoryItem } from './CategoryColumn'
import SummaryCard from './SummaryCard'
import ExpandableSection from './ExpandableSection'
import { CATEGORY_LABELS, CATEGORY_ORDER } from './categoryLabels'

type RunMeta = {
  id: string
  run_started_at: string
  run_completed_at?: string | null
  schedule_kind?: string | null
  timezone?: string | null
  total_articles?: number | null
}

type RunDetail = {
  meta: RunMeta
  categories: Record<string, CategoryItem[]>
  summaries: Record<string, any>
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch (err) {
    return value
  }
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return null
  try {
    const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime())
    const minutes = Math.round(diff / 60000)
    if (minutes < 1) return '<1 minute'
    if (minutes === 1) return '1 minute'
    if (minutes < 60) return `${minutes} minutes`
    const hours = minutes / 60
    if (hours < 10) return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hours`
    const wholeHours = Math.round(hours)
    return `${wholeHours} hours`
  } catch (err) {
    return null
  }
}

export default function RunDetailPanel({ data }: { data: RunDetail }) {
  const { meta } = data
  const duration = useMemo(() => formatDuration(meta.run_started_at, meta.run_completed_at), [meta.run_started_at, meta.run_completed_at])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white px-6 py-6 shadow-sm">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Run metadata</h2>
            <p className="mt-1 text-sm text-slate-600">Detailed timing and totals captured for this scan.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-900/90 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
            {meta.schedule_kind ? meta.schedule_kind.replace(/_/g, ' ') : 'unspecified'}
          </span>
        </header>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Run ID</dt>
            <dd className="mt-1 font-medium text-slate-900 break-all">{meta.id}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Started</dt>
            <dd className="mt-1 font-medium text-slate-900">{formatDateTime(meta.run_started_at)}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Completed</dt>
            <dd className="mt-1 font-medium text-slate-900">{formatDateTime(meta.run_completed_at)}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Duration</dt>
            <dd className="mt-1 font-medium text-slate-900">{duration || '—'}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Total articles</dt>
            <dd className="mt-1 font-medium text-slate-900">{meta.total_articles ?? '—'}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Timezone</dt>
            <dd className="mt-1 font-medium text-slate-900">{meta.timezone || '—'}</dd>
          </div>
        </dl>
      </section>

      <ExpandableSection title="Summaries" description="High-level takeaways generated for each category." defaultOpen>
        <div className="grid gap-6 md:grid-cols-2">
          {CATEGORY_ORDER.map(key => (
            <SummaryCard key={key} title={CATEGORY_LABELS[key] || key} data={data.summaries[key]} />
          ))}
        </div>
        {Object.keys(data.summaries || {}).length === 0 && (
          <p className="text-sm text-slate-500">No summaries recorded for this run.</p>
        )}
      </ExpandableSection>

      <ExpandableSection title="Article coverage" description="Captured source articles grouped by category." defaultOpen>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORY_ORDER.map(key => (
            <CategoryColumn key={key} title={CATEGORY_LABELS[key] || key} items={data.categories[key] || []} />
          ))}
        </div>
      </ExpandableSection>
    </div>
  )
}
