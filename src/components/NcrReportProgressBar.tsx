import type { NcrReportStageProgress } from '../lib/ncr'

const STAGE_INCOMPLETE = 'bg-slate-200 dark:bg-slate-700'

const STAGE_FILL: Record<string, string> = {
  filing: 'bg-blue-500 dark:bg-blue-600',
  rootCause: 'bg-amber-500 dark:bg-amber-600',
  corrective: 'bg-indigo-500 dark:bg-indigo-600',
  closed: 'bg-green-600 dark:bg-green-700',
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
          {compact ? (
            <p className="mt-1 truncate text-xs text-muted" title={`${stage.label} ${stage.statusLabel}`}>
              {COMPACT_STAGE_LABEL[stage.id] ?? stage.label}
              {stage.statusLabel}
            </p>
          ) : (
            <p className="mt-1 text-center text-xs text-muted">
              <span className="font-medium text-ink">{stage.label}</span>
              <span className="mx-1">·</span>
              <span>{stage.statusLabel}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
