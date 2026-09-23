import type { ReactNode } from 'react'

interface PageToolbarProps {
  title: string
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageToolbar({ title, meta, actions, className = '' }: PageToolbarProps) {
  return (
    <div className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {meta && <div className="mt-1 text-sm text-slate-500">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  )
}
