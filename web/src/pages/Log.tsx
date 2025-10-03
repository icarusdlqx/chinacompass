import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import RunDetailPanel from '../components/RunDetailPanel'
import type { CategoryItem } from '../components/CategoryColumn'

type ScanMeta = {
  id: string
  run_started_at: string
  run_completed_at?: string | null
  total_articles: number
  schedule_kind: string
}

type ScanDetail = {
  meta: {
    id: string
    run_started_at: string
    run_completed_at?: string | null
    total_articles?: number | null
    schedule_kind?: string | null
    timezone?: string | null
  }
  categories: Record<string, CategoryItem[]>
  summaries: Record<string, any>
}

export default function Log() {
  const [items, setItems] = useState<ScanMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, ScanDetail>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  const orderedItems = useMemo(() => items.slice().sort((a, b) => {
    return new Date(b.run_started_at).getTime() - new Date(a.run_started_at).getTime()
  }), [items])

  async function loadList() {
    const r = await fetch('/api/scans?limit=90')
    const j = await r.json()
    setItems(j)
  }

  useEffect(() => { loadList() }, [])

  useEffect(() => {
    if (orderedItems.length > 0 && !selectedId) {
      setSelectedId(orderedItems[0].id)
    }
  }, [orderedItems, selectedId])

  useEffect(() => {
    if (!selectedId || details[selectedId]) return
    let cancelled = false
    setDetailError(null)
    setLoadingId(selectedId)

    async function loadDetail(id: string) {
      try {
        const r = await fetch(`/api/scans/${id}`)
        if (!r.ok) throw new Error(`Failed to load scan ${id}`)
        const data = await r.json()
        if (!cancelled) {
          setDetails(prev => ({ ...prev, [id]: data }))
        }
      } catch (err: any) {
        if (!cancelled) {
          setDetailError(err.message || 'Unable to load run details.')
        }
      } finally {
        if (!cancelled) {
          setLoadingId(current => (current === id ? null : current))
        }
      }
    }

    loadDetail(selectedId)

    return () => { cancelled = true }
  }, [selectedId, details, retryToken])

  function selectRun(id: string) {
    const hasDetail = !!details[id]
    const isSameSelection = id === selectedId
    const shouldReload = isSameSelection ? detailError !== null || !hasDetail : !hasDetail

    setDetailError(null)
    if (shouldReload) {
      setLoadingId(id)
    } else {
      setLoadingId(null)
    }

    setSelectedId(current => {
      if (current === id) {
        if (shouldReload) {
          setRetryToken(token => token + 1)
        }
        return current
      }
      return id
    })
  }

  const selectedDetail = selectedId ? details[selectedId] : null

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onRescan={() => {}} />
      <main className="mx-auto max-w-7xl px-4 pb-24">
        <section className="mt-6" aria-label="Scan history">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Daily log</h1>
              <p className="mt-1 text-sm text-slate-600">
                Select a run to review its summaries and captured articles without leaving the dashboard.
              </p>
            </div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Showing {orderedItems.length} runs</p>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="hidden min-w-full text-sm text-slate-700 md:table">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Completed</th>
                  <th className="px-4 py-3 text-left">Articles</th>
                  <th className="px-4 py-3 text-left">Kind</th>
                </tr>
              </thead>
              <tbody>
                {orderedItems.map(it => {
                  const isSelected = it.id === selectedId
                  return (
                    <tr
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectRun(it.id)}
                      onKeyDown={evt => {
                        if (evt.key === 'Enter' || evt.key === ' ') {
                          evt.preventDefault()
                          selectRun(it.id)
                        }
                      }}
                      className={`transition-colors ${isSelected ? 'bg-slate-100' : 'odd:bg-white even:bg-slate-50 hover:bg-slate-100/70 focus-visible:bg-slate-100'}`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{new Date(it.run_started_at).toLocaleString()}</td>
                      <td className="px-4 py-3">{it.run_completed_at ? new Date(it.run_completed_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">{it.total_articles ?? '—'}</td>
                      <td className="px-4 py-3 capitalize">{it.schedule_kind.replace(/_/g, ' ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="divide-y divide-slate-200 md:hidden" role="list">
              {orderedItems.map(it => {
                const isSelected = it.id === selectedId
                return (
                  <button
                    type="button"
                    key={it.id}
                    onClick={() => selectRun(it.id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left transition ${isSelected ? 'bg-slate-100' : 'bg-white'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400`}
                    role="listitem"
                  >
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{new Date(it.run_started_at).toLocaleString()}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div>
                          <dt className="uppercase tracking-wide text-slate-500">Completed</dt>
                          <dd className="mt-0.5 text-slate-700">{it.run_completed_at ? new Date(it.run_completed_at).toLocaleString() : '—'}</dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-wide text-slate-500">Articles</dt>
                          <dd className="mt-0.5 text-slate-700">{it.total_articles ?? '—'}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="uppercase tracking-wide text-slate-500">Kind</dt>
                          <dd className="mt-0.5 text-slate-700 capitalize">{it.schedule_kind.replace(/_/g, ' ')}</dd>
                        </div>
                      </dl>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mt-8" aria-live="polite" aria-busy={loadingId === selectedId}>
          {!selectedId && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-600">
              Select a run from the log to view its details.
            </div>
          )}

          {selectedId && (
            <div className="mt-4 space-y-4">
              {loadingId === selectedId && !selectedDetail && (
                <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
                  Loading run details…
                </div>
              )}
              {detailError && loadingId !== selectedId && !selectedDetail && (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-6 text-sm text-red-700 shadow-sm">
                  {detailError}
                </div>
              )}
              {selectedDetail && <RunDetailPanel data={selectedDetail} />}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
