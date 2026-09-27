import { useEffect, useMemo, useState } from 'react'
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
import { ImpartialityBanner } from './ui/ImpartialityBanner'
import type { ChecklistItem, Judgment, TabId } from '../types'
import { auditorCandidates, departmentMemberCandidates } from '../lib/personnel'
import { AuditorMultiSelect } from './ui/AuditorMultiSelect'
import { Badge, Button, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'

const JUDGMENTS: Judgment[] = ['符合', '不符', '觀察', '不適用']

const EVIDENCE_FIELD_LABELS: Record<EvidenceField, string> = {
  description: '發現說明',
  sampleSize: '抽樣數',
  objectiveEvidence: '客觀證據',
  notApplicableReason: '不適用理由',
}

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
    () => state.companyAuditProfiles[state.activeCompanyId].applicableStandards
      .filter((standard) => standard.confirmationStatus === 'confirmed')
      .map((standard) => `${standard.name}:${standard.version}`),
    [state.companyAuditProfiles, state.activeCompanyId],
  )

  const referenceDate = persistedAudit?.auditDate
    || persistedAudit?.plannedDate
    || `${settings.auditYear}-12-31`

  const auditorPickerCandidates = useMemo(
    () => {
      if (!qpCode || !departmentId) return []
      return auditorCandidates(
        state.people,
        state.activeCompanyId,
        qpCode,
        departmentId,
        referenceDate,
        requiredStandards,
      )
    },
    [state.people, state.activeCompanyId, qpCode, departmentId, referenceDate, requiredStandards],
  )

  const ownerCandidates = useMemo(
    () => {
      if (!departmentId) return []
      return departmentMemberCandidates(state.people, state.activeCompanyId, departmentId, referenceDate)
    },
    [state.people, state.activeCompanyId, departmentId, referenceDate],
  )

  const auditForPage = qpCode && departmentId
    ? persistedAudit ?? getOrCreateAudit(qpCode, departmentId)
    : undefined
  const pagination = useTablePagination(auditForPage?.items.length ?? 0, 10, undefined, auditForPage?.id ?? '')

  if (!qpCode || !departmentId) {
    return <p className="text-muted">請先於年度稽核計畫建立查檢項目</p>
  }

  const audit = auditForPage!
  const dept = company.departments.find((d) => d.id === departmentId)

  const score = scoreProcedureAudit(audit, settings.scoringRules)
  const categories = [...new Set(audit.items.map(getChecklistDisplayCategory))]
  const itemIndexById = new Map(audit.items.map((item, index) => [item.id, index]))
  const auditStatus = audit.status ?? '規劃中'
  const auditSetupEditable = auditStatus === '規劃中'
  const auditLocked = auditStatus === '已回報'
  const canJudge = auditStatus === '執行中' && !auditLocked
  const managerMismatch =
    auditLocked && dept != null && audit.departmentManager !== dept.owner

  const impartialityWarning = checkImpartiality({
    auditors: audit.auditors,
    departmentId,
    department: audit.department,
    auditCategory: audit.auditCategory,
    departments: company.departments,
  })

  const handleStartAudit = () => {
    if (!audit.auditDate?.trim()) {
      setStartErrors(['開始稽核前須填寫實施日期'])
      return
    }
    const preview = validateAuditStart(audit)
    if (!preview.canStart) {
      setStartErrors(preview.errors)
      return
    }
    const result = startAudit(audit.id)
    if (!result.canStart) {
      setStartErrors(result.errors)
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
    updateAudit({ ...candidate, status: '已回報' })
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
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {optionalFields.map((field) => (
                <button
                  key={field}
                  type="button"
                  className={`text-xs text-link hover:underline ${FOCUS_RING}`}
                  aria-label={`${audit.qpCode} NO ${item.no} 加${EVIDENCE_FIELD_LABELS[field]}`}
                  onClick={() => revealEvidenceField(item.id, field)}
                >
                  加{EVIDENCE_FIELD_LABELS[field]}
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
          className={`hover:underline ${FOCUS_RING} ${stale ? 'text-amber-700 dark:text-amber-300' : 'text-primary'}`}
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
    <div className="space-y-6 print-area qr-form">
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
        <PageToolbar
          title="查檢表"
          actions={(
            <Select
              label="查檢表"
              value={selectedKey}
              onChange={setSelectedKey}
              options={auditOptions}
            />
          )}
        />

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="內部稽核查檢表 QR-28-02"
          subtitle={`${audit.qpCode} ${getProcedureTitle(audit.qpCode, audit.department)} · ${audit.auditCategory}`}
        />

        <div className="mb-4 no-print space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={auditStatus} />
            {audit.notifySent && <span className="text-xs text-muted">已標記通知</span>}
            {audit.reportReference && (
              <span className="text-xs text-muted">正式紀錄：{audit.reportReference}</span>
            )}
          </div>
          <ImpartialityBanner warning={impartialityWarning} />
          {startErrors.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-700" role="alert">
              {startErrors.map((msg) => <li key={msg}>{msg}</li>)}
            </ul>
          )}
          {startSuccess && auditStatus === '執行中' && (
            <p className="text-sm text-green-700" role="status">
              已開始。適用標準、程序代碼、版本與保存位置已固定。
            </p>
          )}
          {auditStatus === '執行中' && (
            <p className="text-xs text-muted">
              日期、稽核人員與客觀性設定已固定；查檢內容、判定與證據可編輯至回報。部門主管主檔異動仍須確認。
            </p>
          )}
          {reportErrors.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-700" role="alert">
              {reportErrors.map((msg) => <li key={msg}>{msg}</li>)}
            </ul>
          )}
          {!auditLocked && (
            <div className="flex flex-wrap gap-2">
              {auditStatus === '規劃中' && (
                <>
                  <Button onClick={handleStartAudit}>開始稽核</Button>
                  <Button variant="secondary" onClick={handleMarkNotified}>標記已通知</Button>
                </>
              )}
              {auditStatus === '執行中' && (
                <>
                  <Input
                    label="正式紀錄編號"
                    value={reportReferenceDraft}
                    onChange={setReportReferenceDraft}
                    className="min-w-[12rem]"
                  />
                  <Button onClick={handleCompleteReport}>完成回報</Button>
                </>
              )}
            </div>
          )}
          {!auditLocked && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={audit.team?.impartialityConfirmed ?? false}
                  disabled={!auditSetupEditable}
                  onChange={(e) => updateTeam({ impartialityConfirmed: e.target.checked })}
                />
                <span>客觀性風險已確認（同單位稽核等）</span>
              </label>
              <Input
                label="客觀性控制措施／依據"
                value={audit.team?.impartialityNote ?? ''}
                onChange={(value) => updateTeam({ impartialityNote: value })}
                disabled={!auditSetupEditable}
              />
            </div>
          )}
          {auditLocked && (
            <p className="text-sm text-muted">本表已回報鎖定；後續主檔變更不會改寫歷史紀錄。</p>
          )}
          {auditStatus === '規劃中' && (
            <p className="text-xs text-muted">開始稽核後才可判定查檢項；符合／不符須填客觀證據，不適用須填理由。</p>
          )}
        </div>

        <ScrollRegion ariaLabel="查檢表表頭資訊">
          <table className="qr-header-table mb-6 w-full min-w-[640px] border-collapse text-sm">
            <tbody>
              <tr>
                <td className="qr-label border border-line p-2">被稽核部門</td>
                <td className="border border-line p-2">{audit.department}</td>
                <td className="qr-label border border-line p-2">稽核流程 (QP)</td>
                <td className="border border-line p-2">{audit.qpCode} {audit.process}</td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">對應文件</td>
                <td className="border border-line p-2">{audit.documents}</td>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-notify-date">通知日期</label>
                </td>
                <td className="border border-line p-2">
                  <Input
                    type="date"
                    value={audit.notifyDate}
                    onChange={(v) => handleHeaderChange('notifyDate', v)}
                    className="no-print"
                    ariaLabel="通知日期"
                    disabled={!auditSetupEditable}
                  />
                  <span className="print-only">{audit.notifyDate}</span>
                </td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-date">實施日期</label>
                </td>
                <td className="border border-line p-2">
                  <Input
                    type="date"
                    value={audit.auditDate}
                    onChange={(v) => handleHeaderChange('auditDate', v)}
                    className="no-print"
                    ariaLabel="實施日期"
                    disabled={!auditSetupEditable}
                  />
                  <span className="print-only">{audit.auditDate}</span>
                </td>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-manager">被稽核部門主管</label>
                </td>
                <td className="border border-line p-2">
                  {auditLocked ? (
                    <>
                      <span className="no-print text-ink">{audit.departmentManager}</span>
                      {managerMismatch && (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200 no-print">
                          已評分，本表凍結為「{audit.departmentManager}」；部門負責人已改為「{dept?.owner}」
                        </p>
                      )}
                    </>
                  ) : dept ? (
                    <DepartmentOwnerField
                      departmentId={departmentId}
                      savedOwner={dept.owner}
                      displayOwner={audit.departmentManager}
                      ariaLabel="被稽核部門主管"
                      onSaveRequest={ownerConfirm.requestChange}
                      candidates={ownerCandidates}
                    />
                  ) : (
                    <Input
                      value={audit.departmentManager}
                      onChange={(v) => handleHeaderChange('departmentManager', v)}
                      className="no-print"
                      ariaLabel="被稽核部門主管"
                    />
                  )}
                  <span className="print-only">{audit.departmentManager}</span>
                </td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-auditors">稽核人員</label>
                </td>
                <td className="border border-line p-2" colSpan={3}>
                  <AuditorMultiSelect
                    value={audit.auditors}
                    onChange={(auditors, personIds) => {
                      updateAudit({
                        ...audit,
                        auditors,
                        team: {
                          leadAuditorPersonId: audit.team?.leadAuditorPersonId,
                          auditorPersonIds: personIds ?? [],
                          escortPersonIds: audit.team?.escortPersonIds ?? [],
                          impartialityConfirmed: audit.team?.impartialityConfirmed ?? false,
                          impartialityNote: audit.team?.impartialityNote ?? '',
                        },
                      })
                    }}
                    candidates={auditorPickerCandidates}
                    people={state.people}
                    excludePersonId={audit.team?.leadAuditorPersonId}
                    disabled={!auditSetupEditable}
                    ariaLabel="稽核人員"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </ScrollRegion>

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <ScrollRegion ariaLabel="查檢判定計數統計表" className="min-w-0 flex-1">
            <table className="stacked-table w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-page text-left text-muted">
                  <th className="p-2">程序得分</th>
                  <th className="p-2">共幾項</th>
                  <th className="p-2">符合</th>
                  <th className="p-2">不符</th>
                  <th className="p-2">觀察</th>
                  <th className="p-2">不適用</th>
                  <th className="p-2">未判定</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="程序得分" className="border border-line p-2 font-semibold text-primary">
                    {formatScoreDisplay(score)}
                  </td>
                  <td data-label="共幾項" className="border border-line p-2">{score.totalItems}</td>
                  <td data-label="符合" className="border border-line p-2">{score.breakdown.conform}</td>
                  <td data-label="不符" className="border border-line p-2">{score.breakdown.nonConform}</td>
                  <td data-label="觀察" className="border border-line p-2">{score.breakdown.observation}</td>
                  <td data-label="不適用" className="border border-line p-2">{score.breakdown.notApplicable}</td>
                  <td data-label="未判定" className="border border-line p-2">{score.breakdown.pending}</td>
                </tr>
              </tbody>
            </table>
          </ScrollRegion>
          {canJudge && (
            <Button variant="secondary" className="no-print shrink-0" onClick={() => addChecklistItem(audit.id)}>
              新增稽核項目
            </Button>
          )}
        </div>

        <ScrollRegion ariaLabel="查檢表項目清單">
          <table className="qr-checklist w-full min-w-[64rem] table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: '9rem' }} />
              <col style={{ width: '3rem' }} />
              <col />
              <col style={{ width: '7rem' }} />
              <col style={{ width: '14rem' }} />
              <col className="no-print" style={{ width: '6rem' }} />
            </colgroup>
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border border-line p-2">項目</th>
                <th className="border border-line p-2">NO</th>
                <th className="border border-line p-2">稽核內容</th>
                <th className="border border-line p-2">判定</th>
                <th className="border border-line p-2">發現／證據</th>
                <th className="border border-line p-2 no-print">操作</th>
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
                        ? 'bg-rose-50/40 dark:bg-rose-950/20'
                        : item.sourceYear
                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                          : ''
                    }`}
                  >
                    {item.id === firstVisibleId && visibleCatItems.length > 0 && (
                      <td className="no-print border border-line p-2 align-top font-medium break-words" rowSpan={visibleCatItems.length}>
                        {cat}
                      </td>
                    )}
                    {idx === 0 && (
                      <td className="pagination-print-cell border border-line p-2 align-top font-medium" rowSpan={catItems.length}>
                        {cat}
                      </td>
                    )}
                    <td className="border border-line p-2 align-top text-center">{item.no}</td>
                    <td className="border border-line p-2 align-top break-words">
                      {isChecklistItemPending(item) && (
                        <span className="mb-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-900 no-print">
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
                        <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">來源：{item.sourceYear} 年追蹤</span>
                      )}
                    </td>
                    <td className="border border-line p-2 align-top">
                      {renderJudgmentSelect(
                        item.judgment,
                        (j) => updateChecklistItem(audit.id, item.id, { judgment: j }),
                        undefined,
                        !canJudge,
                      )}
                      {renderNcrHint(item)}
                    </td>
                    <td className="border border-line p-2 align-top">
                      {renderEvidenceCell(item)}
                    </td>
                    <td className="border border-line p-2 align-top no-print">
                      {!isSeedChecklistItem(item) && canJudge ? (
                        <button
                          type="button"
                          className={`text-xs text-red-600 hover:underline ${FOCUS_RING}`}
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
    </div>
  )
}
