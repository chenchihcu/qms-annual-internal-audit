import type { NcrReportStageProgress } from '../lib/ncr'

const STAGE_INCOMPLETE = 'bg-slate-200'

const STAGE_FILL: Record<string, string> = {
  filing: 'bg-blue-500',
  rootCause: 'bg-amber-500',
  corrective: 'bg-indigo-500',
  closed: 'bg-green-600',
}

const COMPACT_STAGE_LABEL: Record<string, string> = {
  filing: '立案',
  rootCause: '原因',
  corrective: '矯正',
  closed: '結案',
}

interface NcrReportProgressBarProps {
  stages: NcrReportStageProgress[]
  compact?: boolean
  className?: string
}

export function NcrReportProgressBar({ stages, compact = false, className = '' }: NcrReportProgressBarProps) {
  if (compact) {
    const done = stages.filter((stage) => stage.complete).length
    const next = stages.find((stage) => !stage.complete)
    const detail = stages.map((stage) => `${stage.label}${stage.statusLabel}`).join('、')
    return (
      <div className={className} role="group" aria-label={`QR-28-03 填寫進度：${detail}`} title={detail}>
        <div className="grid grid-cols-4 gap-1" aria-hidden>
          {stages.map((stage) => (
            <div key={stage.id} className={`h-2 rounded-sm ${stage.complete ? STAGE_FILL[stage.id] : STAGE_INCOMPLETE}`} />
          ))}
        </div>
        <p className="mt-1 whitespace-nowrap text-xs text-muted" aria-hidden>
          {done}/{stages.length}
          {next ? ` · 待${COMPACT_STAGE_LABEL[next.id] ?? next.label}` : ' · 已結案'}
        </p>
      </div>
    )
  }
  return (
    <div
      className={`grid grid-cols-4 gap-1 ${className}`}
      role="group"
      aria-label="QR-28-03 填寫進度"
    >
      {stages.map((stage) => (
        <div key={stage.id} className="min-w-0">
          <div
            className={`h-2 rounded-sm ${stage.complete ? STAGE_FILL[stage.id] : STAGE_INCOMPLETE}`}
            aria-hidden
          />
          <p className="mt-1 text-center text-xs text-muted">
            <span className="font-bold text-ink">{stage.label}</span>
            <span className="mx-1">·</span>
            <span>{stage.statusLabel}</span>
          </p>
        </div>
      ))}
    </div>
  )
}
