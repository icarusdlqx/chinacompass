import { useEffect, useState } from 'react'
import Header from '../components/Header'

type ScanMeta = { id: string, run_started_at: string, run_completed_at: string, total_articles: number, schedule_kind: string }

export default function Log() {
  const [items, setItems] = useState<ScanMeta[]>([])

  async function load() {
    const r = await fetch('/api/scans?limit=90')
    const j = await r.json()
    setItems(j)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen">
      <Header onRescan={() => {}} />
      <main className="max-w-4xl mx-auto p-4">
        <h2 className="text-lg font-semibold mb-3">Daily Log</h2>
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border-r">Date (start)</th>
              <th className="text-left p-2 border-r">Completed</th>
              <th className="text-left p-2 border-r">Articles</th>
              <th className="text-left p-2">Kind</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border-r"><a className="underline" href={`/api/scans/${it.id}`} target="_blank" rel="noreferrer">{new Date(it.run_started_at).toLocaleString()}</a></td>
                <td className="p-2 border-r">{it.run_completed_at ? new Date(it.run_completed_at).toLocaleString() : '—'}</td>
                <td className="p-2 border-r">{it.total_articles}</td>
                <td className="p-2">{it.schedule_kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  )
}
