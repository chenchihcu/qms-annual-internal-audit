import {
  calculateAnnualScore,
  formatScoreDisplay,
} from '../lib/scoring'
import { buildMergedCertificateCoverage } from '../lib/coverage'
import {
  countPrepProgress,
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
  const summary = calculateAnnualScore(company.audits, settings.scoringRules)
  const prepProgress = countPrepProgress(externalAuditPrep)
  const coverage = buildMergedCertificateCoverage(company, settings.auditYear, settings.scoringRules)
  const internalGapCount = coverage.gaps.length + coverage.dualPendingItems.length
  const managementReviewDate = settings.managementReviewDate?.trim() ?? ''
  const sequence = evaluatePrepSequence({
    prep: externalAuditPrep,
    workspace: state.workspace,
    settings,
    yearArchives: state.yearArchives,
  })
  const effectiveExternalAuditDate = externalAuditPrep.externalAuditDate?.trim() || settings.externalAuditDate?.trim()
  const managementReviewBlockers = getManagementReviewCompletionBlockers({
    internalAuditComplete: sequence.internalAuditComplete,
    managementReviewDate,
    externalAuditDate: effectiveExternalAuditDate,
  })
  const openNCR = company.ncrs.filter((n) => n.status !== '結案').length
  const currentYearOpenObs = countCurrentYearOpenObservations(state)
  const priorOpenObs = countPriorOpenObservations(state)
  const openSug = company.suggestions.filter((s) => s.status === 'open').length
  const plannedMonths = company.planRows.reduce(
    (sum, row) => sum + row.months.filter(Boolean).length,
    0,
  )
  const plannedRows = company.planRows.filter((row) => row.months.some(Boolean)).length
  const reportedAudits = company.audits.filter((audit) => audit.status === '已回報').length

  const overallDisplay = formatScoreDisplay({
    score: summary.overallScore,
    status: summary.overallStatus,
    totalItems: 0,
    applicableItems: 0,
    breakdown: { conform: 0, nonConform: 0, observation: 0, notApplicable: 0, pending: 0 },
  })

  const summaryMetrics = [
    {
      key: 'score',
      label: '年度總分',
      value: overallDisplay,
      hint: `已回報 ${reportedAudits}/${company.audits.length} 件`,
    },
    {
      key: 'planned',
      label: '已排月格',
      value: String(plannedMonths),
      hint: `計畫項目 ${plannedRows}/${company.planRows.length} 列`,
    },
    {
      key: 'ncr',
      label: '未結 NCR',
      value: String(openNCR),
      hint: openNCR !== company.ncrs.length ? `共 ${company.ncrs.length} 筆紀錄` : undefined,
    },
    {
      key: 'prep',
      label: '外稽準備',
      value: `${prepProgress.done}/${prepProgress.total}`,
    },
    {
      key: 'internal-audit',
      label: '內部稽核',
      value: coverage.allInternalAuditComplete ? '已覆蓋' : `缺口 ${internalGapCount}`,
      hint: coverage.allInternalAuditComplete ? undefined : `尚有 ${internalGapCount} 項缺口`,
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
      value: summary.totalObservation,
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
                <td className="font-medium tabular-nums">{row.value}</td>
                <td>{row.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  )
}
