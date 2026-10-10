import { FLOW_LINKS, TAB_GROUPS, getTabWorkflow, tabLabel } from '../lib/navigation'
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
      <figcaption className="mb-4 text-sm text-slate-600">
        依側欄作業順序。點步驟可開啟該頁；卡片列出產出與完成條件。外稽準備序位為內稽 → 管審 → 外稽。
      </figcaption>
      <ol className="space-y-2">
        {FLOW_GROUPS.map((group, groupIndex) => {
          const links = FLOW_LINKS.filter((link) => link.group === group.label)
          return (
            <li key={group.label} className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-x-4">
              <p className="whitespace-nowrap text-xs font-bold text-slate-600 sm:pt-3.5">{group.label}</p>
              <div className="min-w-0 space-y-2">
                <ol className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                  {group.tabs.map((tab, tabIndex) => {
                    const workflow = getTabWorkflow(tab.id)
                    return (
                      <li key={tab.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {tabIndex > 0 && (
                          <span aria-hidden="true" className="ps-4 text-slate-400 sm:ps-0">
                            <span className="sm:hidden">↓</span>
                            <span className="hidden sm:inline">→</span>
                          </span>
                        )}
                        <div className="flex h-full w-full flex-col rounded-lg border border-slate-300 bg-white sm:w-52">
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center rounded-t-lg px-3 text-left text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                            onClick={() => onNavigate?.(tab.id)}
                          >
                            {tab.label}
                          </button>
                          {workflow && (
                            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                              <dt className="font-bold text-slate-500">產出</dt>
                              <dd className="break-words">{workflow.outputs}</dd>
                              <dt className="font-bold text-slate-500">完成</dt>
                              <dd className="break-words">{workflow.exit}</dd>
                            </dl>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
                {links.length > 0 && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p className="font-bold text-slate-500">{group.label.startsWith('A') ? '回饋' : '資料流'}</p>
                    <ul className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
                      {links.map((link) => (
                        <li key={link.via + link.from.join()}>
                          {link.from.map(tabLabel).join('／')}：{link.via}
                          {link.to && ` → ${tabLabel(link.to)}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {groupIndex < FLOW_GROUPS.length - 1 && (
                <p aria-hidden="true" className="ps-4 text-slate-400 sm:col-start-2">↓</p>
              )}
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
