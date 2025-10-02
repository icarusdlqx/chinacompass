import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import { formatDateTime } from '../components/scan/ScanSections'
import { formatDuration } from '../utils/time'
import { humanizeIdentifier } from '../utils/text'

type ScanMeta = {
  id: string
  run_started_at: string
  run_completed_at: string | null
  total_articles: number
  schedule_kind: string
}

export default function Log() {
  const [items, setItems] = useState<ScanMeta[]>([])

  async function load() {
    const r = await fetch('/api/scans?limit=90')
    const j = await r.json()
    setItems(j)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onRescan={() => {}} />
      <main className="mx-auto max-w-5xl px-4 pb-10">
        <h2 className="mb-4 mt-6 text-lg font-semibold text-slate-900">Daily Log</h2>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Run</th>
                <th scope="col" className="px-4 py-3 text-left">Status</th>
                <th scope="col" className="px-4 py-3 text-left">Articles</th>
                <th scope="col" className="px-4 py-3 text-left">Schedule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((it) => {
                const startedAt = formatDateTime(it.run_started_at)
                const completedAt = formatDateTime(it.run_completed_at)
                const isComplete = Boolean(it.run_completed_at)
                const duration = formatDuration(it.run_started_at, it.run_completed_at)
                const statusLabel = isComplete ? 'Completed' : 'In progress'
                const statusClass = isComplete
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'

                return (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <Link
                          to={`/log/${it.id}`}
                          className="font-medium text-slate-900 hover:text-slate-700 hover:underline"
                        >
                          {startedAt}
                        </Link>
                        <span className="text-xs text-slate-500">Scan ID: {it.id}</span>
                        {completedAt !== '—' && (
                          <span className="text-xs text-slate-500">Completed {completedAt}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                        {duration !== '—' && (
                          <span className="text-xs text-slate-500">Elapsed {duration}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top font-medium text-slate-900">{it.total_articles}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-slate-700">
                          {humanizeIdentifier(it.schedule_kind) || '—'}
                        </span>
                        <span className="text-slate-500">View details &rarr;</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
