import type { PropsWithChildren, ReactNode } from 'react'

export default function ExpandableSection({
  title,
  description,
  defaultOpen = false,
  actions,
  children
}: PropsWithChildren<{
  title: string
  description?: ReactNode
  defaultOpen?: boolean
  actions?: ReactNode
}>) {
  return (
    <details
      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      open={defaultOpen}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-left outline-none marker:content-none"
      >
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <span
            aria-hidden
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-medium text-slate-600 transition-transform duration-200 group-open:rotate-45"
          >
            +
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-200 px-6 py-5 text-sm leading-6 text-slate-700">
        {children}
      </div>
    </details>
  )
}
