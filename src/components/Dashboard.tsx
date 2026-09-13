import {
  calculateAnnualScore,
  formatScoreDisplay,
  hasAnyJudgment,
} from '../lib/scoring'
import { buildDashboardRiskTiles } from '../lib/dashboardTiles'
import type { AppState, TabId } from '../types'
import { Card } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'

interface DashboardProps {
  state: AppState & { company: AppState['companies'][keyof AppState['companies']] }
  onNavigate: (tab: TabId, auditKey?: string) => void
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
  const { company, settings } = state
  const summary = calculateAnnualScore(company.audits, settings.scoringRules)
  const riskGroups = buildDashboardRiskTiles(company, settings.scoringRules)
  const openNCR = company.ncrs.filter((n) => n.status !== '結案').length
  const openObs = company.observations.filter((o) => o.status === 'open').length
  const openSug = company.suggestions.filter((s) => s.status === 'open').length
  const plannedMonths = company.planRows.reduce(
    (sum, r) => sum + r.months.filter(Boolean).length,
    0,
  )
  const scoredDepts = summary.departmentScores.filter((d) => d.status === 'scored')
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

  const handleTileClick = (auditKey: string) => {
    if (!auditKey) return
    onNavigate('audit', auditKey)
  }

  return (
    <div className="space-y-6 print-area">
      <PrintDocHeader
        companyName={company.name}
        auditYear={settings.auditYear}
        formTitle="年度稽核儀表板"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={`年度總分 · ${company.name}`}
          value={overallDisplay}
          hint={summary.overallStatus === 'scored' ? '已評程序加權' : '尚無已評程序'}
        />
        <KpiCard
          title="不符合（NCR）"
          value={company.ncrs.length}
          hint={`未結案 ${openNCR} 件`}
          accent="text-red-600 dark:text-red-400"
          onClick={() => onNavigate('ncr')}
        />
        <KpiCard
          title="觀察 / 第三方建議"
          value={summary.totalObservation + openSug}
          hint={`待追蹤 ${openObs + openSug} 件`}
          accent="text-amber-600 dark:text-amber-400"
          onClick={() => onNavigate('observations')}
        />
        <KpiCard
          title="計畫稽核次數"
          value={plannedMonths}
          hint={`系統 ${byCategory.系統稽核} · 製程 ${byCategory.製程稽核} · 型態 ${byCategory.型態稽核}`}
          onClick={() => onNavigate('plan')}
        />
      </div>

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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">稽核重點與得分（QR-28-01）</h2>
          <p className="text-xs text-muted">
            綠 ≥80% · 琥珀 ≥60% · 紅 &lt;60% · 未評分 —
          </p>
        </div>

        {riskGroups.length === 0 ? (
          <EmptyState message="尚無計畫列，請至「年度計畫」建立或自動編排。" />
        ) : (
          <div className="space-y-6">
            {riskGroups.map((group) => (
              <section key={group.riskLevel}>
                <h3 className="mb-3 text-sm font-semibold text-ink">
                  {group.riskLevel === '高' ? '高風險' : group.riskLevel === '中' ? '中風險' : '低風險'}
                  {' · '}
                  {group.tiles.length}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {group.tiles.map((tile) => (
                    <button
                      key={`${tile.qpCode}-${tile.departmentId}`}
                      type="button"
                      onClick={() => handleTileClick(tile.auditKey)}
                      className="rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 no-print"
                      aria-label={`${tile.qpCode} ${tile.department}，得分 ${tile.scoreLabel}，前往程序稽核`}
                    >
                      <p className="font-semibold text-ink">{tile.qpCode}</p>
                      <p className="mt-1 text-xs text-muted">{tile.department}</p>
                      <p className={`mt-3 text-2xl font-bold ${tile.scoreClass}`}>{tile.scoreLabel}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-2 hidden print:block">
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {group.tiles.map((tile) => (
                        <tr key={`print-${tile.qpCode}-${tile.departmentId}`} className="border-b border-line">
                          <td className="p-1">{tile.qpCode}</td>
                          <td className="p-1">{tile.department}</td>
                          <td className="p-1">{tile.scoreLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
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
            {summary.departmentScores.filter((d) => d.status !== 'scored').length > 0 && (
              <p className="text-xs text-muted">
                另有 {summary.departmentScores.filter((d) => d.status !== 'scored').length} 個程序尚未評分（未評或不適用）。
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
