import type { AppState } from '../types'
import type { NCR, NCRClassification, NCRStatus } from '../types'
import { ncrCompanyScopeLabel } from '../lib/certificateScope'
import { ncrReportProgress, resolveNcrSourceAuditors } from '../lib/ncr'
import { FOCUS_RING } from '../lib/focusRing'
import { departmentMemberCandidates, verifierCandidates } from '../lib/personnel'
import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
import { Button, Input, Select } from './ui/Badge'
import { PersonNameSelect } from './ui/PersonNameSelect'
import { FormPrintButton } from './ui/FormPrintButton'
import { NcrReportProgressBar } from './NcrReportProgressBar'
import { ACTION_ICONS } from '../lib/uiIcons'

const STATUSES: NCRStatus[] = ['開立', '矯正中', '結案']
const CLASSIFICATIONS: NCRClassification[] = ['重大', '輕微']

const REMARK_TEXT =
  '備註: 七個工作日內提交稽核小組進行審查，\n十五天內完成矯正行動的確認。'

function findingBlock(ncr: NCR): string {
  const parts: string[] = []
  if (ncr.description?.trim()) parts.push(ncr.description.trim())
  const req = ncr.requirementSnapshot?.trim()
  const ev = ncr.evidenceSnapshot?.trim()
  if (req && req !== ncr.description?.trim()) parts.push(`要求：${req}`)
  if (ev && ev !== ncr.description?.trim() && ev !== req) parts.push(`證據：${ev}`)
  return parts.join('\n')
}

function followUpBlock(ncr: NCR): string {
  const parts: string[] = []
  if (ncr.verificationEvidence?.trim()) parts.push(ncr.verificationEvidence.trim())
  if (ncr.effectivenessReference?.trim()) parts.push(`效果確認引用：${ncr.effectivenessReference.trim()}`)
  if (ncr.effectivenessVerifiedBy?.trim() || ncr.effectivenessVerifiedAt?.trim()) {
    parts.push(
      `確認人：${ncr.effectivenessVerifiedBy?.trim() || '—'}  確認日：${ncr.effectivenessVerifiedAt?.trim() || '—'}`,
    )
  }
  if (ncr.correctiveActionReference?.trim() && !parts.some((p) => p.includes('矯正措施引用'))) {
    // corrective ref shown in corrective section for print
  }
  return parts.join('\n')
}

interface NcrCorrectiveReportProps {
  state: AppState
  ncr: NCR
  displayNumber: string
  draft: NCR
  onDraftChange: (patch: Partial<NCR>) => void
  saveError?: string
  onSave: () => void
  onVoid: () => void
  onClose: () => void
}

export function NcrCorrectiveReport({
  state,
  ncr,
  displayNumber,
  draft,
  onDraftChange,
  saveError,
  onSave,
  onVoid,
  onClose,
}: NcrCorrectiveReportProps) {
  const { workspace: company, settings } = state
  const auditors = resolveNcrSourceAuditors(ncr, company.audits)
  const companyLine = ncrCompanyScopeLabel(ncr.companyScope)
  const referenceDate = `${settings.auditYear}-12-31`
  const verifierPeople = verifierCandidates(
    state.people,
    WORKSPACE_COMPANY_ID,
    settings.auditYear,
    state.annualPersonnelAssignments,
    referenceDate,
  )
  const progress = ncrReportProgress(draft)
  const auditItemLabel = [draft.qpCode, draft.process].filter(Boolean).join(' ')

  return (
    <div className="print-area qr-form qr-ncr-report space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <NcrReportProgressBar stages={progress} className="min-w-[16rem] flex-1" />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSave}>存檔</Button>
          <FormPrintButton label="列印本表" />
          <Button variant="secondary" onClick={onClose}>
            收合
          </Button>
          <Button variant="dangerGhost" icon={ACTION_ICONS.delete} onClick={onVoid}>
            作廢
          </Button>
        </div>
      </div>
      {saveError && (
        <p className="no-print text-sm text-red-700" role="alert">
          {saveError}
        </p>
      )}

      <div className="qr-ncr-report-sheet overflow-x-auto">
        {companyLine ? (
          <p className="print-only mb-2 text-center text-sm font-bold">{companyLine}</p>
        ) : null}
        <table className="qr-ncr-report-table w-full min-w-[42rem] border-collapse text-sm">
          <tbody>
            <tr>
              <td colSpan={8} className="qr-ncr-title text-center font-bold">
                稽 核 矯 正 報 告
              </td>
              <td colSpan={3} className="qr-ncr-ncr font-bold text-right">
                NCR#: {displayNumber}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="qr-ncr-label text-center font-bold">
                起始
                <br />
                日期
              </td>
              <td colSpan={2} className="qr-ncr-value">
                <span className="print-only">{draft.date || ' '}</span>
                <Input
                  className="no-print border-0 p-0 shadow-none"
                  label=""
                  ariaLabel={`${displayNumber} 起始日期`}
                  type="date"
                  value={draft.date}
                  onChange={(v) => onDraftChange({ date: v })}
                />
              </td>
              <td colSpan={2} className="qr-ncr-label text-center font-bold">
                稽核
                <br />
                項目
              </td>
              <td colSpan={4} className="qr-ncr-value">
                <span className="print-only">{auditItemLabel}</span>
                <span className="no-print text-muted">{auditItemLabel}</span>
              </td>
              <td colSpan={2} className="qr-ncr-label text-center font-bold">
                受稽
                <br />
                部門
              </td>
              <td colSpan={1} className="qr-ncr-value">
                {draft.department}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="qr-ncr-label font-bold">
                預計回覆日期{' '}
                <span className="print-only font-normal">{draft.dueDate || ' '}</span>
                <span className="no-print inline-block align-middle">
                  <Input
                    className="inline-block w-auto min-w-[8rem] border-0 p-0 shadow-none"
                    label=""
                    ariaLabel={`${displayNumber} 預計回覆日期`}
                    type="date"
                    value={draft.dueDate ?? ''}
                    onChange={(v) => onDraftChange({ dueDate: v })}
                  />
                </span>
              </td>
              <td colSpan={7} className="qr-ncr-remark whitespace-pre-wrap text-xs">
                {REMARK_TEXT}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="qr-ncr-label font-bold">
                發生流程/地點/單位
              </td>
              <td colSpan={5} className="qr-ncr-value">
                <span className="print-only">{draft.process || ' '}</span>
                <Input
                  className="no-print border-0 p-0 shadow-none"
                  label=""
                  ariaLabel={`${displayNumber} 發生流程`}
                  value={draft.process}
                  onChange={(v) => onDraftChange({ process: v })}
                />
              </td>
              <td colSpan={2} className="qr-ncr-label text-center font-bold">
                責任
                <br />
                單位
              </td>
              <td colSpan={1} className="qr-ncr-value" />
            </tr>
            <tr>
              <td colSpan={11} className="qr-ncr-section font-bold align-top">
                不符合事項：
                <div className="mt-1 min-h-[4rem] whitespace-pre-wrap font-normal">
                  <span className="print-only">{findingBlock(draft) || ' '}</span>
                  <textarea
                    className={`no-print mt-1 w-full min-w-0 rounded border border-line bg-surface px-2 py-1 text-sm ${FOCUS_RING}`}
                    rows={4}
                    value={draft.description}
                    onChange={(e) => onDraftChange({ description: e.target.value })}
                    aria-label={`${displayNumber} 不符合事項`}
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={11} className="qr-ncr-signatures text-xs">
                <span className="font-bold">稽核人員:</span> {auditors || ' '}
                <span className="ml-6 font-bold">受稽人員:</span>
              </td>
            </tr>
            <tr>
              <td colSpan={11} className="qr-ncr-section font-bold align-top">
                原因分析:
                <div className="mt-1 min-h-[5rem] whitespace-pre-wrap font-normal">
                  <span className="print-only">{draft.rootCause || ' '}</span>
                  <textarea
                    className={`no-print mt-1 w-full min-w-0 rounded border border-line bg-surface px-2 py-1 text-sm ${FOCUS_RING}`}
                    rows={4}
                    value={draft.rootCause}
                    onChange={(e) => onDraftChange({ rootCause: e.target.value })}
                    aria-label={`${displayNumber} 原因分析`}
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={11} className="qr-ncr-signatures text-xs">
                <span className="font-bold">單位主管:</span>
                <span className="ml-6 font-bold">負責人員:</span>{' '}
                <span className="print-only">{draft.responsiblePerson || ' '}</span>
                <span className="no-print inline-block min-w-[8rem] align-middle">
                  <PersonNameSelect
                    label=""
                    value={draft.responsiblePerson ?? ''}
                    onChange={(v) => onDraftChange({ responsiblePerson: v })}
                    candidates={departmentMemberCandidates(
                      state.people,
                      WORKSPACE_COMPANY_ID,
                      draft.departmentId,
                      referenceDate,
                    )}
                  />
                </span>
              </td>
            </tr>
            <tr>
              <td colSpan={11} className="qr-ncr-section font-bold align-top">
                矯正措施：
                <div className="mt-1 min-h-[5rem] whitespace-pre-wrap font-normal">
                  <span className="print-only">
                    {[draft.correctiveAction, draft.correctiveActionReference ? `矯正措施引用：${draft.correctiveActionReference}` : '']
                      .filter(Boolean)
                      .join('\n') || ' '}
                  </span>
                  <textarea
                    className={`no-print mt-1 w-full min-w-0 rounded border border-line bg-surface px-2 py-1 text-sm ${FOCUS_RING}`}
                    rows={4}
                    value={draft.correctiveAction}
                    onChange={(e) => onDraftChange({ correctiveAction: e.target.value })}
                    aria-label={`${displayNumber} 矯正措施`}
                  />
                  <div className="no-print mt-2">
                    <Input
                      label="矯正措施引用"
                      value={draft.correctiveActionReference ?? ''}
                      onChange={(v) => onDraftChange({ correctiveActionReference: v })}
                    />
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={11} className="qr-ncr-signatures text-xs">
                <span className="font-bold">單位主管:</span>
                <span className="ml-6 font-bold">負責人員:</span>{' '}
                {draft.responsiblePerson || ' '}
              </td>
            </tr>
            <tr>
              <td colSpan={11} className="qr-ncr-section font-bold align-top">
                追蹤結果：
                <div className="mt-1 min-h-[5rem] whitespace-pre-wrap font-normal">
                  <span className="print-only">{followUpBlock(draft) || ' '}</span>
                  <textarea
                    className={`no-print mt-1 w-full min-w-0 rounded border border-line bg-surface px-2 py-1 text-sm ${FOCUS_RING}`}
                    rows={4}
                    value={draft.verificationEvidence}
                    onChange={(e) => onDraftChange({ verificationEvidence: e.target.value })}
                    aria-label={`${displayNumber} 追蹤結果`}
                  />
                  <div className="no-print mt-2 grid gap-2 sm:grid-cols-2">
                    <Input
                      label="效果確認引用"
                      value={draft.effectivenessReference ?? ''}
                      onChange={(v) => onDraftChange({ effectivenessReference: v })}
                    />
                    <PersonNameSelect
                      label="效果確認人"
                      value={draft.effectivenessVerifiedBy ?? ''}
                      onChange={(v) => onDraftChange({ effectivenessVerifiedBy: v })}
                      candidates={verifierPeople}
                    />
                    <Input
                      label="效果確認日"
                      type="date"
                      value={draft.effectivenessVerifiedAt ?? ''}
                      onChange={(v) => onDraftChange({ effectivenessVerifiedAt: v })}
                    />
                    <Select
                      label="狀態"
                      value={draft.status}
                      onChange={(v) => onDraftChange({ status: v as NCRStatus })}
                      options={STATUSES.map((s) => ({ value: s, label: s }))}
                    />
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={11} className="qr-ncr-signatures text-xs">
                <span className="font-bold">管理代表:</span>
                <span className="ml-6 font-bold">稽核人員:</span> {auditors || ' '}
              </td>
            </tr>
            <tr>
              <td colSpan={6} className="qr-ncr-footer text-sm">
                文件保存期限:十五年
              </td>
              <td colSpan={5} className="qr-ncr-footer text-right text-sm">
                文件編號:QR-28-03 版本:A
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="no-print grid gap-3 rounded-lg border border-line bg-page p-3 sm:grid-cols-2">
        <Input
          label="遏制措施"
          value={draft.containment ?? ''}
          onChange={(v) => onDraftChange({ containment: v })}
        />
        <Select
          label="分類"
          value={draft.classification ?? ''}
          onChange={(v) => onDraftChange({ classification: (v || undefined) as NCRClassification | undefined })}
          options={[{ value: '', label: '—' }, ...CLASSIFICATIONS.map((c) => ({ value: c, label: c }))]}
        />
      </div>
    </div>
  )
}
