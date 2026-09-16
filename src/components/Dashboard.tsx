import { calculateAnnualScore } from '../lib/scoring'
import { buildAuditFocusOverview } from '../lib/planner'
import { buildAppHash } from '../lib/navigation'
import { validateAuditTeam } from '../lib/personnel'
import type { AppState, TabId } from '../types'
import { Badge, Card } from './ui/Badge'

interface DashboardProps {
  state: AppState & { company: AppState['companies'][keyof AppState['companies']] }
  onNavigate?: (tab: TabId, auditKey?: string) => void
}

function auditCanStart(state: AppState, audit: AppState['companies'][keyof AppState['companies']]['audits'][0]): boolean {
  const profile = state.companyAuditProfiles[state.activeCompanyId]
  const standards = profile.applicableStandards
    .filter((item) => item.confirmationStatus === 'confirmed')
    .map((item) => `${item.name}:${item.version}`)
  if (!audit.auditDate) return false
  if (standards.length === 0) return false
  if (!profile.auditProcedureCode.trim()) return false
  if (!profile.auditProcedureVersion || profile.auditProcedureVersion === '待確認') return false
  if (!profile.formalRecordLocation.trim()) return false
  const teamResult = validateAuditTeam(
    state.people,
    audit.team,
    state.activeCompanyId,
    audit.qpCode,
    audit.departmentId,
    audit.auditDate || audit.plannedDate || '',
    standards,
  )
  return teamResult.canStart
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
  const personnelIssues = company.audits.filter(
    (audit) => audit.status !== '已回報' && !auditCanStart(state, audit),
  ).length

  const byCategory = {
    系統稽核: company.planRows.filter((r) => r.auditCategory === '系統稽核').length,
    製程稽核: company.planRows.filter((r) => r.auditCategory === '製程稽核').length,
    型態稽核: company.planRows.filter((r) => r.auditCategory === '型態稽核').length,
  }

  const go = (tab: TabId, auditKey?: string) => {
    if (onNavigate) onNavigate(tab, auditKey)
    else window.location.hash = buildAppHash(tab, auditKey).slice(1)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">年度總分 · {company.name}</p>
          <p className="mt-1 text-3xl font-bold text-blue-700">{summary.overallScore == null ? '—' : `${summary.overallScore}%`}</p>
          {summary.overallScore == null && <p className="text-xs text-slate-500">尚無可計分項目</p>}
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(summary.overallScore ?? 0, 100)}%` }}
            />
          </div>
        </Card>
        <button
          type="button"
          className="text-left"
          onClick={() => go('ncr')}
          aria-label={`不符合 NCR 共 ${company.ncrs.length} 件，未結案 ${openNCR} 件，前往不符合與矯正措施`}
        >
          <Card className="h-full transition hover:border-red-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">不符合（NCR）</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{company.ncrs.length}</p>
            <p className="mt-1 text-xs text-blue-700">未結案 {openNCR} 件 · 點擊查看</p>
          </Card>
        </button>
        <button
          type="button"
          className="text-left"
          onClick={() => go('observations')}
          aria-label={`觀察與建議待追蹤 ${openObs + openSug} 件`}
        >
          <Card className="h-full transition hover:border-amber-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">觀察 / 第三方建議</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">{openObs + openSug}</p>
            <p className="mt-1 text-xs text-blue-700">台帳待追蹤 {openObs} · 建議 {openSug} · 點擊查看</p>
          </Card>
        </button>
        <button
          type="button"
          className="text-left"
          onClick={() => go('plan')}
          aria-label={`計畫稽核次數 ${plannedMonths}`}
        >
          <Card className="h-full transition hover:border-slate-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">計畫稽核次數</p>
            <p className="mt-1 text-3xl font-bold text-slate-800">{plannedMonths}</p>
            <p className="text-xs text-blue-700">
              系統 {byCategory.系統稽核} · 製程 {byCategory.製程稽核} · 型態 {byCategory.型態稽核} · 點擊查看
            </p>
          </Card>
        </button>
      </div>

      {personnelIssues > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-amber-950">開始前人員資格待處理</h2>
              <p className="text-sm text-amber-800">{personnelIssues} 個尚未回報事件的團隊、資格範圍、標準／程序或客觀性確認未完成。</p>
            </div>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
              onClick={() => go('personnel')}
            >
              前往人員合格名單（{personnelIssues} 件）
            </button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">稽核重點標示（QR-28-01 概覽）</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-slate-600">
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
                <tr key={`${row.sheet}-${row.qpCode}-${row.department}`} className="border-b border-slate-100">
                  <td className="p-2 text-slate-500">{row.sheet}</td>
                  <td className="p-2"><Badge label={row.riskLevel} /></td>
                  <td className="p-2 font-medium">{row.qpCode}</td>
                  <td className="p-2">{row.department}</td>
                  <td className="p-2">{row.owner}</td>
                  <td className="p-2 text-center">{row.itemCount}</td>
                  <td className="p-2 text-slate-600">{row.auditCategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">各程序稽核得分</h2>
        <div className="space-y-3">
          {summary.departmentScores.length === 0 ? (
            <p className="text-sm text-slate-500">
              尚無稽核資料，請至
              <button type="button" className="mx-1 font-medium text-blue-700 underline" onClick={() => go('audit')}>稽核執行與證據</button>
              填寫查檢表。
            </p>
          ) : (
            summary.departmentScores.map((d) => (
              <button
                key={d.auditId}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg p-1 text-left hover:bg-slate-50"
                onClick={() => go('audit', d.auditId)}
                aria-label={`前往 ${d.label} 稽核事件`}
              >
                <span className="w-40 shrink-0 text-sm font-medium text-blue-800 underline-offset-2 hover:underline">{d.label}</span>
                <div className="flex-1">
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className={`h-3 rounded-full ${d.score == null ? 'bg-slate-300' : d.score >= 80 ? 'bg-green-500' : d.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(d.score ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="w-14 text-right text-sm font-semibold">{d.score == null ? '—' : `${d.score}%`}</span>
              </button>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
