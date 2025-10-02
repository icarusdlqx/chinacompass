export type Summary = {
  executive_summary: string
  key_themes?: string[]
  cross_outlet_contrasts?: string[]
  watchlist?: string[]
  notable_quotes?: string[]
}

function SummaryList({ title, items }: { title: string, items: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl bg-white/60 px-3 py-2 shadow-sm ring-1 ring-slate-100">
            <span className="mt-0.5 text-slate-400" aria-hidden>•</span>
            <span className="leading-5">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function SummaryCard({ title, data }: { title: string, data?: Summary }) {
  if (!data) return null
  const { executive_summary, key_themes, cross_outlet_contrasts, watchlist, notable_quotes } = data

  return (
    <article className="flex h-full flex-col gap-5 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white p-6 shadow-md">
      <header className="flex items-start gap-4">
        <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900/90 text-lg text-white shadow">
          📰
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 whitespace-pre-wrap">{executive_summary}</p>
        </div>
      </header>

      <div className="space-y-5 text-sm leading-6 text-slate-700">
        <SummaryList title="Key themes" items={key_themes || []} />
        <SummaryList title="Contrasts" items={cross_outlet_contrasts || []} />
        <SummaryList title="Watchlist" items={watchlist || []} />
        <SummaryList title="Notable quotes" items={notable_quotes || []} />
      </div>
    </article>
  )
}
