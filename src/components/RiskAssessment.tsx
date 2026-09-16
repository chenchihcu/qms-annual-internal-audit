import { useState } from 'react'
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

const FACTOR_FIELD_BY_NAME: Record<string, RiskFactorField> = {
  程序固有風險: 'inherentRisk',
  '上次內稽 NCR': 'previousInternalNcrCount',
  '上次第三方稽核 NCR': 'previousThirdPartyNcrCount',
  '逾期／未結 NCR': 'overdueOpenNcrCount',
  客戶抱怨: 'customerComplaintLevel',
  重大變更: 'changeImpact',
  距上次稽核時間: 'monthsSinceLastAudit',
}

const RISK_FACTOR_GROUPS: Array<{
  title: string
  weight: string
  factors: Array<{ field: RiskFactorField; label: string; weight: number; required?: boolean }>
}> = [
  {
    title: '歷史結果',
    weight: '50%',
    factors: [
      { field: 'previousInternalNcrCount', label: '上次內稽 NCR', weight: PROCEDURE_RISK_WEIGHTS.previousInternalNcrCount },
      { field: 'previousThirdPartyNcrCount', label: '上次第三方稽核 NCR', weight: PROCEDURE_RISK_WEIGHTS.previousThirdPartyNcrCount },
      { field: 'overdueOpenNcrCount', label: '未結／逾期 NCR', weight: PROCEDURE_RISK_WEIGHTS.overdueOpenNcrCount },
    ],
  },
  {
    title: '現況壓力',
    weight: '40%',
    factors: [
      { field: 'inherentRisk', label: '固有風險', weight: PROCEDURE_RISK_WEIGHTS.inherentRisk, required: true },
      { field: 'customerComplaintLevel', label: '客戶抱怨', weight: PROCEDURE_RISK_WEIGHTS.customerComplaintLevel },
      { field: 'changeImpact', label: '重大變更', weight: PROCEDURE_RISK_WEIGHTS.changeImpact },
    ],
  },
  {
    title: '時間',
    weight: '10%',
    factors: [
      { field: 'monthsSinceLastAudit', label: '距上次稽核', weight: PROCEDURE_RISK_WEIGHTS.monthsSinceLastAudit },
    ],
  },
]

function ScaleFive({
  label,
  fieldId,
  value,
  weight,
  required = false,
  onChange,
}: {
  label: string
  fieldId: string
  value: number | undefined
  weight: number
  required?: boolean
  onChange: (value: number | undefined) => void
}) {
  const isMissing = value == null || Number.isNaN(value)

  return (
    <div id={fieldId} className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">{weight}%</span>
      </div>
      <div role="radiogroup" aria-label={`${label}（1–5）`} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={String(n)}
              className={`min-h-11 flex-1 rounded-lg border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => {
                if (selected && !required) {
                  onChange(undefined)
                } else if (!selected) {
                  onChange(n)
                }
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
      {isMissing && (
        <p className="text-xs text-amber-700">尚未填寫 · 分數暫估 3</p>
      )}
    </div>
  )
}

function scrollToFactor(field: RiskFactorField) {
  document.getElementById(`risk-factor-${field}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

export function RiskAssessment({ store }: { store: AuditStore }) {
  const { state, updateProcedureRisk, replacePlanRows } = store
  const { company, settings } = state
  const [previewRows, setPreviewRows] = useState<PlanRow[] | null>(null)

  const rows = company.planRows.map((plan) => {
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
    return { plan, saved, values, result: calculateProcedurePriority(values) }
  }).sort((a, b) => b.result.score - a.result.score)

  const effectiveRisks = () => buildEffectiveProcedureRisks(company)

  const persistDisplayedRisks = () => {
    const effective = effectiveRisks()
    effective.forEach((record) => {
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
              逐一評估全部 QP，供年度稽核排序。這是公司自訂工具，並非 ISO 9001／AS9100 規定公式；上次內稽與第三方稽核 NCR 分開記錄，待確認欄位以中位數暫估，結果會標示「暫定」。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
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

        <div className="mb-6 grid gap-2 rounded-lg bg-slate-50 p-4 text-xs text-slate-600 sm:grid-cols-3">
          <span>程序固有風險 {PROCEDURE_RISK_WEIGHTS.inherentRisk}%</span>
          <span>上次內稽 NCR {PROCEDURE_RISK_WEIGHTS.previousInternalNcrCount}%</span>
          <span>上次第三方稽核 NCR {PROCEDURE_RISK_WEIGHTS.previousThirdPartyNcrCount}%</span>
          <span>逾期／未結 NCR {PROCEDURE_RISK_WEIGHTS.overdueOpenNcrCount}%</span>
          <span>客戶抱怨 {PROCEDURE_RISK_WEIGHTS.customerComplaintLevel}%</span>
          <span>重大變更 {PROCEDURE_RISK_WEIGHTS.changeImpact}%</span>
          <span>距上次稽核 {PROCEDURE_RISK_WEIGHTS.monthsSinceLastAudit}%</span>
        </div>

        <div className="space-y-4">
          {rows.map(({ plan, saved, values, result }) => {
            const filledCount = 7 - result.missingFactors.length
            return (
              <details key={plan.id} data-risk-key={plan.id} className="group rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 rounded-xl p-4 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                  <div>
                    <h3 className="font-semibold">{plan.qpCode} · {plan.process}</h3>
                    <p className="text-sm text-slate-500">{plan.department}</p>
                    {result.provisional && (
                      <p className="mt-1 text-xs text-slate-500">已填 {filledCount}/7</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={result.level} />
                    <span className="text-xl font-bold text-blue-800">{result.score}</span>
                    {result.provisional
                      ? <Badge label={`暫定 ${filledCount}/7`} />
                      : <Badge label="已確認" className="border-green-200 bg-green-100 text-green-800" />}
                  </div>
                </summary>
                <div className="border-t border-slate-100 p-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {RISK_FACTOR_GROUPS.map((group) => (
                      <section key={group.title} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
                          <h4 className="text-sm font-semibold text-slate-800">{group.title}</h4>
                          <span className="text-xs text-slate-500">{group.weight} · 各項 1–5</span>
                        </div>
                        <div className="space-y-4">
                          {group.factors.map(({ field, label, weight, required }) => (
                            <ScaleFive
                              key={field}
                              fieldId={`risk-factor-${field}`}
                              label={label}
                              value={values[field]}
                              weight={weight}
                              required={required}
                              onChange={(next) => updateProcedureRisk(plan.qpCode, plan.departmentId, { [field]: next })}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  {result.provisional && result.missingFactors.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-amber-800">尚缺</span>
                      {result.missingFactors.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          onClick={() => {
                            const field = FACTOR_FIELD_BY_NAME[name]
                            if (field) scrollToFactor(field)
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <Input
                      label="證據／來源"
                      value={saved?.evidenceReference ?? ''}
                      onChange={(value) => updateProcedureRisk(plan.qpCode, plan.departmentId, { evidenceReference: value })}
                    />
                    <p className="mt-1 text-xs text-slate-500">客訴編號、內稽／第三方 NCR、變更紀錄、上次稽核日期</p>
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
