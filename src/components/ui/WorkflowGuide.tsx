import type { AppState, TabId } from '../../types'
import { getTabWorkflow, buildAppHash } from '../../lib/navigation'
import { getTabWorkflowStatus } from '../../lib/workflowStatus'

interface WorkflowGuideProps {
  tab: TabId
  state: AppState
  auditKey?: string
  position: 'top' | 'bottom'
}

const PDCA_LABELS: Record<string, string> = {
  overview: '總覽',
  P: 'P · 方案規劃',
  D: 'D · 稽核執行',
  C: 'C · 結果與改善',
  A: 'A · 結案與改進',
  system: '系統管理',
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
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 no-print" data-workflow-guide="top">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            {PDCA_LABELS[status.pdcaPhase] ?? status.pdcaPhase}
          </span>
          {status.pdcaPhase === 'overview' ? (
            status.advisories.some((gap) => gap.message.includes('年度結案條件已滿足')) ? (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">年度可結案</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">尚有年度缺口</span>
            )
          ) : status.ready ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">本頁終點已達</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">尚待完成</span>
          )}
        </div>
        <p className="mt-2 text-sm font-medium text-slate-800">{workflow.purpose}</p>
        <p className="mt-1 text-xs text-slate-500">
          起點：{workflow.entry} · 終點：{workflow.exit} · 輸出：{workflow.outputs}
        </p>
        {allGaps.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
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
      {next && nextHref ? (
        nextReady ? (
          <a
            className="min-h-11 rounded-lg border border-blue-600 bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            href={nextHref}
          >
            下一步：{nextLabel} →
          </a>
        ) : (
          <span
            className="min-h-11 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
            title={status.gaps[0]?.message || '請先完成本頁終點'}
            aria-disabled="true"
          >
            下一步：{nextLabel}（尚待完成）
          </span>
        )
      ) : (
        <span />
      )}
    </nav>
  )
}
