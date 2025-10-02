import { useCallback, useEffect, useMemo, useState } from 'react'

type SourceStatus = {
  source_id: string
  source_name: string
  fetch_status: string
  fetch_started_at?: string | null
  fetch_completed_at?: string | null
  article_count: number
  error_message?: string | null
  last_updated_at: string
  source_region?: string | null
  source_tier?: string | null
}

type OpenAIStatus = {
  classification_status?: string | null
  translation_status?: string | null
  summarization_status?: string | null
  openai_connected?: number | null
  openai_error?: string | null
  last_updated_at?: string | null
}

type ScanMeta = {
  id: string
  run_started_at: string
  run_completed_at?: string | null
  schedule_kind?: string | null
  timezone?: string | null
  total_articles?: number | null
  status?: string | null
}

type StatusResponse = {
  scan: ScanMeta
  sources: SourceStatus[]
  openai?: OpenAIStatus | null
}

type Tone = 'success' | 'running' | 'danger' | 'warning' | 'neutral'

const POLL_INTERVAL_MS = 15000

const TONE_STYLES: Record<Tone, { badge: string; dot: string }> = {
  success: {
    badge: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100',
    dot: 'bg-emerald-400'
  },
  running: {
    badge: 'border-sky-400/40 bg-sky-500/20 text-sky-100',
    dot: 'bg-sky-400'
  },
  danger: {
    badge: 'border-rose-400/40 bg-rose-500/20 text-rose-100',
    dot: 'bg-rose-400'
  },
  warning: {
    badge: 'border-amber-400/40 bg-amber-500/20 text-amber-100',
    dot: 'bg-amber-300'
  },
  neutral: {
    badge: 'border-slate-400/40 bg-slate-600/40 text-slate-100',
    dot: 'bg-slate-300'
  }
}

function toneForStatus(status?: string | null): Tone {
  switch (status) {
    case 'success':
    case 'complete':
      return 'success'
    case 'running':
      return 'running'
    case 'error':
    case 'failed':
      return 'danger'
    case 'pending':
      return 'warning'
    default:
      return 'neutral'
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

function summarizeRun(scan: ScanMeta) {
  const schedule = scan.schedule_kind === 'manual' ? 'Manual' : 'Auto'
  const started = formatDateTime(scan.run_started_at)
  const completed = formatDateTime(scan.run_completed_at)
  switch (scan.status) {
    case 'running':
      return `${schedule} run in progress${started ? ` — started ${started}` : ''}`
    case 'failed':
      return `${schedule} run failed${completed ? ` — ${completed}` : ''}`
    case 'complete':
    default:
      return `${schedule} run completed${completed ? ` — ${completed}` : started ? ` — started ${started}` : ''}`
  }
}

function summarizeAI(status?: OpenAIStatus | null) {
  if (!status) return { text: 'AI status unavailable', tone: 'neutral' as Tone }
  const phases = [status.classification_status, status.translation_status, status.summarization_status]
  if (phases.every(p => p === 'skipped')) {
    return { text: 'AI phases skipped (no articles)', tone: 'neutral' as Tone }
  }
  if (phases.some(p => p === 'error') || status.openai_connected === 0) {
    return {
      text: status.openai_error ? `AI error: ${status.openai_error}` : 'AI phases failed',
      tone: 'danger' as Tone
    }
  }
  if (phases.some(p => p === 'running')) {
    return { text: 'AI processing…', tone: 'running' as Tone }
  }
  if (phases.every(p => p === 'success')) {
    return { text: 'AI responses healthy', tone: 'success' as Tone }
  }
  return { text: 'AI status pending', tone: 'warning' as Tone }
}

export default function StatusBar() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/status', { cache: 'no-store' })
      if (response.status === 404) {
        setStatus(null)
        setState('empty')
        setError(null)
        return
      }
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      const data: StatusResponse = await response.json()
      setStatus(data)
      setState('ready')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [load])

  const runTone = toneForStatus(status?.scan.status || (state === 'empty' ? 'pending' : undefined))
  const runText = status ? summarizeRun(status.scan) : state === 'empty' ? 'Awaiting first scan' : 'Loading run status…'
  const aiSummary = useMemo(() => summarizeAI(status?.openai), [status])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur">
      <div className="pointer-events-auto mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 text-xs text-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium ${TONE_STYLES[runTone].badge}`}>
            <span className={`h-2 w-2 rounded-full ${TONE_STYLES[runTone].dot}`} aria-hidden="true" />
            {runText}
          </span>
          {status?.scan.total_articles != null && status.scan.status === 'complete' && (
            <span className="rounded-full border border-slate-700/60 bg-slate-800/60 px-3 py-1 font-medium text-slate-200">
              {status.scan.total_articles} articles
            </span>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-1 sm:flex-row sm:items-center sm:justify-end">
          <span className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 font-medium ${TONE_STYLES[aiSummary.tone].badge}`} title={status?.openai?.openai_error || undefined}>
            <span className={`h-2 w-2 rounded-full ${TONE_STYLES[aiSummary.tone].dot}`} aria-hidden="true" />
            <span className="truncate">{aiSummary.text}</span>
          </span>

          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1">
            {state === 'loading' && <span className="whitespace-nowrap text-slate-300/80">Checking sources…</span>}
            {state === 'error' && <span className="whitespace-nowrap text-rose-200">Status unavailable: {error}</span>}
            {state !== 'loading' && state !== 'error' && status?.sources.length ? (
              status.sources.map(source => {
                const tone = toneForStatus(source.fetch_status)
                const tooltip = `${source.source_name} — ${source.fetch_status.toUpperCase()}${source.article_count != null ? ` • ${source.article_count} articles` : ''}${source.error_message ? ` • ${source.error_message}` : ''}`
                return (
                  <span
                    key={source.source_id}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 font-medium ${TONE_STYLES[tone].badge}`}
                    title={tooltip}
                  >
                    <span className={`h-2 w-2 rounded-full ${TONE_STYLES[tone].dot}`} aria-hidden="true" />
                    <span className="truncate">{source.source_name}</span>
                    <span className="text-[0.65rem] uppercase tracking-wide text-slate-200/70">{source.article_count}</span>
                  </span>
                )
              })
            ) : state === 'empty' ? (
              <span className="whitespace-nowrap text-slate-300/80">No scan activity yet</span>
            ) : state === 'ready' && status ? (
              <span className="whitespace-nowrap text-slate-300/80">Per-source status unavailable</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
