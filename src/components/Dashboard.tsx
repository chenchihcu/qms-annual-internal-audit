import { calculateAnnualScore } from '../lib/scoring'
import { buildAuditFocusOverview } from '../lib/planner'
import { buildAppHash } from '../lib/navigation'
import { getPdcaOverview } from '../lib/workflowStatus'
import type { AppState, TabId } from '../types'
import { Badge, Card } from './ui/Badge'

interface DashboardProps {
  state: AppState & { company: AppState['companies'][keyof AppState['companies']] }
  onNavigate?: (tab: TabId, auditKey?: string) => void
}

const PDCA_SECTIONS = [
  { key: 'plan' as const, label: 'P · 方案規劃', tab: 'standard' as TabId },
  { key: 'do' as const, label: 'D · 稽核執行', tab: 'audit' as TabId },
  { key: 'check' as const, label: 'C · 結果與改善', tab: 'ncr' as TabId },
  { key: 'act' as const, label: 'A · 結案與改進', tab: 'prep' as TabId },
]

export function Dashboard({ state, onNavigate }: DashboardProps) {
  const { company, settings } = state
  const summary = calculateAnnualScore(company.audits, settings.scoringRules)
  const focusRows = buildAuditFocusOverview(company.planRows)
  const pdca = getPdcaOverview(state)
  const openNCR = company.ncrs.filter((n) => n.status !== '結案').length
  const openObs = company.observations.filter((o) => o.status === 'open').length
  const openSug = company.suggestions.filter((s) => s.status === 'open').length
  const plannedMonths = company.planRows.reduce(
    (sum, r) => sum + r.months.filter(Boolean).length,
    0,
  )
  const inProgress = company.audits.filter((a) => a.status === '執行中').length
  const reported = company.audits.filter((a) => a.status === '已回報').length
  const notStarted = company.audits.filter((a) => !a.status || a.status === '規劃中').length

  const byCategory = {
    系統稽核: company.planRows.filter((r) => r.auditCategory === '系統稽核').length,
    製程稽核: company.planRows.filter((r) => r.auditCategory === '製程稽核').length,
    型態稽核: company.planRows.filter((r) => r.auditCategory === '型態稽核').length,
  }

  const go = (tab: TabId, auditKey?: string) => {
    if (onNavigate) onNavigate(tab, auditKey)
    else window.location.hash = buildAppHash(tab, auditKey).slice(1)
  }

  const findAuditForRow = (qpCode: string, department: string) =>
    company.audits.find((a) => a.qpCode === qpCode && a.department === department)

  return (
    <div className="space-y-6">
      <Card className={pdca.annualCloseReady ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">年度稽核 PDCA</h2>
            <p className="mt-1 text-sm text-slate-600">
              {settings.auditYear} 年 · {company.name} · 方案起始 → 執行 → 追蹤 → 結案
            </p>
          </div>
          {pdca.annualCloseReady ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">可進行年度結案</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">年度結案尚待完成</span>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PDCA_SECTIONS.map((section) => {
            const block = pdca[section.key]
            return (
              <button
                key={section.key}
                type="button"
                className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:shadow-sm"
                onClick={() => go(section.tab)}
              >
                <p className="text-xs font-bold text-slate-500">{section.label}</p>
                <p className={`mt-1 text-sm font-semibold ${block.ready ? 'text-green-700' : 'text-amber-800'}`}>
                  {block.ready ? '已就緒' : `${block.gaps.length} 項待處理`}
                </p>
                {block.gaps.slice(0, 2).map((gap) => (
                  <p key={gap.message} className="mt-1 truncate text-xs text-slate-500">{gap.message}</p>
                ))}
              </button>
            )
          })}
        </div>
        {!pdca.annualCloseReady && pdca.annualCloseGaps.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-amber-900">
            {pdca.annualCloseGaps.slice(0, 5).map((gap) => (
              <li key={gap.message}>
                {gap.tab ? (
                  <button type="button" className="text-left underline hover:text-amber-950" onClick={() => go(gap.tab!)}>
                    {gap.message}
                  </button>
                ) : gap.message}
              </li>
            ))}
          </ul>
        )}
        {pdca.annualCloseReady && (
          <p className="mt-3 text-sm text-green-800">
            可在年度計畫切換新年，並至觀察事項／建議頁帶入待追蹤項目。
          </p>
        )}
      </Card>

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
          aria-label={`不符合 NCR 共 ${company.ncrs.length} 件，未結案 ${openNCR} 件`}
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
          aria-label={`觀察待追蹤 ${openObs} 件`}
        >
          <Card className="h-full transition hover:border-amber-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">觀察事項</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">{openObs}</p>
            <p className="mt-1 text-xs text-blue-700">台帳待追蹤 · 點擊查看</p>
          </Card>
        </button>
        <button
          type="button"
          className="text-left"
          onClick={() => go('suggestions')}
          aria-label={`建議待追蹤 ${openSug} 件`}
        >
          <Card className="h-full transition hover:border-violet-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">第三方建議</p>
            <p className="mt-1 text-3xl font-bold text-violet-600">{openSug}</p>
            <p className="mt-1 text-xs text-blue-700">待追蹤 · 點擊查看</p>
          </Card>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" className="text-left" onClick={() => go('plan')}>
          <Card className="h-full transition hover:border-slate-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">計畫稽核次數</p>
            <p className="mt-1 text-3xl font-bold text-slate-800">{plannedMonths}</p>
            <p className="text-xs text-blue-700">
              系統 {byCategory.系統稽核} · 製程 {byCategory.製程稽核} · 型態 {byCategory.型態稽核}
            </p>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => go('audit')}>
          <Card className="h-full transition hover:border-blue-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">稽核事件</p>
            <p className="mt-1 text-2xl font-bold text-blue-800">
              {notStarted} / {inProgress} / {reported}
            </p>
            <p className="text-xs text-slate-500">未開始 · 執行中 · 已回報</p>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => go('standard')}>
          <Card className="h-full transition hover:border-slate-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">方案規劃</p>
            <p className={`mt-1 text-lg font-bold ${pdca.plan.ready ? 'text-green-700' : 'text-amber-800'}`}>
              {pdca.plan.ready ? '已就緒' : '待完成'}
            </p>
            <p className="text-xs text-blue-700">標準 → 程序 → 風險 → 計畫 → 人員</p>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => go('prep')}>
          <Card className="h-full transition hover:border-slate-300 hover:shadow-sm">
            <p className="text-sm text-slate-500">外部稽核前準備</p>
            <p className={`mt-1 text-lg font-bold ${pdca.act.ready ? 'text-green-700' : 'text-amber-800'}`}>
              {pdca.act.ready ? '已就緒' : '待完成'}
            </p>
            <p className="text-xs text-blue-700">內稽 → 管審 → 外稽序位</p>
          </Card>
        </button>
      </div>

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
              {focusRows.map((row) => {
                const audit = findAuditForRow(row.qpCode, row.department)
                return (
                  <tr key={`${row.sheet}-${row.qpCode}-${row.department}`} className="border-b border-slate-100">
                    <td className="p-2 text-slate-500">{row.sheet}</td>
                    <td className="p-2"><Badge label={row.riskLevel} /></td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="font-medium text-blue-800 underline-offset-2 hover:underline"
                        onClick={() => go(audit ? 'audit' : 'plan', audit?.id)}
                      >
                        {row.qpCode}
                      </button>
                    </td>
                    <td className="p-2">{row.department}</td>
                    <td className="p-2">{row.owner}</td>
                    <td className="p-2 text-center">{row.itemCount}</td>
                    <td className="p-2 text-slate-600">{row.auditCategory}</td>
                  </tr>
                )
              })}
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
