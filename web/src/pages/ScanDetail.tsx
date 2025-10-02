import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CategoryCoverageSection,
  OverviewMetric,
  ScanOverviewCard,
  ScanPayload,
  SummarySection,
  calculateTotalArticles,
  formatDateTime
} from '../components/scan/ScanSections'
import { formatDuration } from '../utils/time'
import { humanizeIdentifier } from '../utils/text'

export default function ScanDetail() {
  const { scanId } = useParams<{ scanId: string }>()
  const [data, setData] = useState<ScanPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!scanId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/scans/${scanId}`)
        if (!r.ok) {
          throw new Error(`Unable to load scan ${scanId}`)
        }
        const payload = (await r.json()) as ScanPayload
        if (!cancelled) {
          setData(payload)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load scan')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [scanId])

  const order = useMemo(() => [...CATEGORY_ORDER], [])

  const overviewMetrics = useMemo(() => {
    if (!data) return []
    const { meta } = data
    const totalArticles = calculateTotalArticles(data.categories, order)
    const elapsed = formatDuration(meta.run_started_at, meta.run_completed_at)
    const scheduleLabel = humanizeIdentifier(meta.schedule_kind)

    const metrics: OverviewMetric[] = [
      { label: 'Total articles', value: totalArticles || '—' },
      { label: 'Started', value: formatDateTime(meta.run_started_at) }
    ]

    if (meta.run_completed_at) {
      metrics.push({
        label: 'Completed',
        value: formatDateTime(meta.run_completed_at),
        sublabel: elapsed && elapsed !== '—' ? `Elapsed ${elapsed}` : undefined
      })
    } else {
      metrics.push({
        label: 'Status',
        value: 'In progress',
        sublabel: elapsed && elapsed !== '—' ? `Elapsed ${elapsed}` : undefined
      })
    }

    metrics.push({
      label: 'Schedule',
      value: scheduleLabel || '—',
      sublabel: meta.timezone || undefined
    })

    return metrics
  }, [data, order])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onRescan={() => {}} lastRun={data?.meta.run_started_at} />
      <main className="mx-auto max-w-7xl px-4 pb-10">
        <div className="flex items-center gap-3 pt-6 text-sm text-slate-600">
          <Link to="/log" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800">
            <span aria-hidden>←</span> Back to log
          </Link>
          {data?.meta.id && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              Scan ID: {data.meta.id}
            </span>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading && !data && !error && (
          <div className="mt-10 text-center text-sm text-slate-600">Loading…</div>
        )}

        {data && (
          <div className="mt-2 space-y-8">
            <ScanOverviewCard
              title="Scan details"
              description="Historical snapshot of a completed crawl, including source articles and summaries."
              metrics={overviewMetrics}
            />

            <CategoryCoverageSection
              categories={data.categories}
              order={order}
              labels={CATEGORY_LABELS}
            />

            <SummarySection
              summaries={data.summaries}
              order={order}
              labels={CATEGORY_LABELS}
              title="Wrap-up summaries"
            />
          </div>
        )}
      </main>
    </div>
  )
}
