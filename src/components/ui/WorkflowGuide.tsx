import type { AppState, TabId } from '../../types'
import { FOCUS_RING } from '../../lib/focusRing'
import { getTabWorkflow, tabLabel } from '../../lib/navigation'
import { getTabWorkflowStatus, type WorkflowGap } from '../../lib/workflowStatus'

interface WorkflowGuideProps {
  tab: TabId
  state: AppState
  onNavigate?: (tab: TabId) => void
}

function GapLine({
  gap,
  tone,
  onNavigate,
}: {
  gap: WorkflowGap
  tone: 'gap' | 'advisory'
  onNavigate?: (tab: TabId) => void
}) {
  const prefix = tone === 'gap' ? '待完成：' : '提示：'
  const targetTab = gap.tab
  const canNavigate = Boolean(targetTab && onNavigate)

  return (
    <li className={tone === 'advisory' ? 'text-slate-600' : undefined}>
      {prefix}
      {gap.message}
      {canNavigate && (
        <>
          {' '}
          <button
            type="button"
            className={`font-medium text-primary hover:underline ${FOCUS_RING}`}
            onClick={() => onNavigate!(targetTab!)}
          >
            至{tabLabel(targetTab!)}
          </button>
        </>
      )}
    </li>
  )
}

export function WorkflowGuide({ tab, state, onNavigate }: WorkflowGuideProps) {
  if (tab === 'dashboard' || !getTabWorkflow(tab)) return null

  const status = getTabWorkflowStatus(state, tab)
  if (status.gaps.length === 0 && status.advisories.length === 0) return null

  return (
    <div className="mb-4 rounded-lg border border-line bg-surface px-3 py-2.5 no-print" data-workflow-guide="top">
      <ul className="space-y-0.5 text-xs text-amber-900">
        {status.gaps.map((gap) => (
          <GapLine key={gap.message} gap={gap} tone="gap" onNavigate={onNavigate} />
        ))}
        {status.advisories.map((gap) => (
          <GapLine key={gap.message} gap={gap} tone="advisory" onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  )
}
