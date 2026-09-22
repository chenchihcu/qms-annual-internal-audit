import { useEffect, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { useDepartmentOwnerConfirm } from '../hooks/useDepartmentOwnerConfirm'
import { DepartmentOwnerField } from './DepartmentOwnerField'
import { DepartmentOwnerConfirm } from './DepartmentOwnerConfirm'
import { evaluateDateSequence } from '../lib/coverage'
import { FOCUS_RING } from '../lib/focusRing'
import { cycleMonthStatus } from '../lib/planner'
import { parseAuditYear } from '../lib/settingsYear'
import { MONTH_STATUS_LEGEND, STAKEHOLDER_TAGS } from '../types'
import type { MonthStatus } from '../types'
import { Badge, Button, Card, Input } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PrintDocHeader } from './ui/PrintDocHeader'

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
  const { state, updateSettings, regeneratePlan, updatePlanRow, setPlanMonthStatus, updateDepartment } =
    store
  const { settings, company } = state
  const dateWarnings = evaluateDateSequence(settings)

  const [yearDraft, setYearDraft] = useState(String(settings.auditYear))
  const [yearDialog, setYearDialog] = useState<{ open: boolean; newYear: number }>({
    open: false,
    newYear: settings.auditYear,
  })
  const [regenConfirm, setRegenConfirm] = useState(false)
  const ownerConfirm = useDepartmentOwnerConfirm(store)

  const deptOwner = (departmentId: string) =>
    company.departments.find((d) => d.id === departmentId)?.owner ?? ''

  useEffect(() => {
    setYearDraft(String(settings.auditYear))
  }, [settings.auditYear])

  const requestYearChange = (raw: string) => {
    setYearDraft(raw)
    const n = parseAuditYear(raw)
    if (n === null || n === settings.auditYear) return
    setYearDialog({ open: true, newYear: n })
  }

  const revertInvalidYear = () => {
    if (parseAuditYear(yearDraft) === null) {
      setYearDraft(String(settings.auditYear))
    }
  }

  const confirmYearKeepPrep = () => {
    updateSettings({ auditYear: yearDialog.newYear }, { resetExternalPrep: false })
    setYearDialog({ open: false, newYear: yearDialog.newYear })
  }

  const confirmYearResetPrep = () => {
    updateSettings({ auditYear: yearDialog.newYear }, { resetExternalPrep: true })
    setYearDialog({ open: false, newYear: yearDialog.newYear })
  }

  const cancelYearChange = () => {
    setYearDraft(String(settings.auditYear))
    setYearDialog({ open: false, newYear: settings.auditYear })
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <ConfirmDialog
        open={yearDialog.open}
        title="變更稽核年度"
        description={`將稽核年度改為 ${yearDialog.newYear} 年。預設會保留外部稽核準備清單的勾選與備註，僅更新年度標記。`}
        confirmLabel="保留準備清單"
        secondaryLabel="改為空白新年清單"
        onConfirm={confirmYearKeepPrep}
        onSecondary={confirmYearResetPrep}
        onCancel={cancelYearChange}
      />
      <ConfirmDialog
        open={regenConfirm}
        title="自動編排年度計畫"
        description="未手動鎖定（未標示 manualOverride）的計畫列，月格狀態將依風險與窗口重新計算。已手動調整的列會保留。"
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

      <Card>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 no-print">
          <div>
            <h2 className="text-lg font-semibold text-ink">年度稽核計畫（QR-28-01）</h2>
            <p className="text-sm text-muted">程序導向編排 · 月格狀態對應紙本圖例</p>
          </div>
          <Button onClick={() => setRegenConfirm(true)}>依日期與利害關係人自動編排</Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-xs no-print">
          {MONTH_STATUS_LEGEND.map((l) => (
            <span key={l.label} className={`rounded px-2 py-1 ${l.color}`}>{l.label}</span>
          ))}
          <span className="text-muted">（點擊月格循環切換狀態）</span>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 no-print">
          <Input
            label="稽核年度"
            type="number"
            value={yearDraft}
            onChange={requestYearChange}
            onBlur={revertInvalidYear}
          />
          <Input
            label="主任稽核員"
            value={settings.leadAuditor}
            onChange={(v) => updateSettings({ leadAuditor: v })}
          />
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
          <Input
            label="外部稽核日期"
            type="date"
            value={settings.externalAuditDate ?? ''}
            onChange={(v) => updateSettings({ externalAuditDate: v })}
          />
          <Input
            label="管理審查日期"
            type="date"
            value={settings.managementReviewDate ?? ''}
            onChange={(v) => updateSettings({ managementReviewDate: v })}
          />
        </div>

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="年度內部稽核計畫 QR-28-01"
          subtitle={`主任稽核員：${settings.leadAuditor}`}
        />

        <div className="print-only mb-2 flex flex-wrap justify-center gap-3 text-xs">
          {MONTH_STATUS_LEGEND.map((l) => (
            <span key={l.label}>{l.label}</span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <p className="mb-2 text-xs text-muted no-print">表格可左右滑動</p>
          <table className="qr-plan-table w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border border-line p-2">項次</th>
                <th className="border border-line p-2">風險</th>
                <th className="border border-line p-2">QP</th>
                <th className="border border-line p-2">被稽核部門</th>
                <th className="border border-line p-2">稽核流程/文件</th>
                <th className="border border-line p-2">負責人</th>
                <th className="border border-line p-2">類型</th>
                <th className="border border-line p-2">稽核人員</th>
                {MONTHS.map((m) => (
                  <th key={m} className="border border-line p-1 text-center w-11">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {company.planRows.map((row) => {
                const unscheduled = !row.months.some(Boolean)
                return (
                <tr
                  key={row.id}
                  className={
                    unscheduled
                      ? 'bg-rose-50/60 dark:bg-rose-950/20'
                      : row.manualOverride
                        ? 'bg-amber-50/50 dark:bg-amber-950/20'
                        : ''
                  }
                >
                  <td className="border border-line p-2">{row.sequence}</td>
                  <td className="border border-line p-2"><Badge label={row.riskLevel} /></td>
                  <td className="border border-line p-2 font-medium">{row.qpCode}</td>
                  <td className="border border-line p-2">{row.department}</td>
                  <td className="border border-line p-2">
                    <div>{row.process}</div>
                    <div className="text-xs text-muted">{row.documents}</div>
                  </td>
                  <td className="border border-line p-2">
                    <DepartmentOwnerField
                      departmentId={row.departmentId}
                      savedOwner={deptOwner(row.departmentId)}
                      displayOwner={row.owner}
                      ariaLabel={`${row.qpCode} 負責人`}
                      onSaveRequest={ownerConfirm.requestChange}
                      inputClassName="px-1 py-0.5"
                    />
                  </td>
                  <td className="border border-line p-2 text-xs">{row.auditCategory}</td>
                  <td className="border border-line p-2">
                    <input
                      className={`w-full rounded border border-line bg-surface px-1 py-0.5 text-sm no-print ${FOCUS_RING}`}
                      value={row.auditors}
                      onChange={(e) => updatePlanRow(row.id, { auditors: e.target.value })}
                    />
                    <span className="print-only">{row.auditors}</span>
                  </td>
                  {(Array.isArray(row.months) ? row.months : []).map((status, i) => (
                    <td key={i} className="border border-line p-0.5 text-center">
                      <button
                        type="button"
                        title={statusLabel(status)}
                        aria-label={`${row.qpCode} ${i + 1} 月：${statusLabel(status)}`}
                        className={`no-print h-11 w-11 rounded text-xs font-medium ${FOCUS_RING} ${statusClass(status)}`}
                        onClick={() => setPlanMonthStatus(row.id, i, cycleMonthStatus(status))}
                      >
                        {statusShort(status)}
                      </button>
                      <span className={`print-only inline-block h-6 w-6 text-xs leading-6 ${statusClass(status)}`}>
                        {statusShort(status)}
                      </span>
                    </td>
                  ))}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="no-print">
        <h3 className="mb-4 text-lg font-semibold text-ink">利害關係人設定</h3>
        <div className="space-y-4">
          {company.departments.map((dept) => (
            <div key={dept.id} className="rounded-lg border border-line p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{dept.name}</span>
                <span className="text-sm text-muted">負責人</span>
                <DepartmentOwnerField
                  departmentId={dept.id}
                  savedOwner={dept.owner}
                  ariaLabel={`${dept.name} 負責人`}
                  onSaveRequest={ownerConfirm.requestChange}
                  className="min-w-[12rem] flex-1"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {STAKEHOLDER_TAGS.map((tag) => {
                  const active = dept.stakeholders.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs ${FOCUS_RING} ${active ? 'border-primary bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'border-line text-muted'}`}
                      onClick={() => {
                        const stakeholders = active
                          ? dept.stakeholders.filter((s) => s !== tag)
                          : [...dept.stakeholders, tag]
                        updateDepartment(dept.id, { stakeholders })
                      }}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
