import { countObservationJudgments } from '../lib/scoring'
import { buildMergedCertificateCoverage } from '../lib/coverage'
import {
  effectiveExternalAuditDate,
  evaluatePrepSequence,
  getManagementReviewCompletionBlockers,
} from '../lib/externalAuditPrep'
import {
  countCurrentYearOpenObservations,
  countPriorOpenObservations,
} from '../lib/dashboardMetrics'
import type { AuditStore } from '../hooks/useAuditStore'
import { ScrollRegion } from './ui/ScrollRegion'

interface DashboardProps {
  state: AuditStore['state']
}

export function Dashboard({ state }: DashboardProps) {
  const { company, settings, externalAuditPrep } = state
  const checklistObservations = company.audits.reduce(
    (sum, audit) => sum + audit.items.reduce((n, item) => n + countObservationJudgments(item), 0),
    0,
  )
  const coverage = buildMergedCertificateCoverage(company, settings.auditYear, settings.scoringRules)
  const internalGapCount = coverage.gaps.length + coverage.dualPendingItems.length
  const managementReviewDate = settings.managementReviewDate?.trim() ?? ''
  const sequence = evaluatePrepSequence({
    prep: externalAuditPrep,
    workspace: state.workspace,
    settings,
    yearArchives: state.yearArchives,
  })
  const externalAuditDate = effectiveExternalAuditDate(externalAuditPrep, settings)
  const managementReviewBlockers = getManagementReviewCompletionBlockers({
    internalAuditComplete: sequence.internalAuditComplete,
    managementReviewDate,
    externalAuditDate,
  })
  const openNCR = company.ncrs.filter((n) => n.status !== '結案').length
  const currentYearOpenObs = countCurrentYearOpenObservations(state)
  const priorOpenObs = countPriorOpenObservations(state)
  const openSug = company.suggestions.filter((s) => s.status === 'open').length
  const reportedAudits = company.audits.filter((audit) => audit.status === '已回報').length

  const summaryMetrics: Array<{ key: string; label: string; value: string; hint?: string }> = [
    {
      key: 'reported',
      label: '查檢已回報',
      value: `${reportedAudits}/${company.audits.length}`,
    },
    {
      key: 'ncr',
      label: '未結 NCR',
      value: String(openNCR),
      hint: openNCR !== company.ncrs.length ? `共 ${company.ncrs.length} 筆紀錄` : undefined,
    },
    {
      key: 'internal-audit',
      label: '內部稽核',
      value: coverage.allInternalAuditComplete ? '已覆蓋' : `缺口 ${internalGapCount}`,
    },
    {
      key: 'management-review-date',
      label: '管審日期',
      value: managementReviewDate || '尚未填寫',
      hint: externalAuditPrep.managementReviewComplete && !managementReviewDate
        ? '已勾選管審，但年度計畫尚未填管審日期'
        : undefined,
    },
    {
      key: 'management-review-ready',
      label: '管審前置',
      value: managementReviewBlockers.length > 0 ? '尚缺' : '已齊',
      hint: managementReviewBlockers.length > 0 ? managementReviewBlockers.join('；') : undefined,
    },
  ]

  const trackingRows = [
    {
      key: 'check-observations',
      label: '查檢判定觀察',
      value: checklistObservations,
    },
    {
      key: 'current-observations',
      label: '本年度待追蹤觀察',
      value: currentYearOpenObs,
    },
    {
      key: 'prior-observations',
      label: '前年度未結觀察',
      value: priorOpenObs,
    },
    {
      key: 'suggestions',
      label: '待追蹤建議',
      value: openSug,
    },
  ]

  const overviewRows = [
    ...summaryMetrics.map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      hint: metric.hint,
    })),
    ...trackingRows.map((row) => ({
      key: row.key,
      label: row.label,
      value: String(row.value),
      hint: undefined as string | undefined,
    })),
  ]

  return (
    <div className="print-area">
      <ScrollRegion ariaLabel="稽核總覽">
        <table className="worksheet-table min-w-[24.9rem]">
          <colgroup>
            <col className="col-overview-item" />
            <col className="col-status" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>項目</th>
              <th>結果</th>
              <th>說明</th>
            </tr>
          </thead>
          <tbody>
            {overviewRows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="font-bold tabular-nums">{row.value}</td>
                <td>{row.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  )
}
