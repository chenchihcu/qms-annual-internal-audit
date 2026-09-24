import type { AppState, TabId } from '../../types'
import { getTabWorkflow } from '../../lib/navigation'
import { getTabWorkflowStatus } from '../../lib/workflowStatus'

interface WorkflowGuideProps {
  tab: TabId
  state: AppState
}

export function WorkflowGuide({ tab, state }: WorkflowGuideProps) {
  if (!getTabWorkflow(tab)) return null

  const status = getTabWorkflowStatus(state, tab)
  if (status.gaps.length === 0 && status.advisories.length === 0) return null

  return (
    <div className="mb-4 rounded-lg border border-line bg-surface px-3 py-2.5 no-print" data-workflow-guide="top">
      <ul className="space-y-0.5 text-xs text-amber-900">
        {status.gaps.map((gap) => (
          <li key={gap.message}>待完成：{gap.message}</li>
        ))}
        {status.advisories.map((gap) => (
          <li key={gap.message} className="text-slate-600">提示：{gap.message}</li>
        ))}
      </ul>
    </div>
  )
}
