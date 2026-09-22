import {
  buildMergedCertificateCoverage,
  gapReasonLabel,
} from '../lib/coverage'
import {
  calculateAnnualScore,
  formatScoreDisplay,
  hasAnyJudgment,
} from '../lib/scoring'
import { buildAuditFocusOverview } from '../lib/planner'
import {
  countPrepProgress,
  listPrepGaps,
  summarizePrepGaps,
} from '../lib/externalAuditPrep'
import type { AppState, TabId } from '../types'
import { Badge, Card } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'

interface DashboardProps {
  state: AppState
  onNavigate: (tab: TabId) => void
}

function KpiCard({
  title,
  value,
  hint,
  onClick,
  accent = 'text-primary',
}: {
  title: string
  value: string | number
  hint?: string
  onClick?: () => void
  accent?: string
}) {
  const inner = (
    <>
      <p className="text-sm text-muted">{title}</p>
      <p className={`mt-1 text-3xl font-bold ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl border border-line bg-surface p-5 text-left shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {inner}
      </button>
    )
  }
  return <Card>{inner}</Card>
}

export function Dashboard({ state, onNavigate }: DashboardProps) {
  const { company, settings, externalAuditPrep } = state
  const summary = calculateAnnualScore(company.audits, settings.scoringRules)
  const prepProgress = countPrepProgress(
    externalAuditPrep,
    company,
    settings.auditYear,
    settings.scoringRules,
  )
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
  const focusRows = buildAuditFocusOverview(company.planRows)
  const openNCR = company.ncrs.filter((n) => n.status !== '結案').length
  const openObs = company.observations.filter((o) => o.status === 'open').length
  const openSug = company.suggestions.filter((s) => s.status === 'open').length
  const plannedMonths = company.planRows.reduce(
    (sum, r) => sum + r.months.filter(Boolean).length,
    0,
  )
  const scoredDepts = summary.departmentScores.filter((d) => d.status === 'scored')
  const incompleteDepts = summary.departmentScores.filter(
    (d) => d.status === 'incomplete' || d.status === 'unevaluated',
  )
  const anyJudgment = hasAnyJudgment(company.audits)

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

  const overallPercent =
    summary.overallStatus === 'scored' && summary.overallScore !== null
      ? summary.overallScore
      : 0

  return (
    <div className="space-y-6 print-area">
      <PrintDocHeader
        companyName={company.name}
        auditYear={settings.auditYear}
        formTitle="年度稽核儀表板"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="年度總分"
          value={overallDisplay}
          hint={summary.overallStatus === 'scored' ? '已評程序加權' : '尚無已評程序'}
        />
        <KpiCard
          title="未結案 NCR"
          value={openNCR}
          hint={`全部 ${company.ncrs.length} 件`}
          accent="text-red-600 dark:text-red-400"
          onClick={() => onNavigate('ncr')}
        />
        <KpiCard
          title="本年查檢觀察"
          value={summary.totalObservation}
          hint="查檢表判定「觀察」"
          accent="text-amber-600 dark:text-amber-400"
          onClick={() => onNavigate('observations')}
        />
        <KpiCard
          title="跨年待追蹤"
          value={openObs}
          hint="前年度觀察 open"
          onClick={() => onNavigate('observations')}
        />
        <KpiCard
          title="第三方建議"
          value={openSug}
          hint="待追蹤建議"
          onClick={() => onNavigate('suggestions')}
        />
        <KpiCard
          title="計畫稽核次數"
          value={plannedMonths}
          hint={`系統 ${byCategory.系統稽核} · 製程 ${byCategory.製程稽核} · 型態 ${byCategory.型態稽核}`}
          onClick={() => onNavigate('plan')}
        />
        <KpiCard
          title="外部稽核準備（兩證）"
          value={`${prepProgress.done}/${prepProgress.total}`}
          hint={
            prepGaps.separateHalfDone.length > 0
              ? `${prepGaps.separateHalfDone.length} 項只勾一家`
              : prepGapTotal > 0
                ? `尚有 ${prepGapTotal} 項待備`
                : '抬頭規則已齊'
          }
          accent={
            prepGaps.separateHalfDone.length > 0
              ? 'text-amber-600 dark:text-amber-400'
              : prepGapTotal > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-green-700 dark:text-green-400'
          }
          onClick={() => onNavigate('prep')}
        />
      </div>

      <Card className="no-print">
        <h2 className="mb-3 text-lg font-semibold text-ink">兩張證書缺口（合併檢視）</h2>
        <p className="mb-3 text-sm text-muted">
          內部稽核完成：
          <span
            className={
              mergedCoverage.allInternalAuditComplete
                ? 'font-semibold text-green-700'
                : 'font-semibold text-red-600'
            }
          >
            {mergedCoverage.allInternalAuditComplete ? '是' : '否'}
          </span>
          · 未結 NCR 合計 {mergedCoverage.totalOpenNcr}
          {mergedCoverage.totalOpenNcr > 0 && (
            <span className="ml-1">
              （九潤 {mergedCoverage.openNcrByScope.jiurun} · 正隆興{' '}
              {mergedCoverage.openNcrByScope.zhenglongxing} · 兩證{' '}
              {mergedCoverage.openNcrByScope.both}）
            </span>
          )}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-line p-3">
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
                    {g.qpCode} · {g.department} — {gapReasonLabel(g.reason)}
                    {g.detail ? `（${g.detail}）` : ''}
                  </li>
                ))}
                {mergedCoverage.gaps.length > 12 && (
                  <li>…另有 {mergedCoverage.gaps.length - 12} 項</li>
                )}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-line p-3">
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
                    {d.qpCode} · {d.department} · NO {d.no} {d.category}
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
                  <button
                    type="button"
                    className="text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => onNavigate('prep')}
                  >
                    {line.text}
                  </button>
                </li>
              ))}
              {prepGapTotal > prepGapLines.length && (
                <li>
                  <button
                    type="button"
                    className="text-left font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => onNavigate('prep')}
                  >
                    …另有 {prepGapTotal - prepGapLines.length} 項
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </Card>

      {summary.overallStatus === 'scored' && (
        <Card className="no-print">
          <p className="text-sm text-muted">年度總分進度</p>
          <div
            className="mt-2 h-2 rounded-full bg-page"
            role="progressbar"
            aria-valuenow={overallPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="年度總分"
          >
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(overallPercent, 100)}%` }}
            />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">稽核重點標示（QR-28-01 概覽）</h2>
        {focusRows.length === 0 ? (
          <EmptyState message="尚無計畫列，請至「年度計畫」建立或自動編排。" />
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs text-muted no-print">表格可左右滑動</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-page text-left text-muted">
                  <th className="p-2">Sheet</th>
                  <th className="p-2">風險等級</th>
                  <th className="p-2">稽核程序</th>
                  <th className="p-2">被稽核單位</th>
                  <th className="p-2">負責人</th>
                  <th className="p-2 text-center">查檢項數</th>
                  <th className="p-2">稽核類型</th>
                </tr>
              </thead>
              <tbody>
                {focusRows.map((row) => (
                  <tr key={`${row.sheet}-${row.qpCode}-${row.department}`} className="border-b border-line">
                    <td className="p-2 text-muted">{row.sheet}</td>
                    <td className="p-2"><Badge label={row.riskLevel} /></td>
                    <td className="p-2 font-medium text-ink">{row.qpCode}</td>
                    <td className="p-2">{row.department}</td>
                    <td className="p-2">{row.owner}</td>
                    <td className="p-2 text-center">{row.itemCount}</td>
                    <td className="p-2 text-muted">{row.auditCategory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">各程序稽核得分</h2>
        {!anyJudgment && scoredDepts.length === 0 ? (
          <EmptyState message="尚無稽核判定，請至「程序稽核」填寫查檢表。" />
        ) : (
          <div className="space-y-3">
            {summary.departmentScores
              .filter((d) => d.status === 'scored')
              .map((d) => (
                <div key={d.auditId} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-sm font-medium text-ink">{d.label}</span>
                  <div className="flex-1">
                    <div
                      className="h-3 rounded-full bg-page"
                      role="progressbar"
                      aria-valuenow={d.score ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={d.label}
                    >
                      <div
                        className={`h-3 rounded-full ${(d.score ?? 0) >= 80 ? 'bg-green-500' : (d.score ?? 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(d.score ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-14 text-right text-sm font-semibold text-ink">
                    {formatScoreDisplay({
                      score: d.score,
                      status: d.status,
                      totalItems: 0,
                      applicableItems: d.applicableItems,
                      breakdown: { conform: 0, nonConform: 0, observation: 0, notApplicable: 0, pending: 0 },
                    })}
                  </span>
                </div>
              ))}
            {incompleteDepts.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="mb-1 font-semibold">未完成程序（{incompleteDepts.length}）</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {incompleteDepts.map((d) => (
                    <li key={d.auditId}>
                      {d.label} — {formatScoreDisplay({
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
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
