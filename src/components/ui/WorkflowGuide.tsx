import type { TabId } from '../../types'
import { getTabWorkflow, buildAppHash } from '../../lib/navigation'

interface WorkflowGuideProps {
  tab: TabId
  auditKey?: string
  position: 'top' | 'bottom'
}

export function WorkflowGuide({ tab, auditKey, position }: WorkflowGuideProps) {
  const workflow = getTabWorkflow(tab)
  if (!workflow) return null

  const prev = workflow.prevTab
  const next = workflow.nextTab

  if (position === 'top') {
    return (
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 no-print" data-workflow-guide="top">
        <p className="text-sm font-medium text-slate-800">{workflow.purpose}</p>
        <p className="mt-1 text-xs text-slate-500">
          起點：{workflow.entry} · 終點：{workflow.exit} · 輸出：{workflow.outputs}
        </p>
      </div>
    )
  }

  if (!prev && !next) return null

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 no-print"
      aria-label="工作流程導覽"
      data-workflow-guide="bottom"
    >
      {prev ? (
        <a
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50"
          href={buildAppHash(prev)}
        >
          ← 上一步：{getTabWorkflow(prev)?.label ?? prev}
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a
          className="min-h-11 rounded-lg border border-blue-600 bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          href={auditKey && next === 'audit' ? buildAppHash(next, auditKey) : buildAppHash(next)}
        >
          下一步：{getTabWorkflow(next)?.label ?? next} →
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}
