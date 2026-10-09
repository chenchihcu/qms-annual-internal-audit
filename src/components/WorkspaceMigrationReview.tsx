import { useState } from 'react'
import { Button } from './ui/Badge'
import type { AuditStore } from '../hooks/useAuditStore'
import type { TabId, WorkspaceMigrationCandidate, WorkspaceMigrationConflict } from '../types'
import { FOCUS_RING } from '../lib/focusRing'

/** 只換畫面顯示用的欄位鍵；已存的衝突標題與候選值不改寫。 */
const FIELD_LABELS: Record<string, string> = {
  description: '發現說明',
  sampleSize: '抽樣數',
  objectiveEvidence: '客觀證據',
  notApplicableReason: '不適用理由',
  evidenceReference: '證據引用',
  auditDate: '稽核日期',
  notifyDate: '通知日期',
  departmentManager: '被稽核部門主管',
  auditors: '稽核人員',
}

const FIELD_KEY_RE = new RegExp(`\\b(${Object.keys(FIELD_LABELS).join('|')})\\b`, 'g')

function displayFieldText(text: string): string {
  return text.replace(FIELD_KEY_RE, (key) => FIELD_LABELS[key] ?? key)
}

function candidateContent(candidate: WorkspaceMigrationCandidate): string {
  const prefix = `${candidate.source}：`
  return candidate.label.startsWith(prefix) ? candidate.label.slice(prefix.length) : candidate.label
}

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
    <details className="rounded-xl border border-tone-warning-line bg-tone-warning-bg" open>
      <summary className={`cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-tone-warning-fg ${FOCUS_RING}`}>
        資料待覆核 · {conflicts.length} 項
      </summary>
      <div className="space-y-3 border-t border-tone-warning-line p-4">
        <p className="text-sm text-tone-warning-fg">
          系統只自動合併一致資料。每項確認後才會解除提醒；待覆核的查檢判定不計分。
        </p>
        <ul className="space-y-3">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="rounded-lg border border-tone-warning-line bg-surface p-3">
              <h3 className="text-sm font-bold text-ink">{displayFieldText(conflict.title)}</h3>
              <p className="mt-1 text-sm leading-5 text-muted">{displayFieldText(conflict.summary)}</p>
              {conflict.candidates?.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {conflict.candidates.map((candidate, index) => (
                    <section
                      key={`${conflict.id}-${index}`}
                      aria-label={`${candidate.source}內容`}
                      className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-3"
                    >
                      <h4 className="text-xs font-bold text-muted">{candidate.source}</h4>
                      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-ink">{candidateContent(candidate)}</p>
                      <Button
                        variant="secondary"
                        className="self-start"
                        aria-label={`採用${candidate.source}：${candidateContent(candidate)}`}
                        onClick={() => store.resolveWorkspaceConflict(conflict.id, index)}
                      >
                        採用此內容
                      </Button>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={() => onNavigate(destination(conflict))}>
                    前往相關頁面整理
                  </Button>
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      className={`size-5 ${FOCUS_RING}`}
                      checked={Boolean(acknowledged[conflict.id])}
                      onChange={(event) => setAcknowledged((current) => ({ ...current, [conflict.id]: event.target.checked }))}
                    />
                    已核對並整理資料
                  </label>
                  <Button disabled={!acknowledged[conflict.id]} onClick={() => store.resolveWorkspaceConflict(conflict.id)}>
                    完成覆核
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
