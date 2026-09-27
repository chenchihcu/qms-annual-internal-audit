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
import { FOCUS_RING } from '../lib/focusRing'
import type { AuditStore } from '../hooks/useAuditStore'
import type { TabId } from '../types'

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
      hint: `共 ${company.ncrs.length} 筆紀錄`,
      tab: 'ncr' as TabId,
    },
    {
      key: 'prep',
      label: '外稽準備',
      value: `${prepProgress.done}/${prepProgress.total}`,
      hint: prepProgress.done < prepProgress.total
        ? `尚有 ${prepProgress.total - prepProgress.done} 項待辦`
        : '準備項目已完成',
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

  return (
    <div className="space-y-5 print-area">
      <header>
        <h2 className="text-base font-semibold text-ink">稽核總覽</h2>
      </header>

      <section aria-labelledby="dashboard-summary-heading">
        <h3 id="dashboard-summary-heading" className="sr-only">年度摘要</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryMetrics.map((metric) => (
            <button
              key={metric.key}
              type="button"
              className={`min-w-0 rounded-lg border border-line bg-surface p-4 text-left transition hover:border-primary/50 hover:bg-page ${FOCUS_RING}`}
              aria-label={`前往：${metric.label}`}
              onClick={() => onNavigate(metric.tab)}
            >
              <span className="block text-sm text-muted">{metric.label}</span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums text-ink">{metric.value}</span>
              <span className="mt-1 block text-xs text-muted">{metric.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="dashboard-followups-heading" className="rounded-lg border border-line bg-surface p-4">
        <h3 id="dashboard-followups-heading" className="mb-3 text-sm font-semibold text-ink">追蹤清單</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {trackingRows.map((row) => (
            <button
              key={row.key}
              type="button"
              className={`flex min-h-14 items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-left hover:bg-page ${FOCUS_RING}`}
              aria-label={`前往：${row.label}`}
              onClick={() => onNavigate(row.tab, row.options)}
            >
              <span className="text-sm text-ink">{row.label}</span>
              <span className="text-lg font-semibold tabular-nums text-ink">{row.value}</span>
            </button>
          ))}
        </div>
      </section>

    </div>
  )
}
