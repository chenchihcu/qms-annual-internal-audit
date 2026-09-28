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
}

export function PlanPreviewPanel({
  title,
  description,
  rows,
  onApply,
  onCancel,
  applyLabel = '套用預覽',
}: PlanPreviewPanelProps) {
  return (
    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 no-print">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-blue-950">{title}</h3>
          <p className="text-sm text-blue-800">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button icon="check" onClick={onApply}>{applyLabel}</Button>
          <Button variant="secondary" onClick={onCancel}>取消</Button>
        </div>
      </div>
      <div className="mt-3 max-h-48 overflow-y-auto text-xs text-blue-950">
        {rows.map((row) => (
          <div key={row.id} className="flex justify-between border-t border-blue-100 py-1">
            <span>{row.label}</span>
            <span>{row.schedule}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
