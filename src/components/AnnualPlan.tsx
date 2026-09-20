import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportAnnualPlanExcel, exportAnnualPlanHtml } from '../lib/formExport'
import { autoArrangePlan, cycleMonthStatus, MANUAL_OVERRIDE_PLAN_NOTE } from '../lib/planner'
import { buildEffectiveProcedureRisks } from '../lib/risk'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import { MONTH_STATUS_LEGEND } from '../types'
import type { MonthStatus } from '../types'
import { leadAuditorCandidates } from '../lib/personnel'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { ScrollRegion } from './ui/ScrollRegion'

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

function statusClass(status: MonthStatus): string {
  const found = MONTH_STATUS_LEGEND.find((l) => l.status === status)
  return found?.color ?? ''
}

function statusShort(status: MonthStatus): string {
  if (status == null) return ''
  const label = typeof status === 'string' ? status : String(status)
  if (!label) return ''
  return label === '矯正圓滿' ? '圓' : label.charAt(0)
}

export function AnnualPlan({ store }: { store: AuditStore }) {
  const { state, replacePlanRows, updatePlanRow, setPlanMonthStatus, updateSettings } = store
  const { settings, company, people, annualPersonnelAssignments } = state
  const [previewRows, setPreviewRows] = useState<typeof company.planRows | null>(null)

  const previewPlan = () => {
    const openCount = company.observations.filter((item) => item.status === 'open').length + company.suggestions.filter((item) => item.status === 'open').length + company.ncrs.filter((item) => item.status !== '結案').length
    setPreviewRows(autoArrangePlan({ departments: company.departments, planEntries: PROCEDURE_PLAN_TEMPLATE, auditYear: settings.auditYear, planWindowStart: settings.planWindowStart, planWindowEnd: settings.planWindowEnd, managementReviewDate: settings.managementReviewDate, existingRows: company.planRows, openCarryForwardCount: openCount, procedureRisks: buildEffectiveProcedureRisks(company) }, { leadAuditor: settings.leadAuditor }))
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <Card className="print-break">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 no-print">
          <div>
            <h2 className="text-sm font-semibold">年度稽核計畫</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={ACTION_ICONS.preview} onClick={previewPlan}>預覽自動編排</Button>
            <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportAnnualPlanExcel(state, state.activeCompanyId)}>
              匯出 Excel
            </Button>
            <Button variant="ghost" icon={ACTION_ICONS.exportHtml} onClick={() => exportAnnualPlanHtml(state, state.activeCompanyId)}>
              匯出 HTML
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 no-print">
          <Input label="計畫窗口起" type="date" value={settings.planWindowStart} onChange={(value) => updateSettings({ planWindowStart: value })} />
          <Input label="計畫窗口迄" type="date" value={settings.planWindowEnd} onChange={(value) => updateSettings({ planWindowEnd: value })} />
          <Select
            label="主任稽核員（人員名單）"
            value={leadAuditorCandidates(people, settings.auditYear, annualPersonnelAssignments).find((p) => p.name === settings.leadAuditor)?.id ?? ''}
            onChange={(personId) => {
              const person = people.find((p) => p.id === personId)
              if (person) updateSettings({ leadAuditor: person.name })
            }}
            options={[
              { value: '', label: '自填或待指派' },
              ...leadAuditorCandidates(people, settings.auditYear, annualPersonnelAssignments).map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <Input label="主任稽核員（紙本顯示姓名）" value={settings.leadAuditor} onChange={(value) => updateSettings({ leadAuditor: value })} />
          <Input label="年度起算日" type="date" value={settings.yearStart} onChange={(value) => updateSettings({ yearStart: value })} />
          <Input label="管理審查日期" type="date" value={settings.managementReviewDate ?? ''} onChange={(value) => updateSettings({ managementReviewDate: value })} />
        </div>

        {previewRows && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-blue-950">自動編排預覽</h3>
                <p className="text-sm text-blue-800">共 {previewRows.length} 個程序；{MANUAL_OVERRIDE_PLAN_NOTE}</p>
              </div>
              <div className="flex gap-2">
                <Button icon="check" onClick={() => { replacePlanRows(previewRows); setPreviewRows(null) }}>套用預覽</Button>
                <Button variant="secondary" onClick={() => setPreviewRows(null)}>取消</Button>
              </div>
            </div>
            <div className="mt-3 max-h-48 overflow-y-auto text-xs text-blue-950">
              {previewRows.map((row) => (
                <div key={row.id} className="flex justify-between border-t border-blue-100 py-1">
                  <span>{row.qpCode} · {row.department}</span>
                  <span>{row.months.map((status, index) => status ? `${index + 1}月` : '').filter(Boolean).join('、') || '未排程'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2 text-xs no-print">
          {MONTH_STATUS_LEGEND.map((l) => (
            <span key={l.label} className={`rounded px-2 py-1 ${l.color}`}>{l.label}</span>
          ))}
          <span className="text-slate-400">（點擊月格循環切換狀態）</span>
        </div>

        <div className="print-only qr-form-header mb-4 text-center">
          <h1 className="text-xl font-bold">{company.name}</h1>
          <p>{settings.auditYear} 年度內部稽核計畫 QR-28-01 · 主任稽核員：{settings.leadAuditor}</p>
        </div>

        <div className="print-only mb-2 flex flex-wrap justify-center gap-3 text-xs">
          {MONTH_STATUS_LEGEND.map((l) => (
            <span key={l.label}>{l.label}</span>
          ))}
        </div>

        <ScrollRegion ariaLabel="年度稽核計畫 QR-28-01">
          <table className="qr-plan-table w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border p-2">項次</th>
                <th className="border p-2">風險</th>
                <th className="border p-2">QP</th>
                <th className="border p-2">被稽核部門</th>
                <th className="border p-2">稽核流程/文件</th>
                <th className="border p-2">負責人</th>
                <th className="border p-2">類型</th>
                <th className="border p-2">稽核人員</th>
                {MONTHS.map((m) => (
                  <th key={m} className="border p-1 text-center w-10">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {company.planRows.map((row) => (
                <tr key={row.id} className={row.manualOverride ? 'bg-amber-50/50' : ''}>
                  <td className="border p-2">{row.sequence}</td>
                  <td className="border p-2"><Badge label={row.riskLevel} /></td>
                  <td className="border p-2 font-medium">{row.qpCode}</td>
                  <td className="border p-2">{row.department}</td>
                  <td className="border p-2">
                    <div>{row.process}</div>
                    <div className="text-xs text-slate-500">{row.documents}</div>
                  </td>
                  <td className="border p-2">{row.owner}</td>
                  <td className="border p-2 text-xs">{row.auditCategory}</td>
                  <td className="border p-2">
                    <input
                      className="w-full rounded border border-slate-200 px-1 py-0.5 text-sm no-print"
                      aria-label={`${row.qpCode} ${row.department} 稽核人員`}
                      value={row.auditors}
                      onChange={(e) => updatePlanRow(row.id, { auditors: e.target.value })}
                    />
                    <span className="print-only">{row.auditors}</span>
                  </td>
                  {row.months.map((status, i) => (
                    <td key={i} className="border p-0.5 text-center">
                      <button
                        type="button"
                        title={typeof status === 'string' ? status : '空白'}
                        aria-label={`${row.qpCode} ${row.department} ${MONTHS[i]}月狀態`}
                        className={`no-print min-h-10 min-w-10 rounded text-xs font-medium ${statusClass(status)}`}
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
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </Card>
    </div>
  )
}
