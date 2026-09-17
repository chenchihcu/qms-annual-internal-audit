import { useMemo, useState } from 'react'
import {
  ATTENTION_FILTERS,
  buildProcedureAttentionRows,
  filterAttentionRows,
  getAttentionFilterLabel,
  sortAttentionRows,
  type AttentionFilter,
} from '../lib/dashboardAttention'
import { calculateAnnualScore } from '../lib/scoring'
import { buildAppHash } from '../lib/navigation'
import { getPdcaOverview } from '../lib/workflowStatus'
import type { AppState, TabId } from '../types'
import { COMPANY_LABELS, companySettingsFor, otherCompanyId } from '../types'
import { relationshipsForPrepItem } from '../lib/externalAuditPrep'
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
  const { company } = state
  const settings = companySettingsFor(state)
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('needsAttention')
  const summary = calculateAnnualScore(company.audits, settings.scoringRules)
  const attentionRows = useMemo(
    () => buildProcedureAttentionRows(company.planRows, company.audits, settings.scoringRules),
    [company.planRows, company.audits, settings.scoringRules],
  )
  const visibleAttentionRows = useMemo(
    () => sortAttentionRows(filterAttentionRows(attentionRows, attentionFilter)),
    [attentionRows, attentionFilter],
  )
  const pdca = getPdcaOverview(state)
  const otherId = otherCompanyId(state.activeCompanyId)
  const otherPdca = getPdcaOverview(state, otherId)
  const otherSettings = companySettingsFor(state, otherId)
  const customerGate = relationshipsForPrepItem(15, state.companyRelationships)[0]
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

  const navigateToRow = (auditId?: string) => {
    go(auditId ? 'audit' : 'plan', auditId)
  }

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

      <Card className="border-slate-200 bg-slate-50/60">
        <h3 className="text-sm font-semibold text-slate-800">另一家台帳摘要 · {COMPANY_LABELS[otherId]}</h3>
        <p className="mt-1 text-xs text-slate-600">
          內稽 {otherSettings.auditYear} 年 · {otherPdca.annualCloseReady ? '年度可結案' : `${otherPdca.annualCloseGaps.length} 項年度缺口`}
        </p>
        {otherPdca.annualCloseGaps.slice(0, 3).map((gap) => (
          <p key={gap.message} className="mt-1 text-xs text-slate-500">· {gap.message}</p>
        ))}
        {state.activeCompanyId === 'zhenglongxing' && customerGate && (
          <p className="mt-2 text-xs text-rose-800">客戶關係：{customerGate.label}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">外稽準備為雙公司共用（{state.externalAuditPrep.year} 年），請至準備頁一併確認。</p>
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
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">程序風險與得分</h2>
            <p className="mt-1 text-sm text-slate-500">
              預設顯示需關注項目；完整 QR-28-01 明細請至年度計畫。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" className="font-medium text-blue-700 underline" onClick={() => go('plan')}>
              完整計畫
            </button>
            <span className="text-slate-300">·</span>
            <button type="button" className="font-medium text-blue-700 underline" onClick={() => go('audit')}>
              全部執行
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="程序清單篩選">
          {ATTENTION_FILTERS.map((filter) => {
            const active = attentionFilter === filter
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  active
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-800'
                }`}
                onClick={() => setAttentionFilter(filter)}
              >
                {getAttentionFilterLabel(filter)}
              </button>
            )
          })}
        </div>

        {visibleAttentionRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            {attentionFilter === 'needsAttention' ? (
              <>
                目前無需關注項目。
                <button
                  type="button"
                  className="ml-1 font-medium text-blue-700 underline"
                  onClick={() => setAttentionFilter('all')}
                >
                  查看全部程序
                </button>
              </>
            ) : (
              '目前篩選條件沒有程序列。'
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAttentionRows.map((row) => (
              <button
                key={`${row.sheet}-${row.qpCode}-${row.department}`}
                type="button"
                className="flex w-full flex-col gap-2 rounded-lg border border-slate-100 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-slate-50 sm:flex-row sm:items-center"
                onClick={() => navigateToRow(row.auditId)}
                aria-label={`前往 ${row.qpCode} · ${row.department}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-blue-800 underline-offset-2 hover:underline">
                      {row.qpCode} · {row.department}
                    </span>
                    <Badge label={row.riskLevel} />
                    {row.auditCategory !== '系統稽核' && (
                      <Badge label={row.auditCategory} className="border-slate-200 bg-slate-50 text-slate-700" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.status}
                    {row.totalItems > 0 ? ` · ${row.judgedCount}/${row.totalItems}` : ''}
                  </p>
                </div>

                <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-[10rem] sm:justify-end">
                  {row.score == null ? (
                    <span className="text-sm font-medium text-slate-500">未計分</span>
                  ) : (
                    <>
                      <div className="hidden h-2 w-24 rounded-full bg-slate-100 sm:block">
                        <div
                          className={`h-2 rounded-full ${row.score >= 80 ? 'bg-green-500' : row.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(row.score, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{row.score}%</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
