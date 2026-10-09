import type { ReactNode } from 'react'

interface PageToolbarProps {
  title?: string
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageToolbar({ title, meta, actions, className = '' }: PageToolbarProps) {
  return (
    <div className={`mb-4 flex flex-wrap items-start gap-3 ${title || meta ? 'justify-between' : 'justify-end'} ${className}`}>
      {(title || meta) && (
        <div className="min-w-0">
          {title && <h2 className="text-sm font-bold">{title}</h2>}
          {meta && <div className="mt-1 text-sm text-slate-500">{meta}</div>}
        </div>
      )}
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  )
}
