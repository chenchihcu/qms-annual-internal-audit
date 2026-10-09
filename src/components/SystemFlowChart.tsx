import { TAB_GROUPS, TAB_WORKFLOW } from '../lib/navigation'
import type { TabId } from '../types'

const FLOW_GROUPS = TAB_GROUPS
  .map((group) => ({
    label: group.label,
    tabs: group.tabs.filter((tab) => tab.id !== 'system-settings'),
  }))
  .filter((group) => group.tabs.length > 0)

export function SystemFlowChart({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  return (
    <figure aria-label="系統作業流程" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <figcaption className="mb-4 text-sm text-slate-600">依側欄作業順序。點步驟可開啟該頁。外稽準備序位為內稽 → 管審 → 外稽。</figcaption>
      <ol className="space-y-2">
        {FLOW_GROUPS.map((group, groupIndex) => (
          <li key={group.label} className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-x-4">
            <p className="whitespace-nowrap text-xs font-bold text-slate-600 sm:pt-3.5">{group.label}</p>
            <ol className="flex min-w-0 flex-wrap items-center gap-2">
              {group.tabs.map((tab, tabIndex) => {
                const workflow = TAB_WORKFLOW.find((item) => item.id === tab.id)
                return (
                  <li key={tab.id} className="flex items-center gap-2">
                    {tabIndex > 0 && <span aria-hidden="true" className="text-slate-400">→</span>}
                    <button
                      type="button"
                      title={workflow?.exit}
                      className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                      onClick={() => onNavigate?.(tab.id)}
                    >
                      {tab.label}
                    </button>
                  </li>
                )
              })}
            </ol>
            {groupIndex < FLOW_GROUPS.length - 1 && (
              <p aria-hidden="true" className="ps-4 text-slate-400 sm:col-start-2">↓</p>
            )}
          </li>
        ))}
      </ol>
    </figure>
  )
}
