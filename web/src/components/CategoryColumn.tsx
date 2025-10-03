import { useMemo, useState } from 'react'

export type CategoryItem = {
  id: string
  url: string
  source_name: string
  title_zh: string
  title_en?: string
  dek_zh?: string
  dek_en?: string
  published_at?: string
  source_id?: string
  fetched_at?: string
  section_hint?: string
  hash?: string
  category?: string
  rank_in_category?: number
  is_duplicate?: boolean
}

export default function CategoryColumn({ title, items }: { title: string, items: CategoryItem[] }) {
  const [showEnglish, setShowEnglish] = useState(false)
  const hasTranslations = useMemo(() => items.some(it => !!(it.title_en || it.dek_en)), [items])

  function formatTime(value?: string) {
    if (!value) return null
    try {
      return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (err) {
      return null
    }
  }

  return (
    <section
      aria-label={title}
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {hasTranslations && (
          <button
            type="button"
            onClick={() => setShowEnglish(v => !v)}
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
            aria-pressed={showEnglish}
          >
            {showEnglish ? 'Hide EN' : 'Show EN'}
          </button>
        )}
      </div>
      <ul className="flex flex-1 flex-col gap-4 px-5 py-5">
        {items.length === 0 && (
          <li className="text-sm text-slate-500">No coverage captured yet.</li>
        )}
        {items.map((it, idx) => {
          const time = formatTime(it.published_at)
          const englishText = it.title_en || it.dek_en
          return (
            <li key={it.url + idx} className="group">
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-transparent px-4 py-3 transition hover:border-slate-200 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    {it.source_name}
                  </span>
                  {time && <time className="font-medium text-slate-600">{time}</time>}
                </div>
                <p className="mt-2 text-sm font-medium leading-snug text-slate-900 group-hover:text-slate-950">
                  {it.title_zh}
                </p>
                {showEnglish && englishText && (
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{englishText}</p>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
