type Item = {
  url: string
  source_name: string
  title_zh: string
  title_en?: string
  published_at?: string
}

export default function CategoryColumn({ title, items }: { title: string, items: Item[] }) {
  return (
    <section aria-label={title} className="flex-1 min-w-[260px]">
      <div className="sticky top-12 bg-gray-50 border-b px-3 py-2 font-medium">{title}</div>
      <ul className="divide-y">
        {items.map((it, idx) => (
          <li key={it.url + idx} className="px-3 py-2">
            <a href={it.url} target="_blank" rel="noreferrer" className="block group">
              <div className="text-[13px] text-gray-500">
                <span className="inline-block border rounded px-1 mr-2">{it.source_name}</span>
                <time>{it.published_at ? new Date(it.published_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}</time>
              </div>
              <div className="font-medium leading-snug group-hover:underline">{it.title_zh}</div>
              {it.title_en && <div className="text-sm text-gray-700">{it.title_en}</div>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
