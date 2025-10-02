import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  ScanPayload,
  ScanOverviewCard,
  CategoryCoverageSection,
  SummarySection,
  calculateTotalArticles,
  formatDateTime
} from '../components/scan/ScanSections'

export default function Today() {
  const [data, setData] = useState<ScanPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const r = await fetch('/api/today')
      if (!r.ok) throw new Error('No scan available yet')
      const j = await r.json()
      setData(j)
    } catch (e: any) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [])

  async function rescan() {
    const token = prompt('Admin token?')
    if (!token) return
    const r = await fetch('/api/scan?manual=1', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
    if (r.ok) { alert('Rescan triggered. Refresh in ~1–2 minutes.'); }
    else { alert('Failed: ' + (await r.text())) }
  }

  const order = useMemo(() => [...CATEGORY_ORDER], [])
  const briefingMeta = useMemo(() => {
    if (!data) return null
    const totalArticles = calculateTotalArticles(data.categories, order)
    return { totalArticles, lastRun: data.meta?.run_started_at }
  }, [data, order])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onRescan={rescan} lastRun={data?.meta.run_started_at} />
      <main className="max-w-7xl mx-auto px-4 pb-10">
        {error && <div className="p-3 border rounded bg-yellow-50 text-sm">{error}</div>}
        {!data ? <div className="mt-10 text-center text-sm text-slate-600">Loading…</div> : (
          <>
            {briefingMeta && (
              <ScanOverviewCard
                title="Today’s Briefing"
                description="A snapshot of the latest China coverage, refreshed whenever a new scan completes."
                metrics={[
                  { label: 'Total articles', value: briefingMeta.totalArticles },
                  { label: 'Last run', value: formatDateTime(briefingMeta.lastRun) }
                ]}
              />
            )}

            <CategoryCoverageSection
              categories={data.categories}
              order={order}
              labels={CATEGORY_LABELS}
            />

            <SummarySection summaries={data.summaries} order={order} labels={CATEGORY_LABELS} />
          </>
        )}
      </main>
    </div>
  )
}
