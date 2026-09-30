import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRecordDisclosure } from '../hooks/useRecordDisclosure'
import type { AuditStore } from '../hooks/useAuditStore'
import { useDepartmentOwnerConfirm } from '../hooks/useDepartmentOwnerConfirm'
import { DepartmentOwnerField } from './DepartmentOwnerField'
import { DepartmentOwnerConfirm } from './DepartmentOwnerConfirm'
import { evaluateDateSequence } from '../lib/coverage'
import { FOCUS_RING } from '../lib/focusRing'
import { buildAppHash } from '../lib/navigation'
import { getDisplayMonthStatus, type MonthCellChoice } from '../lib/planStatus'
import { auditorCandidates, departmentMemberCandidates, resolveLeadAuditorPersonId } from '../lib/personnel'
import { AuditorMultiSelect } from './ui/AuditorMultiSelect'
import { MONTH_STATUS_LEGEND } from '../types'
import type { MonthStatus, TabId } from '../types'
import { WorkflowGuide } from './ui/WorkflowGuide'
import { Badge, Button, Input } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
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

const MONTH_CELL_CHOICES: { choice: MonthCellChoice; label: string }[] = [
  { choice: 'blank', label: '空白' },
  { choice: '擬定', label: '擬定' },
  { choice: '滿意', label: '滿意' },
  { choice: '不滿意', label: '不滿意' },
  { choice: '矯正中', label: '矯正中' },
  { choice: '矯正圓滿', label: '矯正圓滿' },
]

function storedMonthChoice(scheduled: MonthStatus, override: MonthStatus | null | undefined): MonthCellChoice {
  if (override === '滿意' || override === '不滿意' || override === '矯正中' || override === '矯正圓滿') return override
  return scheduled ? '擬定' : 'blank'
}

function MonthChoiceMenu({
  anchor,
  label,
  current,
  onSelect,
  onClose,
}: {
  anchor: DOMRect
  label: string
  current: MonthCellChoice
  onSelect: (choice: MonthCellChoice) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-month-anchor]')) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const top = Math.min(anchor.bottom + 4, window.innerHeight - 300)
  const left = Math.min(Math.max(8, anchor.left), window.innerWidth - 140)

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      className="fixed z-40 min-w-28 rounded-lg border border-line bg-surface p-1"
      style={{ top, left }}
    >
      {MONTH_CELL_CHOICES.map((item) => (
        <button
          key={item.choice}
          type="button"
          role="menuitemradio"
          aria-checked={current === item.choice}
          className={`flex min-h-11 w-full items-center whitespace-nowrap rounded px-3 text-left text-sm ${FOCUS_RING} ${
            current === item.choice ? statusClass(item.choice === 'blank' ? null : item.choice) : 'hover:bg-page'
          }`}
          onClick={() => onSelect(item.choice)}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

export function AnnualPlan({ store, onNavigate }: { store: AuditStore; onNavigate?: (tab: TabId) => void }) {
  const { state, updateSettings, regeneratePlan, updatePlanRow, setPlanMonthChoice } = store
  const { settings, company } = state
  const effectiveExternalAuditDate = state.externalAuditPrep.externalAuditDate?.trim() || settings.externalAuditDate
  const dateWarnings = evaluateDateSequence({ ...settings, externalAuditDate: effectiveExternalAuditDate })

  const [regenConfirm, setRegenConfirm] = useState(false)
  const [openMonth, setOpenMonth] = useState<{ key: string; rect: DOMRect } | null>(null)
  const closeMonthMenu = useCallback(() => setOpenMonth(null), [])
  const [expandedId, setExpandedId] = useRecordDisclosure(`${WORKSPACE_COMPANY_ID}:${settings.auditYear}`)
  const ownerConfirm = useDepartmentOwnerConfirm(store)

  const deptOwner = (departmentId: string) =>
    company.departments.find((d) => d.id === departmentId)?.owner ?? ''

  const leadAuditorName = useMemo(() => {
    const personId = resolveLeadAuditorPersonId(
      state.people,
      WORKSPACE_COMPANY_ID,
      settings.auditYear,
      state.annualPersonnelAssignments,
      settings.planWindowEnd || `${settings.auditYear}-12-31`,
    )
    return state.people.find((person) => person.id === personId)?.name ?? '主任稽核員任命未完成'
  }, [state.people, state.annualPersonnelAssignments, settings.auditYear, settings.planWindowEnd])

  const externalAuditDate = state.externalAuditPrep.externalAuditDate ?? settings.externalAuditDate ?? ''

  const requiredStandards = useMemo(
    () => state.auditProfile.applicableStandards
      .filter((standard) => standard.confirmationStatus === 'confirmed')
      .map((standard) => `${standard.name}:${standard.version}`),
    [state.auditProfile],
  )

  const referenceDate = settings.planWindowEnd || `${settings.auditYear}-12-31`
  const pagination = useTablePagination(company.planRows.length, 10, undefined, String(settings.auditYear))

  return (
    <div className="space-y-6 print-area qr-form">
      <ConfirmDialog
        open={regenConfirm}
        title="自動編排年度計畫"
        description="未手動調整的計畫列，將依日期、利害關係人與風險重排月格（寫入擬定）。已手動調整的列會保留。"
        confirmLabel="重新編排"
        onConfirm={() => {
          regeneratePlan()
          setRegenConfirm(false)
        }}
        onCancel={() => setRegenConfirm(false)}
      />
      <DepartmentOwnerConfirm ownerConfirm={ownerConfirm} />

      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3 no-print">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
            {MONTH_STATUS_LEGEND.map((l) => (
              <span key={l.label} className={`rounded px-2 py-1 ${l.color}`}>{l.label}</span>
            ))}
            <span className="text-muted">（點月格可選排程或滿意／不滿意／矯正中／矯正圓滿；未手選時仍由查檢與 NCR 推導）</span>
          </div>
          <Button className="shrink-0" onClick={() => setRegenConfirm(true)}>依日期與利害關係人自動編排</Button>
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
          <table className="qr-plan-table worksheet-table min-w-[69.5rem]">
            <colgroup>
              <col className="col-seq" />
              <col className="col-status" />
              <col />
              <col className="col-name" />
              <col className="print-table-column" />
              <col className="print-table-column" />
              <col className="print-table-column" />
              <col className="col-name" />
              {MONTHS.map((month) => <col key={month} className="col-month" />)}
            </colgroup>
            <thead>
              <tr>
                <th>項次</th>
                <th>風險</th>
                <th>QP<span className="no-print">／流程</span></th>
                <th>被稽核部門</th>
                <th className="print-table-cell whitespace-normal">稽核流程/文件</th>
                <th className="print-table-cell">負責人</th>
                <th className="print-table-cell">類型</th>
                <th>稽核人員</th>
                {MONTHS.map((m) => (
                  <th key={m} className="p-1 text-center w-11">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {company.planRows.map((row, rowIndex) => {
                const unscheduled = !row.months.some(Boolean)
                const expanded = expandedId === row.id
                return (
                <Fragment key={row.id}>
                <tr
                  data-plan-row-id={row.id}
                  className={`${!pagination.isVisible(rowIndex) ? 'pagination-hidden-row ' : ''}${
                    unscheduled
                      ? 'bg-rose-50/60 dark:bg-rose-950/20'
                      : row.manualOverride
                        ? 'bg-amber-50/50 dark:bg-amber-950/20'
                        : ''
                  }`}
                >
                  <td className="tabular-nums">{row.sequence}</td>
                  <td><Badge label={row.riskLevel} /></td>
                  <td className="font-medium break-words">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <a
                        href={buildAppHash('audit', { auditKey: `${row.qpCode}|${row.departmentId}` })}
                        aria-label={`${row.qpCode} ${row.department} 查檢表`}
                        className={`inline-flex min-h-11 w-fit shrink-0 items-center whitespace-nowrap text-link hover:underline ${FOCUS_RING}`}
                      >{row.qpCode}</a>
                      <button
                        type="button"
                        className={`no-print inline-flex min-h-11 w-fit shrink-0 items-center whitespace-nowrap text-sm text-link hover:underline ${FOCUS_RING}`}
                        aria-label={`${row.qpCode} ${row.department} 明細`}
                        aria-expanded={expanded}
                        aria-controls={`plan-detail-${row.id}`}
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                      >{expanded ? '收合' : '明細'}</button>
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
                    <div className="no-print text-xs text-muted">{row.process}</div>
                  </td>
                  <td className="break-words">{row.department}</td>
                  <td className="print-table-cell break-words">
                    <div>{row.process}</div>
                    <div className="text-xs text-muted">{row.documents}</div>
                  </td>
                  <td className="print-table-cell break-words">{row.owner}</td>
                  <td className="print-table-cell text-xs break-words">{row.auditCategory}</td>
                  <td className="break-words">
                    <AuditorMultiSelect
                      value={row.auditors}
                      onChange={(auditors) => updatePlanRow(row.id, { auditors })}
                      candidates={auditorCandidates(
                        state.people,
                        WORKSPACE_COMPANY_ID,
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
                    const monthKey = `${row.id}|${i}`
                    const menuLabel = `${row.qpCode} ${i + 1} 月狀態`
                    return (
                    <td key={i} className="p-0.5 text-center">
                      <button
                        type="button"
                        data-month-anchor={monthKey}
                        title={`排程：${statusLabel(scheduledStatus)} · 顯示：${statusLabel(displayStatus)}`}
                        aria-label={`${row.qpCode} ${i + 1} 月：${statusLabel(displayStatus)}`}
                        aria-haspopup="menu"
                        aria-expanded={openMonth?.key === monthKey}
                        aria-controls={openMonth?.key === monthKey ? `month-menu-${row.id}-${i}` : undefined}
                        className={`no-print h-11 w-11 rounded text-xs font-medium ${FOCUS_RING} ${statusClass(displayStatus)}`}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect()
                          setOpenMonth((current) => current?.key === monthKey ? null : { key: monthKey, rect })
                        }}
                      >
                        {statusShort(displayStatus)}
                      </button>
                      {openMonth?.key === monthKey && (
                        <MonthChoiceMenu
                          anchor={openMonth.rect}
                          label={menuLabel}
                          current={storedMonthChoice(scheduledStatus, row.manualMonthOverrides?.[i])}
                          onSelect={(choice) => {
                            setPlanMonthChoice(row.id, i, choice)
                            setOpenMonth(null)
                          }}
                          onClose={closeMonthMenu}
                        />
                      )}
                      <span className={`print-only text-xs ${statusClass(displayStatus)}`}>
                        {statusShort(displayStatus)}
                      </span>
                    </td>
                  )})}
                </tr>
                <tr id={`plan-detail-${row.id}`} hidden={!expanded || !pagination.isVisible(rowIndex)} className="no-print bg-page">
                  <td colSpan={17} className="p-3">
                    {expanded && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="min-w-0 break-words"><span className="block text-xs text-muted">對應文件</span>{row.documents || '—'}</div>
                        <div>
                          <span className="mb-1 block text-sm">負責人</span>
                          <DepartmentOwnerField
                            departmentId={row.departmentId}
                            savedOwner={deptOwner(row.departmentId)}
                            displayOwner={row.owner}
                            ariaLabel={`${row.qpCode} ${row.department} 負責人`}
                            onSaveRequest={ownerConfirm.requestChange}
                            candidates={departmentMemberCandidates(state.people, WORKSPACE_COMPANY_ID, row.departmentId, referenceDate)}
                          />
                        </div>
                        <div><span className="block text-xs text-muted">稽核類型</span>{row.auditCategory}</div>
                      </div>
                    )}
                  </td>
                </tr>
                </Fragment>
              )})}
            </tbody>
          </table>
        </ScrollRegion>
        <TablePagination pagination={pagination} label="年度稽核計畫" />
      </div>
      <div className="flex flex-wrap items-stretch gap-3 no-print empty:hidden">
        <WorkflowGuide tab="plan" state={state} onNavigate={onNavigate} className="min-w-[min(100%,16rem)] flex-1" />
        {dateWarnings.length > 0 && (
          <div
            role="alert"
            className="min-w-[min(100%,16rem)] flex-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            {dateWarnings.map((msg) => (
              <p key={msg}>⚠ {msg}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
