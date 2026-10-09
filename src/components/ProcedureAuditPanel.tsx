import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { useDepartmentOwnerConfirm } from '../hooks/useDepartmentOwnerConfirm'
import { DepartmentOwnerField } from './DepartmentOwnerField'
import { DepartmentOwnerConfirm } from './DepartmentOwnerConfirm'
import { markAuditNotified } from '../lib/auditNotice'
import {
  getChecklistDisplayCategory,
  getChecklistDisplayContent,
  isSeedChecklistItem,
} from '../lib/checklistItem'
import { FOCUS_RING } from '../lib/focusRing'
import { checkImpartiality } from '../lib/impartiality'
import { findNcrsForChecklistItem, isNcrStale, ncrNumberLabels } from '../lib/ncr'
import type { NavigateOptions } from '../lib/navigation'
import {
  evidenceFieldValue,
  optionalEvidenceFields,
  visibleEvidenceFields,
  type EvidenceField,
} from '../lib/checklistEvidence'
import { isChecklistItemPending } from '../lib/scoring'
import { formatScoreDisplay, scoreProcedureAudit } from '../lib/scoring'
import { canCompleteAuditReport } from '../lib/workflowStatus'
import { diagnoseChecklistSeed } from '../data/checklistLoader'
import { ImpartialityBanner } from './ui/ImpartialityBanner'
import type { ChecklistItem, Judgment, TabId } from '../types'
import { auditorCandidates, departmentMemberCandidates } from '../lib/personnel'
import { AuditorMultiSelect } from './ui/AuditorMultiSelect'
import { FormalRecordLocationDialog } from './FormalRecordLocationDialog'
import { Badge, Button, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'
import { PrepTaskTable } from './PrepTaskTable'
import { prepTemplatesForAudit } from '../lib/prepLinks'
import { prepItemCompleted } from '../lib/externalAuditPrep'

const JUDGMENTS: Judgment[] = ['符合', '不符', '觀察', '不適用']

const EVIDENCE_FIELD_LABELS: Record<EvidenceField, string> = {
  description: '發現說明',
  sampleSize: '抽樣數',
  objectiveEvidence: '客觀證據',
  notApplicableReason: '不適用理由',
}

const INLINE_LABEL = 'shrink-0 whitespace-nowrap text-sm font-bold text-ink'

interface ProcedureAuditPanelProps {
  store: AuditStore
  selectedKey?: string
  onSelectedKeyChange?: (key: string) => void
  onNavigate?: (tab: TabId, options?: NavigateOptions) => void
}

export function ProcedureAuditPanel({
  store,
  selectedKey: selectedKeyProp,
  onSelectedKeyChange,
  onNavigate,
}: ProcedureAuditPanelProps) {
  const {
    state,
    getOrCreateAudit,
    updateAudit,
    updateChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    getProcedureTitle,
    startAudit,
    validateAuditStart,
    updateCompanyAuditProfile,
  } = store

  const { company, settings } = state
  const auditOptions = useMemo(
    () =>
      company.planRows.map((row) => ({
        value: `${row.qpCode}|${row.departmentId}`,
        label: `${row.qpCode} ${getProcedureTitle(row.qpCode, row.department)} · ${row.department}`,
      })),
    [company.planRows, getProcedureTitle],
  )

  const [internalKey, setInternalKey] = useState(auditOptions[0]?.value ?? '')
  const selectedKey = selectedKeyProp ?? internalKey
  const setSelectedKey = (key: string) => {
    setInternalKey(key)
    onSelectedKeyChange?.(key)
  }

  const [deleteTarget, setDeleteTarget] = useState<{ itemId: string; isNonConform: boolean } | null>(
    null,
  )
  const [revealedEvidence, setRevealedEvidence] = useState<
    Record<string, Partial<Record<EvidenceField, boolean>>>
  >({})
  const ownerConfirm = useDepartmentOwnerConfirm(store)
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)

  const [qpCode, departmentId] = selectedKey.split('|')
  const persistedAudit =
    qpCode && departmentId
      ? company.audits.find((a) => a.qpCode === qpCode && a.departmentId === departmentId)
      : undefined
  const persistedReportReference = persistedAudit?.reportReference ?? ''
  const auditStateKey = persistedAudit?.id ?? selectedKey
  const [startFeedback, setStartFeedback] = useState({
    key: auditStateKey,
    errors: [] as string[],
    success: false,
    reportErrors: [] as string[],
  })
  if (startFeedback.key !== auditStateKey) {
    setStartFeedback({ key: auditStateKey, errors: [], success: false, reportErrors: [] })
  }
  const feedbackForAudit = startFeedback.key === auditStateKey
    ? startFeedback
    : { key: auditStateKey, errors: [], success: false, reportErrors: [] }
  const updateAuditFeedback = (patch: Partial<Omit<typeof feedbackForAudit, 'key'>>) => {
    setStartFeedback((current) => ({
      ...(current.key === auditStateKey
        ? current
        : { key: auditStateKey, errors: [], success: false, reportErrors: [] }),
      ...patch,
      key: auditStateKey,
    }))
  }
  const startErrors = feedbackForAudit.errors
  const startSuccess = feedbackForAudit.success
  const reportErrors = feedbackForAudit.reportErrors
  const setStartErrors = (errors: string[]) => updateAuditFeedback({ errors })
  const setStartSuccess = (success: boolean) => updateAuditFeedback({ success })
  const setReportErrors = (errors: string[]) => updateAuditFeedback({ reportErrors: errors })

  const [reportDraft, setReportDraft] = useState({
    key: auditStateKey,
    persistedReference: persistedReportReference,
    value: persistedReportReference,
  })
  if (reportDraft.key !== auditStateKey || reportDraft.persistedReference !== persistedReportReference) {
    setReportDraft({
      key: auditStateKey,
      persistedReference: persistedReportReference,
      value: persistedReportReference,
    })
  }
  const reportReferenceDraft = reportDraft.key === auditStateKey
    && reportDraft.persistedReference === persistedReportReference
    ? reportDraft.value
    : persistedReportReference
  const setReportReferenceDraft = (value: string) => setReportDraft({
    key: auditStateKey,
    persistedReference: persistedReportReference,
    value,
  })

  useEffect(() => {
    if (!qpCode || !departmentId) return
    const audit = getOrCreateAudit(qpCode, departmentId)
    if (audit !== persistedAudit) updateAudit(audit)
  }, [qpCode, departmentId, persistedAudit, getOrCreateAudit, updateAudit])

  const requiredStandards = useMemo(
    () => state.auditProfile.applicableStandards
      .filter((standard) => standard.confirmationStatus === 'confirmed')
      .map((standard) => `${standard.name}:${standard.version}`),
    [state.auditProfile],
  )

  const referenceDate = persistedAudit?.auditDate
    || persistedAudit?.plannedDate
    || `${settings.auditYear}-12-31`

  const auditorPickerCandidates = useMemo(
    () => {
      if (!qpCode || !departmentId) return []
      return auditorCandidates(
        state.people,
        WORKSPACE_COMPANY_ID,
        qpCode,
        departmentId,
        referenceDate,
        requiredStandards,
      )
    },
    [state.people, qpCode, departmentId, referenceDate, requiredStandards],
  )

  const ownerCandidates = useMemo(
    () => {
      if (!departmentId) return []
      return departmentMemberCandidates(state.people, WORKSPACE_COMPANY_ID, departmentId, referenceDate)
    },
    [state.people, departmentId, referenceDate],
  )

  const auditForPage = qpCode && departmentId
    ? persistedAudit ?? getOrCreateAudit(qpCode, departmentId)
    : undefined
  const pagination = useTablePagination(auditForPage?.items.length ?? 0, 10, undefined, auditForPage?.id ?? '')
  const setupScope = `${settings.auditYear}:${auditForPage?.id ?? selectedKey}:${auditForPage?.status ?? '規劃中'}`
  const defaultSetupOpen = (auditForPage?.status ?? '規劃中') === '規劃中'
  const [setupState, setSetupState] = useState({ scope: setupScope, open: defaultSetupOpen })
  if (setupState.scope !== setupScope) setSetupState({ scope: setupScope, open: defaultSetupOpen })
  const setupOpen = setupState.scope === setupScope ? setupState.open : defaultSetupOpen
  const setupPanelRef = useRef<HTMLDivElement>(null)
  const [setupFocus, setSetupFocus] = useState({ request: 0, date: false })
  useEffect(() => {
    if (!setupFocus.request) return
    const target = setupFocus.date
      ? setupPanelRef.current?.querySelector<HTMLElement>('#audit-date')
      : setupPanelRef.current
    target?.focus()
  }, [setupFocus])
  const revealSetupError = (date = false) => {
    setSetupState({ scope: setupScope, open: true })
    setSetupFocus((previous) => ({ request: previous.request + 1, date }))
  }

  const seedDiagnosis = useMemo(() => {
    if (!auditForPage || (auditForPage.status ?? '規劃中') === '已回報') return null
    if (!auditForPage.items.some((item) => item.category === '待匯入')) return null
    return diagnoseChecklistSeed(auditForPage.qpCode, auditForPage.department, auditForPage.items)
  }, [auditForPage])

  if (!qpCode || !departmentId) {
    return <p className="text-muted">請先於年度稽核計畫建立查檢項目</p>
  }

  const audit = auditForPage!
  const dept = company.departments.find((d) => d.id === departmentId)
  const linkedPrepIds = new Set(
    prepTemplatesForAudit(audit.qpCode, audit.departmentId, company.planRows).map((template) => template.id),
  )
  const linkedPrepItems = state.externalAuditPrep.items.filter((item) => linkedPrepIds.has(item.id))
  const linkedPrepDone = linkedPrepItems.filter((item) => prepItemCompleted(state.externalAuditPrep, item)).length

  const score = scoreProcedureAudit(audit, settings.scoringRules)
  const categories = [...new Set(audit.items.map(getChecklistDisplayCategory))]
  const itemIndexById = new Map(audit.items.map((item, index) => [item.id, index]))
  const auditStatus = audit.status ?? '規劃中'
  const auditSetupEditable = auditStatus === '規劃中'
  const auditLocked = auditStatus === '已回報'
  const canJudge = auditStatus === '執行中' && !auditLocked
  const managerMismatch =
    auditLocked && dept != null && audit.departmentManager !== dept.owner
  const departmentNameMismatch =
    auditLocked && dept != null && audit.department.trim() !== dept.name.trim()
  const showPendingImportBanner = seedDiagnosis != null

  const impartialityWarning = checkImpartiality({
    auditors: audit.auditors,
    departmentId,
    department: audit.department,
    auditCategory: audit.auditCategory,
    departments: company.departments,
  })
  const showImpartialityConfirm = validateAuditStart(audit).warnings.length > 0

  const handleConfirmLocationAndStart = (location: string) => {
    updateCompanyAuditProfile(WORKSPACE_COMPANY_ID, { formalRecordLocation: location })
    setShowLocationPrompt(false)
    const result = startAudit(audit.id)
    if (!result.canStart) {
      setStartErrors(result.errors)
      revealSetupError()
      return
    }
    setStartErrors([])
    setStartSuccess(true)
  }

  const handleStartAudit = () => {
    if (!audit.auditDate?.trim()) {
      setStartErrors(['開始稽核前須填寫稽核日期'])
      revealSetupError(true)
      return
    }
    if (!state.auditProfile.formalRecordLocation?.trim()) {
      setShowLocationPrompt(true)
      return
    }
    const preview = validateAuditStart(audit)
    if (!preview.canStart) {
      setStartErrors(preview.errors)
      revealSetupError()
      return
    }
    const result = startAudit(audit.id)
    if (!result.canStart) {
      setStartErrors(result.errors)
      revealSetupError()
      return
    }
    setStartErrors([])
    setStartSuccess(true)
  }

  const handleMarkNotified = () => {
    updateAudit(markAuditNotified(audit))
  }

  const handleCompleteReport = () => {
    const ref = reportReferenceDraft.trim()
    const candidate = { ...audit, reportReference: ref }
    const { ready, gaps } = canCompleteAuditReport(candidate, settings.scoringRules)
    if (!ready) {
      setReportErrors(gaps)
      return
    }
    const result = updateAudit({ ...candidate, status: '已回報' })
    if (!result.ok) {
      setReportErrors(result.gaps)
      return
    }
    setReportErrors([])
  }

  const updateTeam = (patch: Partial<NonNullable<typeof audit.team>>) => {
    updateAudit({
      ...audit,
      team: {
        leadAuditorPersonId: audit.team?.leadAuditorPersonId,
        auditorPersonIds: audit.team?.auditorPersonIds ?? [],
        escortPersonIds: audit.team?.escortPersonIds ?? [],
        impartialityConfirmed: audit.team?.impartialityConfirmed ?? false,
        impartialityNote: audit.team?.impartialityNote ?? '',
        ...patch,
      },
    })
  }

  const handleHeaderChange = (field: string, value: string) => {
    updateAudit({ ...audit, [field]: value })
  }

  const isItemNonConform = (item: (typeof audit.items)[0]) => item.judgment === '不符'

  const revealEvidenceField = (itemId: string, field: EvidenceField) => {
    setRevealedEvidence((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: true },
    }))
  }

  const renderEvidenceCell = (item: ChecklistItem) => {
    const visibleFields = visibleEvidenceFields(item, revealedEvidence[item.id] ?? {})
    const optionalFields = canJudge
      ? optionalEvidenceFields(item).filter((field) => !visibleFields.includes(field))
      : []
    return (
      <>
        <div className="space-y-2 no-print">
          {visibleFields.map((field) => (
            <Input
              key={field}
              label={EVIDENCE_FIELD_LABELS[field]}
              value={evidenceFieldValue(item, field)}
              onChange={(value) => updateChecklistItem(audit.id, item.id, { [field]: value })}
              disabled={!canJudge}
            />
          ))}
          {optionalFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {optionalFields.map((field) => (
                <button
                  key={field}
                  type="button"
                  className={`inline-flex items-center rounded border border-transparent px-2 py-1 text-xs font-normal text-link hover:bg-slate-100 ${FOCUS_RING}`}
                  aria-label={`${audit.qpCode} NO ${item.no} 加${EVIDENCE_FIELD_LABELS[field]}`}
                  onClick={() => revealEvidenceField(item.id, field)}
                >
                  + 加{EVIDENCE_FIELD_LABELS[field]}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="print-only">
          {item.description}
          {item.objectiveEvidence ? ` · 證據：${item.objectiveEvidence}` : ''}
        </span>
      </>
    )
  }

  const handleRemove = (itemId: string, isNonConform: boolean) => {
    setDeleteTarget({ itemId, isNonConform })
  }

  const renderErrorSummary = (prefix: string, errors: string[]) => {
    if (errors.length === 0) return null
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-red-700" role="alert">
        <p className="min-w-0 break-words">
          <span className="font-bold">{prefix}</span>
          {errors[0]}
        </p>
        {errors.length > 1 && (
          <details className="open:basis-full">
            <summary className={`cursor-pointer whitespace-nowrap text-xs font-bold underline underline-offset-2 ${FOCUS_RING}`}>
              查看全部 {errors.length} 項
            </summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errors.map((msg) => <li key={msg}>{msg}</li>)}
            </ul>
          </details>
        )}
      </div>
    )
  }

  const renderNcrHint = (item: ChecklistItem) => {
    const linked = findNcrsForChecklistItem(company.ncrs, item.id)
    if (linked.length === 0 || !onNavigate) return null
    const stale = linked.some((n) => isNcrStale(n, company.audits))
    const numberLabels = ncrNumberLabels(linked)
    const numbers = linked.map((n) => numberLabels.get(n.id) ?? n.ncrNumber).join('、')
    return (
      <div className="mt-1 text-xs no-print">
        <button
          type="button"
          className={`hover:underline ${FOCUS_RING} ${stale ? 'text-amber-700' : 'text-primary'}`}
          onClick={() => onNavigate('ncr')}
        >
          {stale
            ? `建議結案 NCR（${numbers}，查檢已非不符）`
            : `已建立 NCR ${numbers}，前往不符合`}
        </button>
      </div>
    )
  }

  const renderJudgmentSelect = (
    value: Judgment | null | undefined,
    onChange: (j: Judgment | null) => void,
    label?: string,
    disabled = false,
  ) => (
    <div className="space-y-0.5">
      {label && <span className="text-xs text-muted no-print">{label}</span>}
      <select
        className={`w-full min-w-0 rounded border border-line bg-surface px-1 py-1 no-print ${FOCUS_RING}`}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange((e.target.value || null) as Judgment | null)}
        aria-label={label ?? '判定'}
      >
        <option value="">未判定</option>
        {JUDGMENTS.map((j) => (
          <option key={j} value={j}>{j}</option>
        ))}
      </select>
      <span className="print-only">{value ? <Badge label={value} /> : '未判定'}</span>
    </div>
  )

  return (
    <div className="space-y-4 print-area qr-form">
      <DepartmentOwnerConfirm ownerConfirm={ownerConfirm} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="移至回收區？"
        description={
          deleteTarget?.isNonConform
            ? '此項目判定為「不符」，對應 NCR 仍會保留。查檢項可在系統設定的回收區還原。'
            : '自訂／追蹤查檢項將移至系統設定的回收區，之後可還原。'
        }
        variant="danger"
        confirmLabel="移入回收區"
        onConfirm={() => {
          if (deleteTarget) removeChecklistItem(audit.id, deleteTarget.itemId)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <div>
        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="內部稽核查檢表"
          formId="QR-28-02"
          subtitle={`${audit.qpCode} ${getProcedureTitle(audit.qpCode, audit.department)} · ${audit.auditCategory}`}
        />

        <div className="mb-3 no-print space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex min-w-0 basis-full items-center gap-2 sm:min-w-[16rem] sm:basis-auto sm:flex-1">
              <label htmlFor="procedure-audit-select" className="shrink-0 text-sm font-bold text-ink">查檢表</label>
              <div className="min-w-0 flex-1">
                <Select
                  id="procedure-audit-select"
                  value={selectedKey}
                  onChange={setSelectedKey}
                  options={auditOptions}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={auditStatus} />
              {audit.notifySent ? (
                <span className="whitespace-nowrap text-sm text-muted">
                  已通知{audit.notifyDate ? ` ${audit.notifyDate}` : ''}
                </span>
              ) : auditStatus === '規劃中' && (
                <Button variant="secondary" className="shrink-0 whitespace-nowrap" onClick={handleMarkNotified}>標記已通知</Button>
              )}
              {audit.reportReference && <span className="text-sm">正式紀錄：{audit.reportReference}</span>}
              {auditStatus === '規劃中' && <Button className="shrink-0 whitespace-nowrap" onClick={handleStartAudit}>開始稽核</Button>}
              {auditStatus === '執行中' && (
                <>
                  <div className="flex items-center gap-2">
                    <label htmlFor="audit-report-reference" className={INLINE_LABEL}>正式紀錄編號</label>
                    <Input
                      id="audit-report-reference"
                      className="w-40 sm:w-48"
                      value={reportReferenceDraft}
                      onChange={setReportReferenceDraft}
                    />
                  </div>
                  <Button className="shrink-0 whitespace-nowrap" onClick={handleCompleteReport}>完成回報</Button>
                </>
              )}
              <Button
                className="shrink-0 whitespace-nowrap"
                variant="secondary"
                aria-label={`${audit.qpCode} ${audit.department} 稽核設定`}
                aria-expanded={setupOpen}
                aria-controls={`audit-setup-${audit.id}`}
                onClick={() => setSetupState({ scope: setupScope, open: !setupOpen })}
              >稽核設定</Button>
            </div>
            <p className="min-w-0 break-words text-sm text-muted">
              {audit.qpCode} · {audit.department} · {audit.auditDate || '未填稽核日期'} · {audit.auditors || '未選稽核人員'}
            </p>
          </div>
          <ImpartialityBanner warning={impartialityWarning} className="mb-0" />
          {showPendingImportBanner && seedDiagnosis && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
              {seedDiagnosis.advisory}
            </p>
          )}
          {renderErrorSummary('無法開始稽核：', startErrors)}
          {renderErrorSummary('尚不能完成回報：', reportErrors)}
          {auditStatus === '執行中' && (
            <p className="text-sm text-muted" role={startSuccess ? 'status' : undefined}>
              日期、人員與客觀性設定已固定；完成回報前可編輯查檢內容。
            </p>
          )}
          {auditLocked && (
            <p className="text-sm text-muted">本表已回報鎖定；後續主檔變更不會改寫歷史紀錄。</p>
          )}
          {managerMismatch && (
            <p className="text-sm text-amber-900" role="status">
              部門主管與現行主檔不同（快照：{audit.departmentManager || '—'}；主檔：{dept?.owner || '—'}）。
            </p>
          )}
          {departmentNameMismatch && (
            <p className="text-sm text-amber-900" role="status">
              部門名稱與現行主檔不同（快照：{audit.department}；主檔：{dept?.name}）。
            </p>
          )}
        </div>

        <div className="no-print">
          <div
            id={`audit-setup-${audit.id}`}
            ref={setupPanelRef}
            hidden={!setupOpen}
            tabIndex={-1}
            role="group"
            aria-label="稽核設定"
            className={FOCUS_RING}
          >
            <div className="grid items-center gap-x-6 gap-y-2 md:grid-cols-2 xl:grid-cols-[minmax(0,16rem)_minmax(0,20rem)_minmax(0,1fr)]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <label htmlFor="audit-date" className={INLINE_LABEL}>稽核日期</label>
                <Input
                  id="audit-date" type="date" value={audit.auditDate} className="min-w-0 flex-1 basis-40"
                  onChange={(value) => handleHeaderChange('auditDate', value)} disabled={!auditSetupEditable}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={INLINE_LABEL}>被稽核部門主管</span>
                <div className="min-w-0 flex-1 basis-40">
                  {auditLocked ? (
                    <>
                      <span className="text-sm">{audit.departmentManager}</span>
                      {managerMismatch && (
                        <p className="mt-1 text-xs text-amber-800">
                          已評分，本表凍結為「{audit.departmentManager}」；部門負責人已改為「{dept?.owner}」
                        </p>
                      )}
                    </>
                  ) : dept ? (
                    <DepartmentOwnerField
                      departmentId={departmentId} savedOwner={dept.owner} displayOwner={audit.departmentManager}
                      ariaLabel="被稽核部門主管" onSaveRequest={ownerConfirm.requestChange} candidates={ownerCandidates}
                    />
                  ) : (
                    <Input value={audit.departmentManager} onChange={(value) => handleHeaderChange('departmentManager', value)} ariaLabel="被稽核部門主管" />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:col-span-2 xl:col-span-1">
                <span className={INLINE_LABEL}>稽核人員</span>
                <AuditorMultiSelect
                  inline
                  className="min-w-0 flex-1 basis-48"
                  value={audit.auditors}
                  onChange={(auditors, personIds) => updateAudit({
                    ...audit,
                    auditors,
                    team: {
                      leadAuditorPersonId: audit.team?.leadAuditorPersonId,
                      auditorPersonIds: personIds ?? [],
                      escortPersonIds: audit.team?.escortPersonIds ?? [],
                      impartialityConfirmed: audit.team?.impartialityConfirmed ?? false,
                      impartialityNote: audit.team?.impartialityNote ?? '',
                    },
                  })}
                  candidates={auditorPickerCandidates} people={state.people}
                  excludePersonId={audit.team?.leadAuditorPersonId}
                  disabled={!auditSetupEditable} ariaLabel="稽核人員"
                />
              </div>
              {audit.documents.trim() !== '' && audit.documents.trim() !== audit.qpCode.trim() && (
                <div className="flex min-w-0 items-baseline gap-2 text-sm md:col-span-2 xl:col-span-3">
                  <span className={INLINE_LABEL}>對應文件</span>
                  <span className="min-w-0 break-words">{audit.documents}</span>
                </div>
              )}
              {showImpartialityConfirm && (
                <label className="flex items-start gap-2 text-sm md:col-span-2 xl:col-span-3">
                  <input type="checkbox" className={`mt-1 ${FOCUS_RING}`}
                    checked={audit.team?.impartialityConfirmed ?? false} disabled={!auditSetupEditable}
                    onChange={(event) => updateTeam({ impartialityConfirmed: event.target.checked })}
                  />
                  <span>客觀性風險已確認（同單位稽核等）</span>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="print-only">
          <table className="qr-header-table mb-4 w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="col-name" />
              <col />
              <col className="col-name" />
              <col />
            </colgroup>
            <tbody>
              <tr><td className="qr-label border border-line p-2">被稽核部門</td><td >{audit.department}</td><td className="qr-label border border-line p-2">稽核流程 (QP)</td><td >{audit.qpCode} {audit.process}</td></tr>
              <tr><td className="qr-label border border-line p-2">對應文件</td><td >{audit.documents}</td><td className="qr-label border border-line p-2">通知日期</td><td >{audit.notifyDate}</td></tr>
              <tr><td className="qr-label border border-line p-2">實施日期</td><td >{audit.auditDate}</td><td className="qr-label border border-line p-2">被稽核部門主管</td><td >{audit.departmentManager}</td></tr>
              <tr><td className="qr-label border border-line p-2">稽核人員</td><td  colSpan={3}>{audit.auditors}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mb-2 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <dl aria-label="查檢判定統計" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {[
              ['程序得分', formatScoreDisplay(score)],
              ['總項數', score.totalItems],
              ['符合', score.breakdown.conform],
              ['不符', score.breakdown.nonConform],
              ['觀察', score.breakdown.observation],
              ['不適用', score.breakdown.notApplicable],
              ['未判定', score.breakdown.pending],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-1"><dt className="text-muted">{label}</dt><dd className="font-bold tabular-nums">{value}</dd></div>
            ))}
          </dl>
          {canJudge && (
            <Button variant="secondary" className="no-print shrink-0" onClick={() => addChecklistItem(audit.id)}>新增稽核項目</Button>
          )}
        </div>

        {linkedPrepItems.length > 0 && (
          <details className="mb-3 no-print">
            <summary className={`cursor-pointer text-sm ${FOCUS_RING}`}>
              <span className="font-bold">關聯外稽準備 {linkedPrepDone}/{linkedPrepItems.length} 項</span>
              {linkedPrepDone < linkedPrepItems.length && (
                <span className="ml-2 text-tone-warning-fg">未完成 {linkedPrepItems.length - linkedPrepDone} 項</span>
              )}
              <span className="ml-2 text-xs text-muted">準備完成不影響本表判定</span>
            </summary>
            <div className="mt-2">
              <PrepTaskTable
                store={store}
                itemIds={linkedPrepItems.map((item) => item.id)}
                showLinks={false}
                ariaLabel={`${audit.qpCode} 關聯外稽準備事項`}
                onNavigate={onNavigate}
              />
            </div>
          </details>
        )}

        <ScrollRegion ariaLabel="查檢表項目清單">
          <table className="qr-checklist worksheet-table print-checklist min-w-[42rem]">
            <colgroup>
              <col className="col-name col-print-category" />
              <col className="col-seq col-print-seq" />
              <col className="col-print-audit-content" />
              <col className="col-judge col-print-judge" />
              <col className="col-print-evidence" />
              <col className="col-action no-print" />
            </colgroup>
            <thead>
              <tr>
                <th >項目</th>
                <th >NO</th>
                <th >稽核內容</th>
                <th >判定</th>
                <th >發現／證據</th>
                <th className="no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const catItems = audit.items.filter((i) => getChecklistDisplayCategory(i) === cat)
                const visibleCatItems = catItems.filter((item) => pagination.isVisible(itemIndexById.get(item.id) ?? -1))
                const firstVisibleId = visibleCatItems[0]?.id
                return catItems.map((item, idx) => {
                  const visible = pagination.isVisible(itemIndexById.get(item.id) ?? -1)
                  return (
                  <tr
                    key={item.id}
                    className={`${!visible ? 'pagination-hidden-row ' : ''}${
                      isChecklistItemPending(item)
                        ? 'bg-rose-50/40'
                        : item.sourceYear
                          ? 'bg-amber-50/40'
                          : ''
                    }`}
                  >
                    {item.id === firstVisibleId && visibleCatItems.length > 0 && (
                      <td className="no-print align-top font-bold break-words" rowSpan={visibleCatItems.length}>
                        {cat}
                      </td>
                    )}
                    {idx === 0 && (
                      <td className="pagination-print-cell align-top font-bold" rowSpan={catItems.length}>
                        {cat}
                      </td>
                    )}
                    <td className="align-top text-center">{item.no}</td>
                    <td className="align-top break-words">
                      {isChecklistItemPending(item) && (
                        <span className="mb-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-xs font-normal text-rose-900 no-print">
                          未判定
                        </span>
                      )}
                      {isSeedChecklistItem(item) ? (
                        <span className="text-ink">{getChecklistDisplayContent(item)}</span>
                      ) : (
                        <input
                          className={`w-full rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                          value={item.content}
                          disabled={!canJudge}
                          onChange={(e) =>
                            updateChecklistItem(audit.id, item.id, { content: e.target.value })
                          }
                          aria-label={`${audit.qpCode} NO ${item.no} 稽核內容`}
                        />
                      )}
                      <span className="print-only">{getChecklistDisplayContent(item)}</span>
                      {item.as9100Clause && (
                        <span className="mt-1 block text-xs text-slate-500 no-print">
                          AS9100 {item.as9100Clause}
                        </span>
                      )}
                      {item.sourceYear && (
                        <span className="mt-1 block text-xs text-amber-700">來源：{item.sourceYear} 年追蹤</span>
                      )}
                    </td>
                    <td className="align-top">
                      {renderJudgmentSelect(
                        item.judgment,
                        (j) => updateChecklistItem(audit.id, item.id, { judgment: j }),
                        undefined,
                        !canJudge,
                      )}
                      {renderNcrHint(item)}
                    </td>
                    <td className="align-top">
                      {renderEvidenceCell(item)}
                    </td>
                    <td className="align-top no-print">
                      {!isSeedChecklistItem(item) && canJudge ? (
                        <button
                          type="button"
                          className={`text-sm text-red-600 hover:underline ${FOCUS_RING}`}
                          onClick={() => handleRemove(item.id, isItemNonConform(item))}
                        >
                          移至回收區
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  )
                })
              })}
            </tbody>
          </table>
        </ScrollRegion>
        <TablePagination pagination={pagination} label="查檢表" />
      </div>

      <FormalRecordLocationDialog
        open={showLocationPrompt}
        currentLocation={state.auditProfile.formalRecordLocation}
        title="請先指定正式紀錄保存位置以開始稽核"
        description="開始稽核前須確認本年度稽核紀錄之受控存放位置。指定後將自動解鎖並啟動稽核："
        onConfirm={handleConfirmLocationAndStart}
        onCancel={() => setShowLocationPrompt(false)}
      />
    </div>
  )
}
