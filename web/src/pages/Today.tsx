import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import CategoryColumn, { type CategoryItem } from '../components/CategoryColumn'
import SummaryCard from '../components/SummaryCard'
import StatusBar from '../components/StatusBar'

type ScanPayload = {
  meta: { id: string, run_started_at: string }
  categories: Record<string, CategoryItem[]>
  summaries: Record<string, any>
}

const CAT_LABELS: Record<string,string> = {
  international: "International",
  domestic_politics: "Domestic Politics",
  business: "Business/Economy",
  society: "Society",
  technology: "Technology",
  military: "Military/Defense",
  science: "Science/Research",
  opinion: "Opinion/Commentary"
}

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

  const order = useMemo(() => Object.keys(CAT_LABELS), [])
  const briefingMeta = useMemo(() => {
    if (!data) return null
    const totalArticles = order.reduce((sum, key) => sum + (data.categories[key]?.length || 0), 0)
    return { totalArticles, lastRun: data.meta?.run_started_at }
  }, [data, order])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onRescan={rescan} lastRun={data?.meta.run_started_at} />
      <main className="max-w-7xl mx-auto px-4 pb-28">
        {error && <div className="p-3 border rounded bg-yellow-50 text-sm">{error}</div>}
        {!data ? <div className="mt-10 text-center text-sm text-slate-600">Loading…</div> : (
          <>
            {briefingMeta && (
              <section
                aria-label="Briefing overview"
                className="mt-6 rounded-3xl border border-slate-200 bg-white/70 px-6 py-5 shadow-sm backdrop-blur"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Today&rsquo;s Briefing</h1>
                    <p className="mt-1 text-sm text-slate-600">
                      A snapshot of the latest China coverage, refreshed whenever a new scan completes.
                    </p>
                  </div>
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Total articles</dt>
                      <dd className="mt-1 text-xl font-semibold text-slate-900">{briefingMeta.totalArticles}</dd>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Last run</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">
                        {briefingMeta.lastRun ? new Date(briefingMeta.lastRun).toLocaleString() : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}

            <section className="mt-8 space-y-6" aria-label="Category coverage">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Category coverage</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {order.map(c => (
                  <CategoryColumn key={c} title={CAT_LABELS[c]} items={data.categories[c] || []} />
                ))}
              </div>
            </section>

            <section className="mt-10 space-y-4" aria-label="Daily wrap-up summaries">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Daily wrap-up</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {order.map(c => (
                  <SummaryCard key={c} title={CAT_LABELS[c]} data={data.summaries[c]} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
      <StatusBar />
    </div>
  )
}
