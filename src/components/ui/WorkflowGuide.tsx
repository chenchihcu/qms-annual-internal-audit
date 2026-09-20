import type { AppState, TabId } from '../../types'
import { getTabWorkflow, buildAppHash } from '../../lib/navigation'
import { getTabWorkflowStatus } from '../../lib/workflowStatus'
import { TAB_ICONS } from '../../lib/uiIcons'
import { Icon } from './Icon'

interface WorkflowGuideProps {
  tab: TabId
  state: AppState
  auditKey?: string
  position: 'top' | 'bottom'
}

export function WorkflowGuide({ tab, state, auditKey, position }: WorkflowGuideProps) {
  const workflow = getTabWorkflow(tab)
  if (!workflow) return null

  const status = getTabWorkflowStatus(state, tab)
  const prev = workflow.prevTab
  const next = workflow.nextTab
  const nextReady = next ? getTabWorkflowStatus(state, tab).ready : true

  if (position === 'top') {
    const allGaps = [...status.gaps, ...status.advisories]

    return (
      <div className="mb-4 rounded-lg border border-line bg-surface px-3 py-2.5 no-print" data-workflow-guide="top">
        <p className="text-sm font-medium text-ink">{workflow.purpose}</p>
        {allGaps.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-xs text-amber-900">
            {status.gaps.map((gap) => (
              <li key={gap.message}>待完成：{gap.message}</li>
            ))}
            {status.advisories.map((gap) => (
              <li key={gap.message} className="text-slate-600">提示：{gap.message}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (!prev && !next) return null

  const nextLabel = next ? getTabWorkflow(next)?.label ?? next : ''
  const nextHref = next
    ? (auditKey && next === 'audit' ? buildAppHash(next, auditKey) : buildAppHash(next))
    : undefined
  const nextIcon = next ? TAB_ICONS[next] : undefined

  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2 no-print dark:bg-slate-800/40"
      aria-label="工作流程導覽"
      data-workflow-guide="bottom"
    >
      {prev ? (
        <a
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-brand hover:bg-blue-50"
          href={buildAppHash(prev)}
        >
          <Icon name="chevronLeft" />
          上一步：{getTabWorkflow(prev)?.label ?? prev}
        </a>
      ) : (
        <span />
      )}
      {next && nextHref ? (
        nextReady ? (
          <a
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            href={nextHref}
          >
            下一步：{nextLabel}
            {nextIcon && <Icon name={nextIcon} />}
            <Icon name="chevronRight" />
          </a>
        ) : (
          <span
            className="inline-flex min-h-10 cursor-not-allowed items-center gap-1.5 rounded-lg border border-line bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-400"
            title={status.gaps[0]?.message || '請先完成本頁'}
            aria-disabled="true"
          >
            下一步：{nextLabel}（尚待完成）
            {nextIcon && <Icon name={nextIcon} />}
          </span>
        )
      ) : (
        <span />
      )}
    </nav>
  )
}
