import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { TabId, WorkspaceMigrationConflict } from '../types'

function destination(conflict: WorkspaceMigrationConflict): TabId {
  switch (conflict.target.kind) {
    case 'plan':
    case 'department': return 'plan'
    case 'person': return 'personnel'
    case 'checklist':
    case 'audit': return 'audit'
    case 'prep': return 'prep'
    case 'settings': return 'system-settings'
    case 'manual': return 'system-settings'
  }
}

export function WorkspaceMigrationReview({
  store,
  onNavigate,
}: {
  store: AuditStore
  onNavigate: (tab: TabId) => void
}) {
  const conflicts = store.state.workspaceMigrationConflicts ?? []
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({})
  if (conflicts.length === 0) return null

  return (
    <details className="rounded-xl border border-amber-300 bg-amber-50" open>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-amber-950">
        資料待覆核 · {conflicts.length} 項
      </summary>
      <div className="space-y-3 border-t border-amber-200 p-4">
        <p className="text-sm text-amber-950">
          系統只自動合併一致資料。每項確認後才會解除提醒；待覆核的查檢判定不計分。
        </p>
        <ul className="space-y-3">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="rounded-lg border border-amber-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-ink">{conflict.title}</h3>
              <p className="mt-1 text-sm leading-5 text-slate-700">{conflict.summary}</p>
              {conflict.candidates?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {conflict.candidates.map((candidate, index) => (
                    <button
                      key={`${conflict.id}-${index}`}
                      type="button"
                      className="min-h-10 rounded-lg border border-line bg-white px-3 py-2 text-left text-sm font-medium text-ink hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      onClick={() => store.resolveWorkspaceConflict(conflict.id, index)}
                    >
                      採用：{candidate.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="min-h-10 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
                    onClick={() => onNavigate(destination(conflict))}
                  >
                    前往相關頁面整理
                  </button>
                  <label className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(acknowledged[conflict.id])}
                      onChange={(event) => setAcknowledged((current) => ({ ...current, [conflict.id]: event.target.checked }))}
                    />
                    已核對並整理資料
                  </label>
                  <button
                    type="button"
                    className="min-h-10 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!acknowledged[conflict.id]}
                    onClick={() => store.resolveWorkspaceConflict(conflict.id)}
                  >
                    完成覆核
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
