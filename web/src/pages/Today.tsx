import { useEffect, useState } from 'react'
import Header from '../components/Header'
import CategoryColumn from '../components/CategoryColumn'
import SummaryCard from '../components/SummaryCard'

type ScanPayload = {
  meta: { id: string, run_started_at: string }
  categories: Record<string, any[]>
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

  const order = Object.keys(CAT_LABELS)

  return (
    <div className="min-h-screen">
      <Header onRescan={rescan} lastRun={data?.meta.run_started_at} />
      <main className="max-w-7xl mx-auto p-4">
        {error && <div className="p-3 border rounded bg-yellow-50 text-sm">{error}</div>}
        {!data ? <div>Loading…</div> : (
          <>
            <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {order.map(c => (
                <CategoryColumn key={c} title={CAT_LABELS[c]} items={data.categories[c] || []} />
              ))}
            </section>
            <h2 className="mt-8 mb-3 text-lg font-semibold">Daily Wrap-up</h2>
            <section className="grid md:grid-cols-2 gap-4">
              {order.map(c => (
                <SummaryCard key={c} title={CAT_LABELS[c]} data={data.summaries[c]} />
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
