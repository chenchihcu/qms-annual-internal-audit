import type { ReactNode } from 'react'

interface EmptyStateProps {
  message: string
  action?: ReactNode
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-page/50 px-4 py-6 text-center text-sm text-muted">
      <p>{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
