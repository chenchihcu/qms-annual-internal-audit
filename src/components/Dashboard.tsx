import {
  calculateAnnualScore,
  formatScoreDisplay,
} from '../lib/scoring'
import {
  countPrepProgress,
} from '../lib/externalAuditPrep'
import {
  countCurrentYearOpenObservations,
  countPriorOpenObservations,
} from '../lib/dashboardMetrics'
import type { NavigateOptions, ObservationSection } from '../lib/navigation'
import type { AuditStore } from '../hooks/useAuditStore'
import type { TabId } from '../types'
import { Button } from './ui/Badge'
import { ScrollRegion } from './ui/ScrollRegion'

interface DashboardProps {
  state: AuditStore['state']
  onNavigate: (tab: TabId, options?: NavigateOptions) => void
}

export function Dashboard({ state, onNavigate }: DashboardProps) {
  const { company, settings, externalAuditPrep } = state
  const summary = calculateAnnualScore(company.audits, settings.scoringRules)
  const prepProgress = countPrepProgress(externalAuditPrep)
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
      tab: 'audit' as TabId,
    },
    {
      key: 'planned',
      label: '已排月格',
      value: String(plannedMonths),
      hint: `計畫項目 ${plannedRows}/${company.planRows.length} 列`,
      tab: 'plan' as TabId,
    },
    {
      key: 'ncr',
      label: '未結 NCR',
      value: String(openNCR),
      hint: openNCR !== company.ncrs.length ? `共 ${company.ncrs.length} 筆紀錄` : undefined,
      tab: 'ncr' as TabId,
    },
    {
      key: 'prep',
      label: '外稽準備',
      value: `${prepProgress.done}/${prepProgress.total}`,
      tab: 'prep' as TabId,
    },
  ]

  const trackingRows = [
    {
      key: 'check-observations',
      label: '查檢判定觀察',
      value: summary.totalObservation,
      tab: 'observations' as TabId,
      options: { section: 'current' as ObservationSection },
    },
    {
      key: 'current-observations',
      label: '本年度待追蹤觀察',
      value: currentYearOpenObs,
      tab: 'observations' as TabId,
      options: { section: 'current' as ObservationSection },
    },
    {
      key: 'prior-observations',
      label: '前年度未結觀察',
      value: priorOpenObs,
      tab: 'observations' as TabId,
      options: { section: 'prior' as ObservationSection },
    },
    {
      key: 'suggestions',
      label: '待追蹤建議',
      value: openSug,
      tab: 'suggestions' as TabId,
      options: undefined,
    },
  ]

  const overviewRows = [
    ...summaryMetrics.map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      hint: metric.hint,
      tab: metric.tab,
      options: undefined as NavigateOptions | undefined,
    })),
    ...trackingRows.map((row) => ({
      key: row.key,
      label: row.label,
      value: String(row.value),
      hint: undefined as string | undefined,
      tab: row.tab,
      options: row.options,
    })),
  ]

  return (
    <div className="print-area">
      <ScrollRegion ariaLabel="稽核總覽">
        <table className="worksheet-table min-w-[38.4rem]">
          <colgroup>
            <col className="col-overview-item" />
            <col className="col-status" />
            <col />
            <col className="col-action no-print" />
          </colgroup>
          <thead>
            <tr>
              <th>項目</th>
              <th>結果</th>
              <th>說明</th>
              <th className="no-print">操作</th>
            </tr>
          </thead>
          <tbody>
            {overviewRows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="font-medium tabular-nums">{row.value}</td>
                <td>{row.hint}</td>
                <td className="no-print">
                  <Button
                    variant="secondary"
                    aria-label={`前往：${row.label}`}
                    onClick={() => onNavigate(row.tab, row.options)}
                  >
                    開啟
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  )
}
