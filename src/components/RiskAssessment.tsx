import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { buildAppHash } from '../lib/navigation'
import { calculateRiskLevel, RISK_BANDS, suggestRiskBump } from '../lib/risk'
import { scoreProcedureAudit } from '../lib/scoring'
import { Badge } from './ui/Badge'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

export function RiskAssessment({ store }: { store: AuditStore }) {
  const { state, updateDepartment } = store
  const { company, settings } = state
  const [riskDrafts, setRiskDrafts] = useState<Record<string, string>>({})
  const [riskErrors, setRiskErrors] = useState<Record<string, string>>({})
  const taggedDepartments = company.departments.filter((dept) => dept.stakeholders.length > 0).length

  const updateRiskValue = (departmentId: string, field: 'riskOccurrence' | 'riskSeverity', raw: string) => {
    const key = `${departmentId}:${field}`
    setRiskDrafts((drafts) => ({ ...drafts, [key]: raw }))
    const value = Number(raw)
    if (!raw || !Number.isInteger(value) || value < 1 || value > 5) {
      setRiskErrors((errors) => ({ ...errors, [key]: '請輸入 1 至 5 的整數。' }))
      return
    }
    updateDepartment(departmentId, { [field]: value })
    setRiskDrafts((drafts) => {
      const next = { ...drafts }
      delete next[key]
      return next
    })
    setRiskErrors((errors) => {
      const next = { ...errors }
      delete next[key]
      return next
    })
  }

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

      <div>
        <PageToolbar
          title="方案風險"
          meta={(
            <span className="block">
              風險指數 = 發生度 O × 嚴重度 S（各 1–5 分）· 高 {RISK_BANDS.high.min}–{RISK_BANDS.high.max} · 中 {RISK_BANDS.medium.min}–{RISK_BANDS.medium.max} · 低 {RISK_BANDS.low.min}–{RISK_BANDS.low.max}
            </span>
          )}
        />

        <ScrollRegion ariaLabel="部門風險評估表格">
          <table className="stacked-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border border-line p-2">部門／負責人</th>
                <th className="border border-line p-2 w-24">發生度 O</th>
                <th className="border border-line p-2 w-24">嚴重度 S</th>
                <th className="border border-line p-2 w-20">指數</th>
                <th className="border border-line p-2 w-20">等級</th>
                <th className="border border-line p-2 w-24">平均分</th>
                <th className="border border-line p-2 w-24">未結 NCR</th>
                <th className="border border-line p-2">建議 O</th>
              </tr>
            </thead>
            <tbody>
              {deptStats.length === 0 && (
                <tr><td colSpan={8} className="border border-line p-4 text-center text-muted">尚無部門資料</td></tr>
              )}
              {deptStats.map(({ dept, score, ncrCount, suggested }) => {
                const { index, level } = calculateRiskLevel(
                  dept.riskOccurrence,
                  dept.riskSeverity,
                )
                return (
                  <tr key={dept.id}>
                    <td data-label="部門／負責人" className="border border-line p-2">
                      <div className="font-medium text-ink">{dept.name}</div>
                      <div className="text-xs text-muted">{dept.owner}</div>
                    </td>
                    <td data-label="發生度 O" className="border border-line p-2">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={1}
                        className={`min-h-11 w-20 rounded border border-line bg-surface px-2 py-1 ${FOCUS_RING}`}
                        value={riskDrafts[`${dept.id}:riskOccurrence`] ?? dept.riskOccurrence}
                        aria-label={`${dept.name} 發生度 O（1 至 5）`}
                        aria-invalid={Boolean(riskErrors[`${dept.id}:riskOccurrence`])}
                        aria-describedby={riskErrors[`${dept.id}:riskOccurrence`] ? `${dept.id}-risk-occurrence-error` : undefined}
                        onChange={(e) => updateRiskValue(dept.id, 'riskOccurrence', e.target.value)}
                      />
                      {riskErrors[`${dept.id}:riskOccurrence`] && <p id={`${dept.id}-risk-occurrence-error`} className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{riskErrors[`${dept.id}:riskOccurrence`]}</p>}
                    </td>
                    <td data-label="嚴重度 S" className="border border-line p-2">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={1}
                        className={`min-h-11 w-20 rounded border border-line bg-surface px-2 py-1 ${FOCUS_RING}`}
                        value={riskDrafts[`${dept.id}:riskSeverity`] ?? dept.riskSeverity}
                        aria-label={`${dept.name} 嚴重度 S（1 至 5）`}
                        aria-invalid={Boolean(riskErrors[`${dept.id}:riskSeverity`])}
                        aria-describedby={riskErrors[`${dept.id}:riskSeverity`] ? `${dept.id}-risk-severity-error` : undefined}
                        onChange={(e) => updateRiskValue(dept.id, 'riskSeverity', e.target.value)}
                      />
                      {riskErrors[`${dept.id}:riskSeverity`] && <p id={`${dept.id}-risk-severity-error`} className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{riskErrors[`${dept.id}:riskSeverity`]}</p>}
                    </td>
                    <td data-label="風險指數" className="border border-line p-2 text-center font-semibold text-ink">{index}</td>
                    <td data-label="風險等級" className="border border-line p-2"><Badge label={level} /></td>
                    <td data-label="平均分" className="border border-line p-2 text-ink">
                      {score !== null ? `${Math.round(score)}%` : '未評'}
                    </td>
                    <td data-label="未結 NCR" className="border border-line p-2 text-ink">{ncrCount}</td>
                    <td data-label="建議 O" className="border border-line p-2">
                      <div className="flex items-center gap-2">
                        <span className={suggested > dept.riskOccurrence ? 'font-bold text-red-600 dark:text-red-400' : ''}>
                          {suggested}
                        </span>
                        {suggested > dept.riskOccurrence && (
                          <button
                            type="button"
                            className={`min-h-11 px-2 text-xs text-link hover:underline ${FOCUS_RING}`}
                            onClick={() =>
                              updateDepartment(dept.id, { riskOccurrence: suggested })
                            }
                          >
                            採用
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollRegion>
      </div>

      <div className="no-print rounded-lg border border-line bg-surface p-4">
        <p className="text-sm text-ink">
          利害關係人已標註{' '}
          <span className="font-semibold">{taggedDepartments}/{company.departments.length}</span>{' '}
          部門（{company.name}）
        </p>
        <a
          href={buildAppHash('stakeholders')}
          className="mt-2 inline-block text-sm font-medium text-link hover:underline"
        >
          至利害關係人編輯
        </a>
      </div>
    </div>
  )
}
