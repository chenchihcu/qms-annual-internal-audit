import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { useDepartmentOwnerConfirm } from '../hooks/useDepartmentOwnerConfirm'
import { DepartmentOwnerField } from './DepartmentOwnerField'
import { DepartmentOwnerConfirm } from './DepartmentOwnerConfirm'
import { evaluateDateSequence } from '../lib/coverage'
import { FOCUS_RING } from '../lib/focusRing'
import { buildAppHash } from '../lib/navigation'
import { getDisplayMonthStatus } from '../lib/planStatus'
import { cycleMonthStatus } from '../lib/planner'
import { auditorCandidates, departmentMemberCandidates, resolveLeadAuditorPersonId } from '../lib/personnel'
import { AuditorMultiSelect } from './ui/AuditorMultiSelect'
import { MONTH_STATUS_LEGEND } from '../types'
import type { MonthStatus } from '../types'
import { Badge, Button, Input } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

function statusClass(status: MonthStatus): string {
  const found = MONTH_STATUS_LEGEND.find((l) => l.status === status)
  return found?.color ?? ''
}

function statusLabel(status: MonthStatus): string {
  if (status == null) return '空白'
  return status
}

function statusShort(status: MonthStatus): string {
  if (status == null) return ''
  return status === '矯正圓滿' ? '圓' : status.charAt(0)
}

export function AnnualPlan({ store }: { store: AuditStore }) {
  const { state, updateSettings, regeneratePlan, updatePlanRow, setPlanMonthStatus } = store
  const { settings, company } = state
  const effectiveExternalAuditDate = state.externalAuditPrep.externalAuditDate?.trim() || settings.externalAuditDate
  const dateWarnings = evaluateDateSequence({ ...settings, externalAuditDate: effectiveExternalAuditDate })

  const [regenConfirm, setRegenConfirm] = useState(false)
  const ownerConfirm = useDepartmentOwnerConfirm(store)

  const deptOwner = (departmentId: string) =>
    company.departments.find((d) => d.id === departmentId)?.owner ?? ''

  const leadAuditorName = useMemo(() => {
    const personId = resolveLeadAuditorPersonId(
      state.people,
      state.activeCompanyId,
      settings.auditYear,
      state.annualPersonnelAssignments,
      settings.planWindowEnd || `${settings.auditYear}-12-31`,
    )
    return state.people.find((person) => person.id === personId)?.name ?? '主任稽核員任命未完成'
  }, [state.people, state.activeCompanyId, state.annualPersonnelAssignments, settings.auditYear, settings.planWindowEnd])

  const externalAuditDate = state.externalAuditPrep.externalAuditDate ?? settings.externalAuditDate ?? ''

  const requiredStandards = useMemo(
    () => state.companyAuditProfiles[state.activeCompanyId].applicableStandards
      .filter((standard) => standard.confirmationStatus === 'confirmed')
      .map((standard) => `${standard.name}:${standard.version}`),
    [state.companyAuditProfiles, state.activeCompanyId],
  )

  const referenceDate = settings.planWindowEnd || `${settings.auditYear}-12-31`
  const pagination = useTablePagination(company.planRows.length, 10, undefined, String(settings.auditYear))

  return (
    <div className="space-y-6 print-area qr-form">
      <ConfirmDialog
        open={regenConfirm}
        title="自動編排年度計畫"
        description="未手動鎖定的計畫列，月格狀態將依風險與窗口重新計算。已手動調整的列會保留。"
        confirmLabel="重新編排"
        onConfirm={() => {
          regeneratePlan()
          setRegenConfirm(false)
        }}
        onCancel={() => setRegenConfirm(false)}
      />
      <DepartmentOwnerConfirm ownerConfirm={ownerConfirm} />

      {dateWarnings.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 no-print dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          {dateWarnings.map((msg) => (
            <p key={msg}>⚠ {msg}</p>
          ))}
        </div>
      )}

      <div>
        <PageToolbar
          title="年度稽核計畫"
          actions={<Button onClick={() => setRegenConfirm(true)}>依日期與利害關係人自動編排</Button>}
        />

        <div className="mb-4 flex flex-wrap gap-2 text-xs no-print">
          {MONTH_STATUS_LEGEND.map((l) => (
            <span key={l.label} className={`rounded px-2 py-1 ${l.color}`}>{l.label}</span>
          ))}
          <span className="text-muted">（點擊月格切換排程；滿意／不滿意等由查檢與 NCR 推導）</span>
        </div>

        <details className="mb-6 no-print">
          <summary className="cursor-pointer text-sm font-medium text-ink">計畫窗口與日期設定</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="年度起始"
              type="date"
              value={settings.yearStart}
              onChange={(v) => updateSettings({ yearStart: v })}
            />
            <Input
              label="計畫窗口起"
              type="date"
              value={settings.planWindowStart}
              onChange={(v) => updateSettings({ planWindowStart: v })}
            />
            <Input
              label="計畫窗口迄"
              type="date"
              value={settings.planWindowEnd}
              onChange={(v) => updateSettings({ planWindowEnd: v })}
            />
            <div>
              <span className="mb-1 block text-sm font-medium text-ink">外部稽核日期</span>
              <p className="text-sm text-muted">
                {externalAuditDate || '尚未填寫'}
                <a href={buildAppHash('prep')} className="ml-2 font-medium text-link hover:underline">
                  至外稽準備編輯
                </a>
              </p>
            </div>
            <Input
              label="管理審查日期"
              type="date"
              value={settings.managementReviewDate ?? ''}
              onChange={(v) => updateSettings({ managementReviewDate: v })}
            />
          </div>
        </details>

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="年度內部稽核計畫 QR-28-01"
          subtitle={`主任稽核員：${leadAuditorName}`}
        />

        <div className="print-only mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <p>計畫窗口：{settings.planWindowStart || '—'} ～ {settings.planWindowEnd || '—'}</p>
          <p>年度起始：{settings.yearStart || '—'}</p>
          <p>管理審查日期：{settings.managementReviewDate || '—'}</p>
          <p>外部稽核日期：{externalAuditDate || '—'}</p>
        </div>

        <div className="print-only mb-2 flex flex-wrap justify-center gap-3 text-xs">
          {MONTH_STATUS_LEGEND.map((l) => (
            <span key={l.label}>{l.label}</span>
          ))}
        </div>

        <ScrollRegion ariaLabel="年度稽核計畫月格表">
          <table className="qr-plan-table w-max min-w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: '2.25rem' }} />
              <col style={{ width: '2.75rem' }} />
              <col style={{ width: '4.25rem' }} />
              <col style={{ width: '4.5rem' }} />
              <col style={{ width: '8rem' }} />
              <col style={{ width: '6rem' }} />
              <col style={{ width: '4rem' }} />
              <col style={{ width: '4.5rem' }} />
              {MONTHS.map((month) => <col key={month} style={{ width: '2.75rem' }} />)}
            </colgroup>
            <thead>
              <tr className="whitespace-nowrap bg-page text-left text-muted">
                <th className="border border-line px-1.5 py-2">項次</th>
                <th className="border border-line px-1.5 py-2">風險</th>
                <th className="min-w-[5.5rem] border border-line px-1.5 py-2 whitespace-nowrap">QP</th>
                <th className="border border-line px-1.5 py-2">被稽核部門</th>
                <th className="border border-line px-1.5 py-2 whitespace-normal">稽核流程/文件</th>
                <th className="border border-line px-1.5 py-2">負責人</th>
                <th className="border border-line px-1.5 py-2">類型</th>
                <th className="border border-line px-1.5 py-2">稽核人員</th>
                {MONTHS.map((m) => (
                  <th key={m} className="border border-line p-1 text-center w-11">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {company.planRows.map((row, rowIndex) => {
                const unscheduled = !row.months.some(Boolean)
                return (
                <tr
                  key={row.id}
                  className={`${!pagination.isVisible(rowIndex) ? 'pagination-hidden-row ' : ''}${
                    unscheduled
                      ? 'bg-rose-50/60 dark:bg-rose-950/20'
                      : row.manualOverride
                        ? 'bg-amber-50/50 dark:bg-amber-950/20'
                        : ''
                  }`}
                >
                  <td className="border border-line px-1.5 py-2 tabular-nums">{row.sequence}</td>
                  <td className="border border-line px-1.5 py-2"><Badge label={row.riskLevel} /></td>
                  <td className="min-w-[5.5rem] border border-line px-1.5 py-2 font-medium">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="whitespace-nowrap">{row.qpCode}</span>
                      {unscheduled && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-900 no-print">
                          未排月格
                        </span>
                      )}
                      {!unscheduled && row.manualOverride && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 no-print">
                          已手動調整
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border border-line px-1.5 py-2 break-words">{row.department}</td>
                  <td className="border border-line px-1.5 py-2 break-words">
                    <div>{row.process}</div>
                    <div className="text-xs text-muted">{row.documents}</div>
                  </td>
                  <td className="border border-line px-1.5 py-2">
                    <DepartmentOwnerField
                      departmentId={row.departmentId}
                      savedOwner={deptOwner(row.departmentId)}
                      displayOwner={row.owner}
                      ariaLabel={`${row.qpCode} 負責人`}
                      onSaveRequest={ownerConfirm.requestChange}
                      candidates={departmentMemberCandidates(
                        state.people,
                        state.activeCompanyId,
                        row.departmentId,
                        referenceDate,
                      )}
                      inputClassName="px-1 py-0.5"
                      selectClassName="!min-w-0 !w-24 !px-1.5 !py-1"
                    />
                  </td>
                  <td className="border border-line px-1.5 py-2 text-xs break-words">{row.auditCategory}</td>
                  <td className="border border-line px-1.5 py-2 break-words">
                    <AuditorMultiSelect
                      value={row.auditors}
                      onChange={(auditors) => updatePlanRow(row.id, { auditors })}
                      candidates={auditorCandidates(
                        state.people,
                        state.activeCompanyId,
                        row.qpCode,
                        row.departmentId,
                        referenceDate,
                        requiredStandards,
                      )}
                      people={state.people}
                      compact
                      ariaLabel={`${row.qpCode} ${row.department} 稽核人員`}
                    />
                  </td>
                  {(Array.isArray(row.months) ? row.months : []).map((scheduledStatus, i) => {
                    const displayStatus = scheduledStatus
                      ? getDisplayMonthStatus(row, i, company.audits, company.ncrs, settings.auditYear)
                      : null
                    return (
                    <td key={i} className="border border-line p-0.5 text-center">
                      <button
                        type="button"
                        title={`排程：${statusLabel(scheduledStatus)} · 顯示：${statusLabel(displayStatus)}`}
                        aria-label={`${row.qpCode} ${i + 1} 月：${statusLabel(displayStatus)}`}
                        className={`no-print h-11 w-11 rounded text-xs font-medium ${FOCUS_RING} ${statusClass(displayStatus)}`}
                        onClick={() => setPlanMonthStatus(row.id, i, cycleMonthStatus(scheduledStatus))}
                      >
                        {statusShort(displayStatus)}
                      </button>
                      <span className={`print-only inline-block h-6 w-6 text-xs leading-6 ${statusClass(displayStatus)}`}>
                        {statusShort(displayStatus)}
                      </span>
                    </td>
                  )})}
                </tr>
              )})}
            </tbody>
          </table>
        </ScrollRegion>
        <TablePagination pagination={pagination} label="年度稽核計畫" />
      </div>
    </div>
  )
}
