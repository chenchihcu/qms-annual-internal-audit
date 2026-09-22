import { useMemo } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { calculateRiskLevel, RISK_BANDS, suggestRiskBump } from '../lib/risk'
import { scoreProcedureAudit } from '../lib/scoring'
import { Badge, Card } from './ui/Badge'
import { PrintDocHeader } from './ui/PrintDocHeader'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

export function RiskAssessment({ store }: { store: AuditStore }) {
  const { state, updateDepartment } = store
  const { company, settings } = state

  const deptStats = useMemo(() => {
    return company.departments.map((dept) => {
      const deptAudits = company.audits.filter((a) => a.departmentId === dept.id)
      const scored = deptAudits.filter(
        (a) => scoreProcedureAudit(a, settings.scoringRules).status === 'scored',
      )
      const scores = scored.map((a) => scoreProcedureAudit(a, settings.scoringRules).score ?? 0)
      const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
      const ncrCount = company.ncrs.filter(
        (n) => n.departmentId === dept.id && n.status !== '結案',
      ).length
      const suggested = suggestRiskBump(dept.riskOccurrence, ncrCount, score ?? 100)
      return { dept, score, ncrCount, suggested }
    })
  }, [company.departments, company.audits, company.ncrs, settings.scoringRules])

  return (
    <div className="space-y-6 print-area">
      <PrintDocHeader
        companyName={company.name}
        auditYear={settings.auditYear}
        formTitle="風險指標評估 QR-02-01"
      />

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">風險指標評估（QR-02-01）</h2>
        <p className="mb-4 text-sm text-muted">
          風險指數 = 發生度 O × 嚴重度 S（各 1–5 分）· 高 {RISK_BANDS.high.min}–{RISK_BANDS.high.max} · 中 {RISK_BANDS.medium.min}–{RISK_BANDS.medium.max} · 低 {RISK_BANDS.low.min}–{RISK_BANDS.low.max}
        </p>
        <p className="mb-4 rounded-md border border-line bg-page px-3 py-2 text-xs text-muted">
          本頁為年度稽核排程用部門風險指標，不等同 QR-02-01「風險與機會監控評估表」（含氣候變遷、改善結果隔年填寫等），請於外部稽核準備第 5 項另備證據。
        </p>

        <div className="overflow-x-auto">
          <p className="mb-2 text-xs text-muted no-print">表格可左右滑動</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border border-line p-2">部門 · 負責人</th>
                <th className="border border-line p-2 w-24">發生度 O</th>
                <th className="border border-line p-2 w-24">嚴重度 S</th>
                <th className="border border-line p-2 w-20">指數</th>
                <th className="border border-line p-2 w-20">等級</th>
                <th className="border border-line p-2">稽核後建議 O</th>
              </tr>
            </thead>
            <tbody>
              {deptStats.map(({ dept, score, ncrCount, suggested }) => {
                const { index, level } = calculateRiskLevel(
                  dept.riskOccurrence,
                  dept.riskSeverity,
                )
                return (
                  <tr key={dept.id}>
                    <td className="border border-line p-2">
                      <div className="font-medium text-ink">{dept.name}</div>
                      <div className="text-xs text-muted">{dept.owner}</div>
                    </td>
                    <td className="border border-line p-2">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        className={`w-16 rounded border border-line bg-surface px-2 py-1 ${FOCUS_RING}`}
                        value={dept.riskOccurrence}
                        onChange={(e) =>
                          updateDepartment(dept.id, {
                            riskOccurrence: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="border border-line p-2">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        className={`w-16 rounded border border-line bg-surface px-2 py-1 ${FOCUS_RING}`}
                        value={dept.riskSeverity}
                        onChange={(e) =>
                          updateDepartment(dept.id, {
                            riskSeverity: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="border border-line p-2 text-center font-semibold text-ink">{index}</td>
                    <td className="border border-line p-2"><Badge label={level} /></td>
                    <td className="border border-line p-2">
                      <div className="flex items-center gap-2">
                        <span className={suggested > dept.riskOccurrence ? 'font-bold text-red-600 dark:text-red-400' : ''}>
                          {suggested}
                        </span>
                        {suggested > dept.riskOccurrence && (
                          <button
                            type="button"
                            className={`text-xs text-primary hover:underline ${FOCUS_RING}`}
                            onClick={() =>
                              updateDepartment(dept.id, { riskOccurrence: suggested })
                            }
                          >
                            採用
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted">
                        平均得分 {score !== null ? `${Math.round(score)}%` : '未評'} · NCR {ncrCount}
                      </p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
