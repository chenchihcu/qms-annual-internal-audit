import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { ExternalAuditPrepItemState } from '../types'
import {
  EXTERNAL_AUDIT_PREP_SEED,
  countPrepProgress,
  evaluatePrepSequence,
  getManagementReviewCompletionBlockers,
  getPrepTemplateForState,
  isLegacyCompanySpecificPrepText,
  itemHasCallout,
  workspacePrepNotes,
  workspacePrepText,
} from '../lib/externalAuditPrep'
import { buildMergedCertificateCoverage } from '../lib/coverage'
import { exportPrepExcel } from '../lib/formExport'
import { buildAppHash } from '../lib/navigation'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Button, Input } from './ui/Badge'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { ScrollRegion } from './ui/ScrollRegion'

function CalloutBadge({ type }: { type: 'quality-objectives' | 'risk-climate' | 'satisfaction' }) {
  const config = {
    'quality-objectives': {
      className: 'border-blue-200 bg-blue-50 text-blue-900',
      text: '品質目標統計須至稽核前一個月；初次稽核至少 3 個月資料；未達成須有因應處置。',
    },
    'risk-climate': {
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      text: '氣候變遷須納入風險評估；當年改善措施評估結果隔年再填。',
    },
    satisfaction: {
      className: 'border-rose-200 bg-rose-50 text-rose-900',
      text: '保留適用客戶、調查期間、結果分析及必要改善的佐證。',
    },
  }[type]

  return (
    <p className={`mt-2 rounded-md border px-2 py-1.5 text-xs font-medium ${config.className}`}>
      {config.text}
    </p>
  )
}

function DoneCell({
  item,
  displayNo,
  itemTitle,
  onUpdate,
}: {
  item: ExternalAuditPrepItemState
  displayNo: number
  itemTitle: string
  onUpdate: (patch: Partial<ExternalAuditPrepItemState>) => void
}) {
  return (
    <td className="border p-2 text-center align-top">
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" className="no-print h-4 w-4" checked={item.completed}
          aria-label={`第 ${displayNo} 項 ${itemTitle} 已完成`}
          onChange={(event) => onUpdate({ completed: event.target.checked })} />
        <span className="print-only text-xs">{item.completed ? '■' : '□'}</span>
      </label>
    </td>
  )
}

export function PreAuditPrep({ store }: { store: AuditStore }) {
  const {
    state,
    updateExternalPrepItem,
    updateExternalPrepSequence,
    switchPrepYear,
  } = store
  const { settings, externalAuditPrep } = state
  const { done, total } = countPrepProgress(externalAuditPrep)
  const seed = EXTERNAL_AUDIT_PREP_SEED
  const [prepYearDraft, setPrepYearDraft] = useState<string | null>(null)
  const [pendingPrepYear, setPendingPrepYear] = useState<number | null>(null)
  const [showPrepYearEditor, setShowPrepYearEditor] = useState(false)
  const prepYearInput = prepYearDraft ?? String(externalAuditPrep.year)
  const prepYearMatchesLedger = externalAuditPrep.year === settings.auditYear

  const handlePrepYearDraftChange = (value: string) => {
    setPrepYearDraft(value)
    const year = Number(value)
    if (!Number.isInteger(year) || value.length !== 4 || year < 2000 || year > 2200) return
    if (year === externalAuditPrep.year) {
      setPrepYearDraft(null)
      setPendingPrepYear(null)
      return
    }
    setPendingPrepYear(year)
  }

  const confirmPrepYearSwitch = () => {
    if (pendingPrepYear == null) return
    switchPrepYear(pendingPrepYear)
    setPendingPrepYear(null)
    setPrepYearDraft(null)
    setShowPrepYearEditor(false)
  }

  const cancelPrepYearSwitch = () => {
    setPendingPrepYear(null)
    setPrepYearDraft(null)
  }

  const activeCompany = state.companies[state.activeCompanyId]
  const mergedCoverage = buildMergedCertificateCoverage(
    activeCompany,
    settings.auditYear,
    settings.scoringRules,
  )
  const derivedInternalComplete = mergedCoverage.allInternalAuditComplete
  const internalGapCount = mergedCoverage.gaps.length + mergedCoverage.dualPendingItems.length
  const managementReviewDate = settings.managementReviewDate?.trim() ?? ''
  const sequenceWarnings = evaluatePrepSequence({
    prep: externalAuditPrep,
    workspace: activeCompany,
    settings,
    yearArchives: state.yearArchives,
  })
  const effectiveExternalAuditDate =
    externalAuditPrep.externalAuditDate?.trim() || settings.externalAuditDate?.trim()
  const managementReviewCompletionBlockers = getManagementReviewCompletionBlockers({
    internalAuditComplete: sequenceWarnings.internalAuditComplete,
    managementReviewDate,
    externalAuditDate: effectiveExternalAuditDate,
  })
  const sequenceHasDetail =
    !derivedInternalComplete
    || managementReviewCompletionBlockers.length > 0
    || sequenceWarnings.sequenceMessages.length > 0
    || (externalAuditPrep.managementReviewComplete && !managementReviewDate)

  return (
    <div className="space-y-6 print-area qr-form">
      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold">外稽準備</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap items-end gap-3 no-print">
          {prepYearMatchesLedger && !showPrepYearEditor ? (
            <Button variant="secondary" onClick={() => setShowPrepYearEditor(true)}>
              改準備表年度
            </Button>
          ) : (
            <Input
              label="準備表年度"
              type="number"
              value={prepYearInput}
              onChange={(value) => handlePrepYearDraftChange(value)}
              ariaLabel="外稽準備表年度"
            />
          )}
          <Input
            label="外部稽核日期"
            type="date"
            value={externalAuditPrep.externalAuditDate ?? ''}
            onChange={(value) => updateExternalPrepSequence({ externalAuditDate: value })}
          />
            </div>
            <div className="flex items-center gap-2 no-print">
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportPrepExcel(state)}>匯出 Excel</Button>
              <span className="text-sm text-muted">準備清單 {done}/{total}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 no-print">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-800">
            <span className="font-semibold text-slate-700">稽核序位</span>
            <span>
              1 內稽
              {derivedInternalComplete ? '已覆蓋' : `缺口 ${internalGapCount}`}
            </span>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={externalAuditPrep.managementReviewComplete}
                disabled={!externalAuditPrep.managementReviewComplete && managementReviewCompletionBlockers.length > 0}
                aria-describedby={
                  !externalAuditPrep.managementReviewComplete && managementReviewCompletionBlockers.length > 0
                    ? 'management-review-completion-help'
                    : undefined
                }
                onChange={(e) =>
                  updateExternalPrepSequence({ managementReviewComplete: e.target.checked })
                }
              />
              <span>2 管審</span>
            </label>
            <span>
              3 外稽
              {effectiveExternalAuditDate || '日期待填'}
            </span>
          </div>
          {sequenceHasDetail && (
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              {!derivedInternalComplete && (
                <p>
                  內部稽核進度（唯讀）：
                  {`尚有 ${internalGapCount} 項缺口`}
                  <a className="ml-1 font-medium text-blue-700 underline" href={buildAppHash('dashboard')}>
                    至稽核總覽
                  </a>
                </p>
              )}
              <p>
                管審日期：
                {managementReviewDate || '尚未填寫'}
                <a className="ml-1 font-medium text-blue-700 underline" href={buildAppHash('plan')}>
                  至年度稽核計畫
                </a>
              </p>
              {externalAuditPrep.managementReviewComplete && !managementReviewDate && (
                <p className="font-medium text-amber-800" role="status">
                  已勾選管審，但年度計畫尚未填管審日期
                </p>
              )}
              {!externalAuditPrep.managementReviewComplete && managementReviewCompletionBlockers.length > 0 && (
                <p
                  id="management-review-completion-help"
                  className="text-amber-800"
                  role="status"
                >
                  尚缺：{managementReviewCompletionBlockers.join('；')}。
                </p>
              )}
              {sequenceWarnings.sequenceMessages.length > 0 && (
                <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900" role="alert">
                  {sequenceWarnings.sequenceMessages.map((message) => <p key={message}>{message}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <PrintDocHeader
          companyName="年度內部稽核工作區"
          auditYear={externalAuditPrep.year}
          formTitle={workspacePrepText(seed.title)}
        />

        <ScrollRegion ariaLabel="外部稽核前準備清單">
          <table className="qr-checklist worksheet-table min-w-[31rem]">
            <colgroup>
              <col className="col-seq" />
              <col />
              <col className="col-name" />
              <col className="col-done" />
              <col />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border p-2">項次</th>
                <th className="border p-2">稽核前準備事項</th>
                <th className="border p-2">負責人</th>
                <th className="border p-2 text-center">完成</th>
                <th className="border p-2">備註/表單</th>
              </tr>
            </thead>
            <tbody>
              {externalAuditPrep.items.map((itemState, index) => {
                const template = getPrepTemplateForState(itemState)
                if (!template) return null
                const displayNo = index + 1
                const done = itemState.completed
                const callout = itemHasCallout(template.no)
                const title = workspacePrepText(template.title)
                const formsText = template.forms
                  .map(workspacePrepText)
                  .filter((form) => form && !title.includes(form))
                  .join('、')
                const remarkDisplay = [formsText, itemState.remark].filter(Boolean).join(' · ')
                const notes = workspacePrepNotes(template.notes)

                return (
                  <tr key={itemState.id} className={done ? 'bg-green-50/30' : ''}>
                    <td className="border p-2 text-center align-top font-medium">{displayNo}</td>
                    <td className="border p-2 align-top">
                      <div className="font-medium">{title}</div>
                      {formsText && (
                        <p className="mt-1 text-xs text-slate-600">{formsText}</p>
                      )}
                      {notes && (
                        <p className="mt-1 text-xs text-slate-500">{notes}</p>
                      )}
                      {callout && <CalloutBadge type={callout} />}
                    </td>
                    <td className="border p-2 align-top text-xs">{template.owner}</td>
                    <DoneCell
                      item={itemState}
                      displayNo={displayNo}
                      itemTitle={title}
                      onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                    />
                    <td className="border p-2 align-top">
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs no-print"
                        aria-label={`第 ${displayNo} 項備註`}
                        placeholder="備註"
                        value={itemState.remark}
                        onChange={(e) =>
                          updateExternalPrepItem(itemState.id, { remark: e.target.value })
                        }
                      />
                      <span className="print-only text-xs">{remarkDisplay}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollRegion>

        {/* 序位規則摘要 */}
        <details className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">稽核要點</summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
            {seed.sequenceRules.filter((rule) => !isLegacyCompanySpecificPrepText(rule)).map((rule) => (
              <li key={rule}>{workspacePrepText(rule)}</li>
            ))}
          </ul>
        </details>

        {/* 頁尾 otherNotes */}
        <details className="mt-4 border-t border-slate-200 pt-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">其他注意事項</summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
            {seed.otherNotes.filter((note) => !isLegacyCompanySpecificPrepText(note)).map((note) => (
              <li key={note}>{workspacePrepText(note)}</li>
            ))}
          </ul>
        </details>
      </div>
      {pendingPrepYear != null && (
        <ConfirmDialog
          open
          title={`切換外稽準備至 ${pendingPrepYear} 年？`}
          description={`切換後將載入 ${pendingPrepYear} 年準備進度；目前稽核台帳為 ${settings.auditYear} 年。`}
          confirmLabel="確認切換"
          onConfirm={confirmPrepYearSwitch}
          onCancel={cancelPrepYearSwitch}
        />
      )}
    </div>
  )
}
