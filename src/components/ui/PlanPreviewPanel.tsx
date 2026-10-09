import { Button } from './Badge'

export interface PlanPreviewRow {
  id: string
  label: string
  schedule: string
}

interface PlanPreviewPanelProps {
  title: string
  description: string
  rows: PlanPreviewRow[]
  onApply: () => void
  onCancel: () => void
  applyLabel?: string
  emptyMessage?: string
}

export function PlanPreviewPanel({
  title,
  description,
  rows,
  onApply,
  onCancel,
  applyLabel = '套用預覽',
  emptyMessage = '套用後無變更。',
}: PlanPreviewPanelProps) {
  return (
    <section className="mb-5 rounded-lg border border-tone-info-line bg-tone-info-bg p-4 no-print" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-tone-info-fg">{title}</h3>
          <p className="text-sm text-tone-info-fg">{description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button icon="check" onClick={onApply}>{applyLabel}</Button>
          <Button variant="secondary" onClick={onCancel}>取消</Button>
        </div>
      </div>
      <div className="mt-3 max-h-48 overflow-y-auto text-xs text-ink">
        {rows.length === 0 && <p className="py-1">{emptyMessage}</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex justify-between gap-3 border-t border-tone-info-line py-1">
            <span>{row.label}</span>
            <span className="text-right">{row.schedule}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
