import { Fragment, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportRiskExcel } from '../lib/formExport'
import { autoArrangePlan } from '../lib/planner'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import {
  buildEffectiveProcedureRisks,
  calculateProcedurePriority,
  PROCEDURE_RISK_WEIGHTS,
  type ProcedurePriorityInput,
} from '../lib/risk'
import type { PlanRow } from '../types'
import { Badge, Button, Card, Input } from './ui/Badge'

type RiskFactorField = keyof ProcedurePriorityInput
type RiskFilter = 'all' | 'unsaved' | 'provisional'

const FACTOR_COLUMNS: Array<{ field: RiskFactorField; label: string; required?: boolean }> = [
  { field: 'inherentRisk', label: '固有', required: true },
  { field: 'previousInternalNcrCount', label: '內稽' },
  { field: 'previousThirdPartyNcrCount', label: '三方' },
  { field: 'overdueOpenNcrCount', label: '逾期' },
  { field: 'customerComplaintLevel', label: '客訴' },
  { field: 'changeImpact', label: '變更' },
  { field: 'monthsSinceLastAudit', label: '距上次' },
]

function cycleFactorValue(current: number | undefined, required: boolean): number | undefined {
  if (current == null || Number.isNaN(current)) return 1
  if (current >= 5) return required ? 1 : undefined
  return current + 1
}

function isRowPersisted(
  saved: { inherentRisk: number } | undefined,
): boolean {
  return Boolean(saved && saved.inherentRisk >= 1)
}

export function RiskAssessment({ store }: { store: AuditStore }) {
  const { state, updateProcedureRisk, replacePlanRows } = store
  const { company, settings } = state
  const [previewRows, setPreviewRows] = useState<PlanRow[] | null>(null)
  const [filter, setFilter] = useState<RiskFilter>('all')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const rows = useMemo(() => company.planRows.map((plan) => {
    const saved = company.procedureRisks?.find(
      (item) => item.qpCode === plan.qpCode && item.departmentId === plan.departmentId,
    )
    const openNcr = company.ncrs.filter(
      (item) => item.qpCode === plan.qpCode && item.departmentId === plan.departmentId && item.status !== '結案',
    ).length
    const values: ProcedurePriorityInput = {
      inherentRisk: saved?.inherentRisk ?? (plan.riskLevel === '高' ? 5 : plan.riskLevel === '中' ? 3 : 1),
      previousInternalNcrCount: saved?.previousInternalNcrCount,
      previousThirdPartyNcrCount: saved?.previousThirdPartyNcrCount,
      overdueOpenNcrCount: saved?.overdueOpenNcrCount ?? (openNcr ? Math.min(5, openNcr + 1) : undefined),
      customerComplaintLevel: saved?.customerComplaintLevel,
      changeImpact: saved?.changeImpact,
      monthsSinceLastAudit: saved?.monthsSinceLastAudit,
    }
    const persisted = isRowPersisted(saved)
    const result = calculateProcedurePriority(values)
    return { plan, saved, values, result, persisted }
  }).sort((a, b) => b.result.score - a.result.score), [company])

  const savedCount = rows.filter((row) => row.persisted).length
  const totalCount = rows.length

  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter === 'unsaved') return !row.persisted
    if (filter === 'provisional') return row.persisted && row.result.provisional
    return true
  }), [rows, filter])

  const effectiveRisks = () => buildEffectiveProcedureRisks(company)

  const persistDisplayedRisks = () => {
    effectiveRisks().forEach((record) => {
      updateProcedureRisk(record.qpCode, record.departmentId, record)
    })
  }

  const previewPlan = () => {
    const openCount = company.observations.filter((item) => item.status === 'open').length
      + company.suggestions.filter((item) => item.status === 'open').length
      + company.ncrs.filter((item) => item.status !== '結案').length
    setPreviewRows(autoArrangePlan({
      departments: company.departments,
      planEntries: PROCEDURE_PLAN_TEMPLATE,
      auditYear: settings.auditYear,
      planWindowStart: settings.planWindowStart,
      planWindowEnd: settings.planWindowEnd,
      managementReviewDate: settings.managementReviewDate,
      existingRows: company.planRows,
      openCarryForwardCount: openCount,
      procedureRisks: effectiveRisks(),
    }, { leadAuditor: settings.leadAuditor }))
  }

  const filterButtons: Array<{ id: RiskFilter; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'unsaved', label: '未存檔' },
    { id: 'provisional', label: '暫定' },
  ]

  return (
    <div className="space-y-6 print-area qr-form">
      <div className="print-only qr-form-header mb-4 text-center">
        <h1 className="text-xl font-bold">{company.name}</h1>
        <p className="text-sm">{settings.auditYear} 年 · 方案風險與優先順序 QR-02-01</p>
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-2 text-lg font-semibold">風險指標評估（QR-02-01）</h2>
            <p className="text-sm text-slate-600">
              矩陣評估全部 QP 供年度稽核排序。待確認欄位以中位數暫估並標示「暫定」；點格子循環 1–5，空白顯示 —。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <Button variant="secondary" onClick={persistDisplayedRisks}>採用目前評估並全部存檔</Button>
            <Button onClick={previewPlan}>預覽套用至年度計畫</Button>
            <Button variant="secondary" onClick={() => exportRiskExcel(state, state.activeCompanyId)}>匯出 Excel</Button>
          </div>
        </div>

        {previewRows && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-blue-950">年度計畫套用預覽</h3>
                <p className="text-sm text-blue-800">依方案風險優先順序重排月格；手動覆寫的計畫列會保留。</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { persistDisplayedRisks(); replacePlanRows(previewRows); setPreviewRows(null) }}>確認套用</Button>
                <Button variant="secondary" onClick={() => setPreviewRows(null)}>取消</Button>
              </div>
            </div>
            <div className="mt-3 max-h-48 overflow-y-auto text-xs text-blue-950">
              {previewRows.map((row) => (
                <div key={row.id} className="flex justify-between border-t border-blue-100 py-1">
                  <span>{row.qpCode} · {row.department} · {row.riskLevel}</span>
                  <span>{row.months.map((status, index) => status ? `${index + 1}月` : '').filter(Boolean).join('、') || '未排程'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <p className="text-sm font-medium text-slate-700">
            固有風險已存檔 <span className="text-blue-800">{savedCount}/{totalCount}</span>
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="風險清單篩選">
            {filterButtons.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  filter === id
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300'
                }`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-4 text-xs text-slate-600 sm:grid-cols-3">
          <span>程序固有風險 {PROCEDURE_RISK_WEIGHTS.inherentRisk}%</span>
          <span>上次內稽 NCR {PROCEDURE_RISK_WEIGHTS.previousInternalNcrCount}%</span>
          <span>上次第三方稽核 NCR {PROCEDURE_RISK_WEIGHTS.previousThirdPartyNcrCount}%</span>
          <span>逾期／未結 NCR {PROCEDURE_RISK_WEIGHTS.overdueOpenNcrCount}%</span>
          <span>客戶抱怨 {PROCEDURE_RISK_WEIGHTS.customerComplaintLevel}%</span>
          <span>重大變更 {PROCEDURE_RISK_WEIGHTS.changeImpact}%</span>
          <span>距上次稽核 {PROCEDURE_RISK_WEIGHTS.monthsSinceLastAudit}%</span>
        </div>

        {visibleRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">目前篩選條件沒有程序列</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="qr-risk-matrix w-full min-w-[960px] border-collapse text-sm" data-risk-matrix>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="text-left">
                  <th className="border p-2">QP</th>
                  <th className="border p-2">部門</th>
                  {FACTOR_COLUMNS.map(({ label }) => (
                    <th key={label} className="border p-1 text-center text-xs">{label}</th>
                  ))}
                  <th className="border p-2 text-center">分</th>
                  <th className="border p-2">狀態</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ plan, saved, values, result, persisted }) => {
                  const statusLabel = !persisted
                    ? '未存檔'
                    : result.provisional
                      ? `暫定 ${7 - result.missingFactors.length}/7`
                      : '已確認'
                  const expanded = expandedRowId === plan.id
                  return (
                    <Fragment key={plan.id}>
                      <tr
                        data-risk-key={plan.id}
                        className={`cursor-pointer hover:bg-slate-50 ${expanded ? 'bg-blue-50/40' : ''}`}
                        onClick={() => setExpandedRowId(expanded ? null : plan.id)}
                      >
                        <td className="border p-2 font-medium whitespace-nowrap">{plan.qpCode}</td>
                        <td className="border p-2 whitespace-nowrap">{plan.department}</td>
                        {FACTOR_COLUMNS.map(({ field, label, required }) => {
                          const raw = field === 'inherentRisk'
                            ? (saved?.inherentRisk ?? values.inherentRisk)
                            : saved?.[field]
                          const display = raw == null || Number.isNaN(raw) ? '—' : String(raw)
                          return (
                            <td key={field} className="border p-0.5 text-center">
                              <button
                                type="button"
                                className="no-print h-8 w-8 rounded border border-slate-200 text-xs font-medium hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                                aria-label={`${plan.qpCode} ${plan.department} ${label}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  const next = cycleFactorValue(raw, Boolean(required))
                                  updateProcedureRisk(plan.qpCode, plan.departmentId, { [field]: next })
                                }}
                              >
                                {display}
                              </button>
                              <span className="print-only">{display}</span>
                            </td>
                          )
                        })}
                        <td className="border p-2 text-center font-bold text-blue-800">{result.score}</td>
                        <td className="border p-2 whitespace-nowrap">
                          <Badge
                            label={statusLabel}
                            className={
                              !persisted
                                ? 'border-amber-200 bg-amber-50 text-amber-900'
                                : result.provisional
                                  ? ''
                                  : 'border-green-200 bg-green-100 text-green-800'
                            }
                          />
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={FACTOR_COLUMNS.length + 4} className="border p-3">
                            <p className="mb-1 text-xs font-medium text-slate-600">{plan.process}</p>
                            <Input
                              label="證據／來源"
                              value={saved?.evidenceReference ?? ''}
                              onChange={(value) => updateProcedureRisk(plan.qpCode, plan.departmentId, { evidenceReference: value })}
                            />
                            <p className="mt-1 text-xs text-slate-500">客訴編號、內稽／第三方 NCR、變更紀錄、上次稽核日期</p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
