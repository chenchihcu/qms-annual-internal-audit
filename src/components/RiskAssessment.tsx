import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportRiskExcel } from '../lib/formExport'
import { autoArrangePlan } from '../lib/planner'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import { calculateProcedurePriority, PROCEDURE_RISK_WEIGHTS } from '../lib/risk'
import type { PlanRow } from '../types'
import { Badge, Button, Card, Input } from './ui/Badge'

function valueOrBlank(value: number | undefined) {
  return value == null ? '' : value
}

function numeric(value: string) {
  return value === '' ? undefined : Math.min(5, Math.max(1, Number(value)))
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
    const values = {
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
      procedureRisks: company.procedureRisks,
    }, { leadAuditor: settings.leadAuditor }))
  }

  return (
    <div className="space-y-6">
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
                <Button onClick={() => { replacePlanRows(previewRows); setPreviewRows(null) }}>確認套用</Button>
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
          {rows.map(({ plan, saved, values, result }) => (
            <details key={plan.id} data-risk-key={plan.id} className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 rounded-xl p-4 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                <div>
                  <h3 className="font-semibold">{plan.qpCode} · {plan.process}</h3>
                  <p className="text-sm text-slate-500">{plan.department} · {plan.documents}</p>
                  <p className="mt-1 text-xs text-blue-700">展開填寫七項因素與證據</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={result.level} />
                  <span className="text-xl font-bold text-blue-800">{result.score}</span>
                  {result.provisional && <Badge label="暫定" />}
                </div>
              </summary>
              <div className="border-t border-slate-100 p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                  {([
                    ['inherentRisk', '固有風險'],
                    ['previousInternalNcrCount', '上次內稽 NCR'],
                    ['previousThirdPartyNcrCount', '上次第三方稽核 NCR'],
                    ['overdueOpenNcrCount', '未結／逾期 NCR'],
                    ['customerComplaintLevel', '客戶抱怨'],
                    ['changeImpact', '重大變更'],
                    ['monthsSinceLastAudit', '距上次稽核'],
                  ] as const).map(([field, label]) => (
                    <Input
                      key={field}
                      label={`${label}（1–5）`}
                      type="number"
                      value={valueOrBlank(values[field])}
                      onChange={(value) => updateProcedureRisk(plan.qpCode, plan.departmentId, { [field]: numeric(value) })}
                    />
                  ))}
                </div>
                <div className="mt-3">
                  <Input
                    label="證據／來源（客訴編號、內稽／第三方 NCR、變更紀錄、上次稽核日期）"
                    value={saved?.evidenceReference ?? ''}
                    onChange={(value) => updateProcedureRisk(plan.qpCode, plan.departmentId, { evidenceReference: value })}
                  />
                </div>
                {result.provisional && (
                  <p className="mt-2 text-xs text-amber-800">待確認：{result.missingFactors.join('、')}</p>
                )}
              </div>
            </details>
          ))}
        </div>
      </Card>
    </div>
  )
}
