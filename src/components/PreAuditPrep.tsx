import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { TabId } from '../types'
import {
  EXTERNAL_AUDIT_PREP_SEED,
  effectiveExternalAuditDate,
  evaluatePrepSequence,
  hasManagementReviewMismatch,
  isLegacyCompanySpecificPrepText,
  workspacePrepText,
} from '../lib/externalAuditPrep'
import { buildMergedCertificateCoverage } from '../lib/coverage'
import { exportAllFormsExcel, exportPrepExcel } from '../lib/formExport'
import { FOCUS_RING } from '../lib/focusRing'
import type { NavigateOptions } from '../lib/navigation'
import { ACTION_ICONS } from '../lib/uiIcons'
import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
import { Button, Input } from './ui/Badge'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PrepTaskTable, type PrepFilter } from './PrepTaskTable'

const FILTER_OPTIONS: Array<{ value: PrepFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '未完成' },
  { value: 'done', label: '已完成' },
]

export function PreAuditPrep({
  store,
  onNavigate,
}: {
  store: AuditStore
  onNavigate?: (tab: TabId, options?: NavigateOptions) => void
}) {
  const {
    state,
    updateExternalPrepSequence,
    switchPrepYear,
  } = store
  const { settings, externalAuditPrep } = state
  const seed = EXTERNAL_AUDIT_PREP_SEED
  const [prepYearDraft, setPrepYearDraft] = useState<string | null>(null)
  const [pendingPrepYear, setPendingPrepYear] = useState<number | null>(null)
  const [showPrepYearEditor, setShowPrepYearEditor] = useState(false)
  const [filter, setFilter] = useState<PrepFilter>('all')
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
  const sequenceWarnings = evaluatePrepSequence({
    prep: externalAuditPrep,
    workspace: activeCompany,
    settings,
    yearArchives: state.yearArchives,
  })
  const managementReviewStatus = hasManagementReviewMismatch(externalAuditPrep)
    ? '待覆核'
    : externalAuditPrep.managementReviewComplete ? '已完成' : '未完成'
  // 種子要點原文保留；系統規則另於第 4 項、2-b／2-c 與外稽日期旁即時檢核。
  const generalNotes = [
    ...seed.sequenceRules
      .filter((rule) => !isLegacyCompanySpecificPrepText(rule))
      .map((rule) => workspacePrepText(rule)),
    ...seed.otherNotes
      .filter((note) => !isLegacyCompanySpecificPrepText(note))
      .map((note) => workspacePrepText(note)),
  ].filter((text) => text.length > 0)

  return (
    <div className="space-y-6 print-area qr-form">
      <div>
        <div className="mb-4 flex flex-col gap-3 no-print xl:flex-row xl:items-start">
          <div className="min-w-0 w-full rounded-lg border border-line bg-page p-3 xl:w-auto xl:flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink">
              <span className="font-bold text-muted">稽核序位</span>
              <span>
                1 內稽
                {derivedInternalComplete ? '已覆蓋' : `缺口 ${internalGapCount}`}
              </span>
              <span>2 管審 {managementReviewStatus}（第 4 項勾選）</span>
              <span>
                3 外稽
                {effectiveExternalAuditDate(externalAuditPrep, settings) || '日期待填'}
              </span>
            </div>
            {sequenceWarnings.sequenceMessages.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-sm text-tone-warning-fg" role="status">
                {sequenceWarnings.sequenceMessages.map((message) => <li key={message}>{message}</li>)}
              </ul>
            )}
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
            </div>
          </div>
        </div>

        {derivedInternalComplete && !externalAuditPrep.managementReviewComplete && (
          <div className="mb-4 rounded-lg border border-tone-warning-line bg-tone-warning-bg px-4 py-3 text-sm text-tone-warning-fg no-print">
            <p className="font-bold">提示：內部稽核已完成</p>
            <p className="mt-1">請匯出內部稽核總結報告（包含所有稽核紀錄與表單），提交管理階層進行審查；落實後請勾選第 4 項。</p>
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

        <div className="mb-2 flex flex-wrap items-center gap-2 no-print" role="group" aria-label="準備事項篩選">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              className={`min-h-9 rounded-lg border px-3 text-sm ${FOCUS_RING} ${filter === option.value
                ? 'border-primary bg-tone-info-bg font-bold text-tone-info-fg'
                : 'border-line bg-surface text-ink hover:bg-page'}`}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <PrepTaskTable
          store={store}
          filter={filter}
          ariaLabel="外部稽核前準備清單"
          onNavigate={onNavigate}
        />

        <details className="mt-4 no-print">
          <summary className={`cursor-pointer text-sm font-bold ${FOCUS_RING}`}>
            外稽通則（{generalNotes.length} 條）
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm" aria-label="外稽通則">
            {generalNotes.map((text) => <li key={text}>{text}</li>)}
          </ol>
        </details>
        <div className="print-only mt-4">
          <p className="text-sm font-bold">外稽通則</p>
          <ol className="list-decimal pl-6 text-sm">
            {generalNotes.map((text) => <li key={text}>{text}</li>)}
          </ol>
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
