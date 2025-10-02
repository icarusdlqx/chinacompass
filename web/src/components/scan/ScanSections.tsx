import { ReactNode } from 'react'
import CategoryColumn, { CategoryItem } from '../CategoryColumn'
import SummaryCard, { Summary } from '../SummaryCard'

export const CATEGORY_LABELS: Record<string, string> = {
  international: 'International',
  domestic_politics: 'Domestic Politics',
  business: 'Business/Economy',
  society: 'Society',
  technology: 'Technology',
  military: 'Military/Defense',
  science: 'Science/Research',
  opinion: 'Opinion/Commentary'
}

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)

export type ScanMeta = {
  id: string
  run_started_at?: string
  run_completed_at?: string
  schedule_kind?: string
  timezone?: string
  total_articles?: number
}

export type ScanPayload = {
  meta: ScanMeta
  categories: Record<string, CategoryItem[]>
  summaries: Record<string, Summary | undefined>
}

export type OverviewMetric = {
  label: string
  value: ReactNode
  sublabel?: ReactNode
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export function calculateTotalArticles(
  categories: Record<string, CategoryItem[]>,
  order: string[]
) {
  return order.reduce((sum, key) => sum + (categories[key]?.length || 0), 0)
}

export function ScanOverviewCard({
  title,
  description,
  metrics
}: {
  title: string
  description?: ReactNode
  metrics: OverviewMetric[]
}) {
  return (
    <section
      aria-label="Briefing overview"
      className="mt-6 rounded-3xl border border-slate-200 bg-white/70 px-6 py-5 shadow-sm backdrop-blur"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          )}
        </div>
        {metrics.length > 0 && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center"
              >
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">
                  {metric.value}
                </dd>
                {metric.sublabel && (
                  <dd className="mt-1 text-xs font-medium text-slate-500">
                    {metric.sublabel}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}

export function CategoryCoverageSection({
  categories,
  order,
  labels,
  title = 'Category coverage'
}: {
  categories: Record<string, CategoryItem[]>
  order: string[]
  labels: Record<string, string>
  title?: string
}) {
  return (
    <section className="mt-8 space-y-6" aria-label="Category coverage">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {order.map((key) => (
          <CategoryColumn
            key={key}
            title={labels[key] || key}
            items={categories[key] || []}
          />
        ))}
      </div>
    </section>
  )
}

export function SummarySection({
  summaries,
  order,
  labels,
  title = 'Daily wrap-up'
}: {
  summaries: Record<string, Summary | undefined>
  order: string[]
  labels: Record<string, string>
  title?: string
}) {
  return (
    <section className="mt-10 space-y-4" aria-label="Daily wrap-up summaries">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {order.map((key) => (
          <SummaryCard key={key} title={labels[key] || key} data={summaries[key]} />
        ))}
      </div>
    </section>
  )
}
