import {
  buildMergedCertificateCoverage,
  gapReasonLabel,
  type PlanGap,
} from '../lib/coverage'
import {
  calculateAnnualScore,
  formatScoreDisplay,
  hasAnyJudgment,
  type ScoreStatus,
} from '../lib/scoring'
import {
  countPrepProgress,
  listPrepGaps,
  summarizePrepGaps,
} from '../lib/externalAuditPrep'
import type { NavigateOptions } from '../lib/navigation'
import { buildPlanRowKey } from '../lib/planRowOptions'
import { FOCUS_RING } from '../lib/focusRing'
import type { AuditStore } from '../hooks/useAuditStore'
import type { TabId } from '../types'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'

interface DashboardProps {
  state: AuditStore['state']
  onNavigate: (tab: TabId, options?: NavigateOptions) => void
}

const linkButtonClass = `text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${FOCUS_RING}`

function scoreStatusLabel(status: ScoreStatus): string {
  switch (status) {
    case 'scored':
      return '已評'
    case 'incomplete':
      return '未完成'
    case 'unevaluated':
      return '未評'
    case 'not_applicable':
      return '不適用'
  }
}

function navigateGap(g: PlanGap, onNavigate: DashboardProps['onNavigate']) {
  if (g.reason === 'audit_missing' || g.reason === 'audit_incomplete') {
    onNavigate('audit', { auditKey: buildPlanRowKey(g.qpCode, g.departmentId) })
  } else {
    onNavigate('plan')
  }
}

export function Dashboard({ state, onNavigate }: DashboardProps) {
  const { company, settings, externalAuditPrep } = state
  const summary = calculateAnnualScore(company.audits, settings.scoringRules)
  const prepProgress = countPrepProgress(externalAuditPrep, state.companyRelationships)
  const prepContext = { company, rules: settings.scoringRules }
  const prepGaps = listPrepGaps(externalAuditPrep, prepContext)
  const prepGapLines = summarizePrepGaps(externalAuditPrep, prepContext, 5)
  const prepGapTotal =
    prepGaps.separateHalfDone.length +
    prepGaps.separateOpen.length +
    prepGaps.mergedOpen.length +
    prepGaps.siteOpen.length +
    prepGaps.qpBlocked.length
  const mergedCoverage = buildMergedCertificateCoverage(
    company,
    settings.auditYear,
    settings.scoringRules,
  )
  const openNCR = company.ncrs.filter((n) => n.status !== '結案').length
  const openObs = company.observations.filter((o) => o.status === 'open').length
  const openSug = company.suggestions.filter((s) => s.status === 'open').length
  const plannedMonths = company.planRows.reduce(
    (sum, r) => sum + r.months.filter(Boolean).length,
    0,
  )
  const scoredDepts = summary.departmentScores.filter((d) => d.status === 'scored')
  const anyJudgment = hasAnyJudgment(company.audits)

  const navigateToAudit = (auditId: string) => {
    const audit = company.audits.find((a) => a.id === auditId)
    if (audit) {
      onNavigate('audit', { auditKey: buildPlanRowKey(audit.qpCode, audit.departmentId) })
    }
  }

  const byCategory = {
    系統稽核: company.planRows.filter((r) => r.auditCategory === '系統稽核').length,
    製程稽核: company.planRows.filter((r) => r.auditCategory === '製程稽核').length,
    型態稽核: company.planRows.filter((r) => r.auditCategory === '型態稽核').length,
  }

  const overallDisplay = formatScoreDisplay({
    score: summary.overallScore,
    status: summary.overallStatus,
    totalItems: 0,
    applicableItems: 0,
    breakdown: { conform: 0, nonConform: 0, observation: 0, notApplicable: 0, pending: 0 },
  })

  const prepHint =
    prepGaps.separateHalfDone.length > 0
      ? `${prepGaps.separateHalfDone.length} 項只勾一家`
      : prepGapTotal > 0
        ? `尚有 ${prepGapTotal} 項待備`
        : '抬頭規則已齊'

  const annualMetricRows = [
    {
      key: 'overall',
      label: '年度總分',
      value: overallDisplay,
      hint: summary.overallStatus === 'scored' ? '已評程序加權' : '尚無已評程序',
      tab: null as TabId | null,
    },
    {
      key: 'open-ncr',
      label: '未結案 NCR',
      value: String(openNCR),
      hint: `全部 ${company.ncrs.length} 件`,
      tab: 'ncr' as TabId,
    },
    {
      key: 'observation',
      label: '本年查檢觀察',
      value: String(summary.totalObservation),
      hint: '查檢表判定「觀察」',
      tab: 'observations' as TabId,
      section: 'current' as const,
    },
    {
      key: 'prior-obs',
      label: '跨年待追蹤',
      value: String(openObs),
      hint: '前年度觀察 open',
      tab: 'observations' as TabId,
      section: 'prior' as const,
    },
    {
      key: 'suggestions',
      label: '第三方建議',
      value: String(openSug),
      hint: '待追蹤建議',
      tab: 'suggestions' as TabId,
    },
    {
      key: 'planned',
      label: '計畫稽核次數',
      value: String(plannedMonths),
      hint: '年度計畫月格合計',
      tab: 'plan' as TabId,
    },
    {
      key: 'prep',
      label: '外部稽核準備（兩證）',
      value: `${prepProgress.done}/${prepProgress.total}`,
      hint: prepHint,
      tab: 'prep' as TabId,
    },
  ]

  const categoryRows = [
    { key: 'system', label: '系統稽核', value: String(byCategory.系統稽核), hint: '—' },
    { key: 'process', label: '製程稽核', value: String(byCategory.製程稽核), hint: '—' },
    { key: 'config', label: '型態稽核', value: String(byCategory.型態稽核), hint: '—' },
  ]

  const coverageSummaryRows = [
    {
      key: 'internal-complete',
      label: '內部稽核完成',
      value: mergedCoverage.allInternalAuditComplete ? '是' : '否',
    },
    {
      key: 'open-ncr-total',
      label: '未結 NCR 合計',
      value: String(mergedCoverage.totalOpenNcr),
    },
    {
      key: 'ncr-jiurun',
      label: '未結 NCR（九潤）',
      value: String(mergedCoverage.openNcrByScope.jiurun),
    },
    {
      key: 'ncr-zlx',
      label: '未結 NCR（正隆興）',
      value: String(mergedCoverage.openNcrByScope.zhenglongxing),
    },
    {
      key: 'ncr-both',
      label: '未結 NCR（兩證）',
      value: String(mergedCoverage.openNcrByScope.both),
    },
    {
      key: 'plan-gaps',
      label: '共用計畫缺口',
      value: String(mergedCoverage.gaps.length),
      hint: '件',
    },
    {
      key: 'dual-pending',
      label: '雙證未判定',
      value: String(mergedCoverage.dualPendingItems.length),
      hint: '項',
    },
    {
      key: 'prep-gaps',
      label: '外稽準備漏口',
      value: String(prepGapTotal),
      hint: '項',
    },
  ]

  return (
    <div className="space-y-6 print-area">
      <PrintDocHeader
        companyName={company.name}
        auditYear={settings.auditYear}
        formTitle="年度稽核儀表板"
      />

      <div>
        <h2 className="mb-4 text-sm font-semibold text-ink">年度指標</h2>
        <ScrollRegion ariaLabel="年度指標統計表">
          <table className="stacked-table w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-page text-left text-muted">
                <th className="p-2">指標</th>
                <th className="p-2 w-28">數值</th>
                <th className="p-2">補充</th>
                <th className="p-2 w-24 no-print">前往</th>
              </tr>
            </thead>
            <tbody>
              {annualMetricRows.map((row) => (
                <tr key={row.key} className="border-b border-line">
                  <td data-label="指標" className="p-2 font-medium text-ink">{row.label}</td>
                  <td data-label="數值" className="p-2 font-semibold text-ink">{row.value}</td>
                  <td data-label="補充" className="p-2 text-muted">{row.hint}</td>
                  <td data-label="前往" className="p-2 no-print">
                    {row.tab ? (
                      <button
                        type="button"
                        className={`text-sm text-link hover:underline ${FOCUS_RING}`}
                        onClick={() =>
                          onNavigate(
                            row.tab!,
                            row.section ? { section: row.section } : undefined,
                          )
                        }
                      >
                        前往
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {categoryRows.map((row) => (
                <tr key={row.key} className="border-b border-line">
                  <td data-label="指標" className="p-2 font-medium text-ink">{row.label}</td>
                  <td data-label="數值" className="p-2 font-semibold text-ink">{row.value}</td>
                  <td data-label="補充" className="p-2 text-muted">{row.hint}</td>
                  <td data-label="前往" className="p-2 no-print">
                    <button
                      type="button"
                      className={`text-sm text-link hover:underline ${FOCUS_RING}`}
                      onClick={() => onNavigate('plan')}
                    >
                      前往
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </div>

      <div className="no-print">
        <h2 className="mb-4 text-sm font-semibold text-ink">兩張證書缺口（合併檢視）</h2>
        <ScrollRegion ariaLabel="兩證缺口摘要統計表">
          <table className="stacked-table w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-page text-left text-muted">
                <th className="p-2">項目</th>
                <th className="p-2 w-28">數值</th>
                <th className="p-2 w-16">單位</th>
              </tr>
            </thead>
            <tbody>
              {coverageSummaryRows.map((row) => (
                <tr key={row.key} className="border-b border-line">
                  <td data-label="項目" className="p-2 text-ink">{row.label}</td>
                  <td data-label="數值" className="p-2 font-semibold text-ink">{row.value}</td>
                  <td data-label="單位" className="p-2 text-muted">{row.hint ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 font-medium text-ink">
              共用計畫／查檢
              <span className="ml-2 text-xs text-muted">缺口 {mergedCoverage.gaps.length}</span>
            </p>
            {mergedCoverage.gaps.length === 0 ? (
              <p className="text-sm text-green-700">計畫與查檢已覆蓋</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted">
                {mergedCoverage.gaps.slice(0, 12).map((g) => (
                  <li key={`${g.qpCode}-${g.departmentId}-${g.reason}`}>
                    <button
                      type="button"
                      className={linkButtonClass}
                      onClick={() => navigateGap(g, onNavigate)}
                    >
                      {g.qpCode} · {g.department} — {gapReasonLabel(g.reason)}
                      {g.detail ? `（${g.detail}）` : ''}
                    </button>
                  </li>
                ))}
                {mergedCoverage.gaps.length > 12 && (
                  <li>…另有 {mergedCoverage.gaps.length - 12} 項</li>
                )}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 font-medium text-ink">
              ◎◎ 雙證查檢項
              <span className="ml-2 text-xs text-muted">
                未判定 {mergedCoverage.dualPendingItems.length}
              </span>
            </p>
            {mergedCoverage.dualPendingItems.length === 0 ? (
              <p className="text-sm text-green-700">雙證項已判定</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted">
                {mergedCoverage.dualPendingItems.slice(0, 12).map((d) => (
                  <li key={`${d.qpCode}-${d.no}-${d.category}`}>
                    <button
                      type="button"
                      className={linkButtonClass}
                      onClick={() =>
                        onNavigate('audit', {
                          auditKey: buildPlanRowKey(d.qpCode, d.departmentId),
                        })
                      }
                    >
                      {d.qpCode} · {d.department} · NO {d.no} {d.category}
                    </button>
                  </li>
                ))}
                {mergedCoverage.dualPendingItems.length > 12 && (
                  <li>…另有 {mergedCoverage.dualPendingItems.length - 12} 項</li>
                )}
              </ul>
            )}
          </div>
        </div>

        {prepGapTotal > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium text-ink">外稽準備抬頭漏口（年度共用）</p>
            <ul className="space-y-1 text-xs text-muted">
              {prepGapLines.map((line) => (
                <li key={`${line.no}-${line.text}`}>
                  <button type="button" className={linkButtonClass} onClick={() => onNavigate('prep')}>
                    {line.text}
                  </button>
                </li>
              ))}
              {prepGapTotal > prepGapLines.length && (
                <li>
                  <button
                    type="button"
                    className={`text-left font-medium text-primary hover:underline ${linkButtonClass}`}
                    onClick={() => onNavigate('prep')}
                  >
                    …另有 {prepGapTotal - prepGapLines.length} 項
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold text-ink">各程序稽核得分</h2>
        {!anyJudgment && scoredDepts.length === 0 ? (
          <EmptyState message="尚無稽核判定，請至「程序稽核」填寫查檢表。" />
        ) : (
          <ScrollRegion ariaLabel="各程序稽核得分統計表">
            <table className="stacked-table w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-page text-left text-muted">
                  <th className="p-2">程序</th>
                  <th className="p-2 w-24">狀態</th>
                  <th className="p-2 w-24">得分</th>
                  <th className="p-2 w-24 text-center">適用項</th>
                  <th className="p-2 w-32 no-print">前往</th>
                </tr>
              </thead>
              <tbody>
                {summary.departmentScores.map((d) => (
                  <tr key={d.auditId} className="border-b border-line">
                    <td data-label="程序" className="p-2 font-medium text-ink">{d.label}</td>
                    <td data-label="狀態" className="p-2 text-ink">{scoreStatusLabel(d.status)}</td>
                    <td data-label="得分" className="p-2 font-semibold text-ink">
                      {formatScoreDisplay({
                        score: d.score,
                        status: d.status,
                        totalItems: 0,
                        applicableItems: d.applicableItems,
                        breakdown: {
                          conform: 0,
                          nonConform: 0,
                          observation: 0,
                          notApplicable: 0,
                          pending: 0,
                        },
                      })}
                    </td>
                    <td data-label="適用項" className="p-2 text-center text-ink">{d.applicableItems}</td>
                    <td data-label="前往" className="p-2 no-print">
                      <button
                        type="button"
                        className={`text-sm text-link hover:underline ${FOCUS_RING}`}
                        aria-label={`開啟 ${d.label}`}
                        onClick={() => navigateToAudit(d.auditId)}
                      >
                        開啟
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </div>
    </div>
  )
}
