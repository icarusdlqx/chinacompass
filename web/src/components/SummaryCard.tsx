type Summary = {
  executive_summary: string
  key_themes?: string[]
  cross_outlet_contrasts?: string[]
  watchlist?: string[]
  notable_quotes?: string[]
}

export default function SummaryCard({ title, data }: { title: string, data?: Summary }) {
  if (!data) return null
  return (
    <article className="border rounded p-4 bg-white shadow-sm">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm leading-6 whitespace-pre-wrap">{data.executive_summary}</p>

      {data.key_themes && data.key_themes.length > 0 && (
        <section className="mt-3">
          <h4 className="text-sm font-medium">Key themes</h4>
          <ul className="list-disc list-inside text-sm">
            {data.key_themes.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      )}
      {data.cross_outlet_contrasts && data.cross_outlet_contrasts.length > 0 && (
        <section className="mt-3">
          <h4 className="text-sm font-medium">Contrasts</h4>
          <ul className="list-disc list-inside text-sm">
            {data.cross_outlet_contrasts.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      )}
      {data.watchlist && data.watchlist.length > 0 && (
        <section className="mt-3">
          <h4 className="text-sm font-medium">Watchlist</h4>
          <ul className="list-disc list-inside text-sm">
            {data.watchlist.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      )}
    </article>
  )
}
