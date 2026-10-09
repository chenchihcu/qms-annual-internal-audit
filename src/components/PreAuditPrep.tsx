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
import { exportAllFormsExcel, exportPrepExcel } from '../lib/formExport'
import { ACTION_ICONS } from '../lib/uiIcons'
import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
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
    <p className={`mt-2 rounded-md border px-2 py-1.5 text-xs font-normal ${config.className}`}>
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
    <td className="text-center align-top">
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

  const activeCompany = state.workspace
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
  const auditPointRows = [
    ...seed.sequenceRules
      .filter((rule) => !isLegacyCompanySpecificPrepText(rule))
      .map((rule) => workspacePrepText(rule)),
    ...seed.otherNotes
      .filter((note) => !isLegacyCompanySpecificPrepText(note))
      .map((note) => workspacePrepText(note)),
    ...sequenceWarnings.sequenceMessages,
  ].filter((text) => text.length > 0)

  return (
    <div className="space-y-6 print-area qr-form">
      <div>
        <div className="mb-4 flex flex-col gap-3 no-print min-[720px]:flex-row min-[720px]:items-start">
        <div className="min-w-0 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 min-[720px]:w-auto min-[720px]:flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-800">
            <span className="font-bold text-slate-700">稽核序位</span>
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
                aria-label={
                  !externalAuditPrep.managementReviewComplete && managementReviewCompletionBlockers.length > 0
                    ? `2 管審，尚缺：${managementReviewCompletionBlockers.join('；')}`
                    : '2 管審'
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
        </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap items-end gap-3">
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
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportPrepExcel(state)}>匯出 Excel</Button>
              <span className="text-sm text-muted">準備清單 {done}/{total}</span>
            </div>
          </div>
        </div>

        {derivedInternalComplete && !externalAuditPrep.managementReviewComplete && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 no-print">
            <p className="font-bold">提示：內部稽核已完成</p>
            <p className="mt-1">請匯出內部稽核總結報告（包含所有稽核紀錄與表單），提交管理階層進行審查；落實後請於上方勾選「2 管審」。</p>
            <div className="mt-3">
              <Button onClick={() => exportAllFormsExcel(state, WORKSPACE_COMPANY_ID)}>
                匯出內部稽核總結報告 (全表單)
              </Button>
            </div>
          </div>
        )}

        <PrintDocHeader
          companyName="年度內部稽核工作區"
          auditYear={externalAuditPrep.year}
          formTitle={workspacePrepText(seed.title)}
        />

        <ScrollRegion ariaLabel="外部稽核前準備清單">
          <table className="qr-checklist worksheet-table print-prep-checklist min-w-[31rem]">
            <colgroup>
              <col className="col-seq col-print-seq" />
              <col className="col-print-prep-title" />
              <col className="col-name col-print-name" />
              <col className="col-done col-print-done" />
              <col className="col-print-prep-remark" />
            </colgroup>
            <thead>
              <tr>
                <th >項次</th>
                <th >稽核前準備事項</th>
                <th >負責人</th>
                <th className="text-center">完成</th>
                <th >備註/表單</th>
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
                    <td className="text-center align-top font-normal">{displayNo}</td>
                    <td className="align-top">
                      <div className="font-bold">{title}</div>
                      {formsText && (
                        <p className="mt-1 text-xs text-slate-600">{formsText}</p>
                      )}
                      {notes && (
                        <p className="mt-1 text-xs text-slate-500">{notes}</p>
                      )}
                      {callout && <CalloutBadge type={callout} />}
                    </td>
                    <td className="align-top">{template.owner}</td>
                    <DoneCell
                      item={itemState}
                      displayNo={displayNo}
                      itemTitle={title}
                      onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                    />
                    <td className="align-top">
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm no-print"
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

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold">稽核要點</h3>
          <table className="worksheet-table min-w-[11rem]" aria-label="稽核要點">
            <colgroup>
              <col className="col-seq" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>項次</th>
                <th>要點</th>
              </tr>
            </thead>
            <tbody>
              {auditPointRows.map((text, index) => (
                <tr key={`${index}-${text}`}>
                  <td className="text-center">{index + 1}</td>
                  <td>{text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
