import type { AuditStore } from '../hooks/useAuditStore'
import type { ExternalAuditPrepItemState, TabId } from '../types'
import {
  MANAGEMENT_REVIEW_PREP_ITEM_ID,
  effectiveExternalAuditDate,
  evaluatePrepSequence,
  getManagementReviewCompletionBlockers,
  getPrepTemplateForState,
  hasManagementReviewMismatch,
  prepItemCompleted,
  workspacePrepNotes,
  workspacePrepText,
} from '../lib/externalAuditPrep'
import { FOCUS_RING } from '../lib/focusRing'
import type { NavigateOptions } from '../lib/navigation'
import { prepLinkedAudits, prepSystemHints } from '../lib/prepLinks'
import { ScrollRegion } from './ui/ScrollRegion'

export type PrepFilter = 'all' | 'open' | 'done'

interface PrepTaskTableProps {
  store: AuditStore
  /** 只列出這些準備事項；未指定時列出全部。 */
  itemIds?: string[]
  filter?: PrepFilter
  /** 顯示「關聯查檢」欄（查檢表內的關聯清單不需要）。 */
  showLinks?: boolean
  ariaLabel: string
  onNavigate?: (tab: TabId, options?: NavigateOptions) => void
}

/**
 * 外稽準備任務表（外稽準備檢視與查檢表關聯清單共用）。
 * 只寫 `externalAuditPrep`；完成狀態與查檢判定互不影響。
 */
export function PrepTaskTable({
  store,
  itemIds,
  filter = 'all',
  showLinks = true,
  ariaLabel,
  onNavigate,
}: PrepTaskTableProps) {
  const { state, updateExternalPrepItem, setManagementReviewComplete } = store
  const { externalAuditPrep: prep, settings, workspace } = state
  const hints = prepSystemHints(state)
  const sequence = evaluatePrepSequence({ prep, workspace, settings, yearArchives: state.yearArchives })
  const managementReviewBlockers = getManagementReviewCompletionBlockers({
    internalAuditComplete: sequence.internalAuditComplete,
    managementReviewDate: settings.managementReviewDate,
    externalAuditDate: effectiveExternalAuditDate(prep, settings),
  })
  const managementReviewMismatch = hasManagementReviewMismatch(prep)
  const rows = prep.items
    .map((itemState, index) => ({ itemState, displayNo: index + 1, template: getPrepTemplateForState(itemState) }))
    .filter((row) => row.template && (!itemIds || itemIds.includes(row.itemState.id)))

  const completionFor = (itemState: ExternalAuditPrepItemState) => prepItemCompleted(prep, itemState)
  const matchesFilter = (itemState: ExternalAuditPrepItemState) => {
    if (filter === 'all') return true
    const done = completionFor(itemState)
    return filter === 'done' ? done : !done
  }

  return (
    <ScrollRegion ariaLabel={ariaLabel}>
      <table className="qr-checklist worksheet-table print-prep-checklist min-w-[48rem]">
        <colgroup>
          <col className="col-seq col-print-seq" />
          <col className="col-print-prep-title" />
          <col className="col-name col-print-name" />
          {showLinks && <col className="col-prep-link col-print-prep-link" />}
          <col className="col-prep-done col-print-done" />
          <col className="col-print-prep-remark" />
        </colgroup>
        <thead>
          <tr>
            <th>項次</th>
            <th>稽核前準備事項</th>
            <th>負責人</th>
            {showLinks && <th>關聯查檢／系統檢核</th>}
            <th className="text-center">完成</th>
            <th>備註/表單</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ itemState, displayNo, template }) => {
            const title = workspacePrepText(template!.title)
            const formsText = template!.forms
              .map(workspacePrepText)
              .filter((form) => form && !title.includes(form))
              .join('、')
            const notes = workspacePrepNotes(template!.notes)
            const remarkDisplay = [formsText, itemState.remark].filter(Boolean).join(' · ')
            const isManagementReview = itemState.id === MANAGEMENT_REVIEW_PREP_ITEM_ID
            const done = completionFor(itemState)
            const toggleBlocked = isManagementReview && !done && managementReviewBlockers.length > 0
            const hint = hints[itemState.id]
            const links = prepLinkedAudits(template!, workspace.planRows)
            const hidden = !matchesFilter(itemState)
            return (
              <tr
                key={itemState.id}
                className={`${hidden ? 'pagination-hidden-row ' : ''}${done ? 'bg-green-50/30' : ''}`}
              >
                <td className="text-center align-top font-normal">{displayNo}</td>
                <td className="align-top">
                  <div className="font-bold">{title}</div>
                  {formsText && <p className="mt-1 text-xs text-muted">{formsText}</p>}
                  {notes && <p className="mt-1 text-xs text-muted">{notes}</p>}
                  {!showLinks && hint && (
                    <p className={`mt-1 text-xs ${hint.tone === 'warn' ? 'text-tone-warning-fg' : 'text-tone-success-fg'}`}>
                      系統檢核：{hint.text}
                    </p>
                  )}
                </td>
                <td className="align-top">{template!.owner}</td>
                {showLinks && (
                  <td className="align-top text-xs">
                    <ul className="space-y-0.5">
                      {links.map((link) => (
                        <li key={`${link.qpCode}|${link.departmentId ?? link.department}`}>
                          {link.auditKey && onNavigate ? (
                            <button
                              type="button"
                              className={`text-left text-link hover:underline ${FOCUS_RING}`}
                              onClick={() => onNavigate('audit', { auditKey: link.auditKey })}
                            >
                              {link.qpCode} {link.department}
                            </button>
                          ) : (
                            <span>{link.qpCode} {link.department}{link.auditKey ? '' : '（計畫無此列）'}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {hint && (
                      <p className={`mt-1 ${hint.tone === 'warn' ? 'text-tone-warning-fg' : 'text-tone-success-fg'}`}>
                        {hint.target && onNavigate ? (
                          <button
                            type="button"
                            className={`text-left underline-offset-2 hover:underline ${FOCUS_RING}`}
                            onClick={() => onNavigate(hint.target!)}
                          >
                            {hint.text}
                          </button>
                        ) : hint.text}
                      </p>
                    )}
                  </td>
                )}
                <td className="text-center align-top">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className={`no-print h-4 w-4 ${FOCUS_RING}`}
                      checked={done}
                      disabled={toggleBlocked}
                      aria-label={toggleBlocked
                        ? `第 ${displayNo} 項 ${title} 已完成，尚缺：${managementReviewBlockers.join('；')}`
                        : `第 ${displayNo} 項 ${title} 已完成`}
                      onChange={(event) => (isManagementReview
                        ? setManagementReviewComplete(event.target.checked)
                        : updateExternalPrepItem(itemState.id, { completed: event.target.checked }))}
                    />
                    <span className="whitespace-nowrap text-xs">{done ? '已完成' : '未完成'}</span>
                  </label>
                  {isManagementReview && managementReviewMismatch && (
                    <p className="mt-1 text-left text-xs text-tone-warning-fg" role="status">
                      待覆核：舊資料第 4 項為「{itemState.completed ? '已完成' : '未完成'}」、序位管審為「{prep.managementReviewComplete ? '已完成' : '未完成'}」；重新勾選即同步。
                    </p>
                  )}
                </td>
                <td className="align-top">
                  <input
                    className={`w-full rounded border border-line px-2 py-1 text-sm no-print ${FOCUS_RING}`}
                    aria-label={`第 ${displayNo} 項備註`}
                    placeholder="備註"
                    value={itemState.remark}
                    onChange={(event) => updateExternalPrepItem(itemState.id, { remark: event.target.value })}
                  />
                  <span className="print-only text-xs">{remarkDisplay}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollRegion>
  )
}
