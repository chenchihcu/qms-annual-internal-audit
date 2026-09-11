import {
  calculateAnnualScore,
  formatScoreDisplay,
  hasAnyJudgment,
} from '../lib/scoring'
import { buildAuditFocusOverview } from '../lib/planner'
import type { AppState, TabId } from '../types'
import { Badge, Card } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'

interface DashboardProps {
  state: AppState & { company: AppState['companies'][keyof AppState['companies']] }
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
  const { company, settings } = state
  const summary = calculateAnnualScore(company.audits, settings.scoringRules)
  const focusRows = buildAuditFocusOverview(company.planRows)
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

  return (
    <div className="space-y-6 print-area">
      <PrintDocHeader
        companyName={company.name}
        auditYear={settings.auditYear}
        formTitle="年度稽核儀表板"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title={`年度總分 · ${company.name}`}
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
