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
import { buildAppHash, TAB_GROUPS } from '../lib/navigation'
import { relationshipsForPrepItem } from '../lib/externalAuditPrep'
import { getPdcaOverview } from '../lib/workflowStatus'
import type { AppState, TabId } from '../types'
import { COMPANY_LABELS, companySettingsFor, otherCompanyId } from '../types'
import { ATTENTION_FILTER_ICONS, DASHBOARD_KPI_ICONS, PDCA_SECTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { FilterChips } from './ui/FilterChips'
import { Icon } from './ui/Icon'
import { PageToolbar } from './ui/PageToolbar'
import { ScrollRegion } from './ui/ScrollRegion'

interface DashboardProps {
  state: AppState & { company: AppState['companies'][keyof AppState['companies']] }
  onNavigate?: (tab: TabId, auditKey?: string) => void
}

const PDCA_SECTION_KEYS = ['plan', 'do', 'check', 'act'] as const
const PDCA_DEFAULT_TABS: Record<(typeof PDCA_SECTION_KEYS)[number], TabId> = {
  plan: 'standard',
  do: 'schedule',
  check: 'followups',
  act: 'prep',
}
const PDCA_GROUP_LABELS = TAB_GROUPS.slice(1, 5).map((group) => group.label)

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
  const openFollowups = openNCR + openObs + openSug
  const inProgress = company.audits.filter((a) => a.status === '執行中').length
  const reported = company.audits.filter((a) => a.status === '已回報').length
  const notStarted = company.audits.filter((a) => !a.status || a.status === '規劃中').length

  const attentionFilterOptions = ATTENTION_FILTERS.map((filter) => ({
    id: filter,
    label: getAttentionFilterLabel(filter),
    icon: ATTENTION_FILTER_ICONS[getAttentionFilterLabel(filter)],
  }))

  const go = (tab: TabId, auditKey?: string) => {
    if (onNavigate) onNavigate(tab, auditKey)
    else window.location.hash = buildAppHash(tab, auditKey).slice(1)
  }

  const navigateToRow = (auditId?: string) => {
    go(auditId ? 'audit' : 'schedule', auditId)
  }

  return (
    <div className="space-y-6">
      <Card className={pdca.annualCloseReady ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">年度稽核 PDCA</h2>
            <p className="mt-1 text-sm text-slate-600">
              {settings.auditYear} 年 · {company.name}
            </p>
          </div>
          {pdca.annualCloseReady ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">年度可結案</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">尚有年度缺口</span>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PDCA_SECTION_KEYS.map((sectionKey, index) => {
            const block = pdca[sectionKey]
            const label = PDCA_GROUP_LABELS[index] ?? sectionKey
            const defaultTab = PDCA_DEFAULT_TABS[sectionKey]
            return (
              <button
                key={sectionKey}
                type="button"
                className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:shadow-sm"
                onClick={() => go(block.gaps[0]?.tab ?? defaultTab)}
              >
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <Icon name={PDCA_SECTION_ICONS[label]} size="sm" />
                  {label}
                </p>
                <p className={`mt-1 text-sm font-semibold ${block.ready ? 'text-green-700' : 'text-amber-800'}`}>
                  {block.ready ? '已就緒' : `${block.gaps.length} 項待處理`}
                </p>
              </button>
            )
          })}
        </div>
        {pdca.annualCloseReady && (
          <p className="mt-3 text-sm text-green-800">
            可在年度計畫切換新年；待追蹤項目請至
            <button type="button" className="mx-1 font-medium text-blue-700 underline" onClick={() => go('followups')}>
              待改善追蹤
            </button>
            或
            <button type="button" className="mx-1 font-medium text-blue-700 underline" onClick={() => go('observations')}>
              觀察事項
            </button>
            跨年帶入。
          </p>
        )}
      </Card>

      <Card className="border-slate-200 bg-slate-50/60">
        <h3 className="text-sm font-semibold text-slate-800">另一家台帳摘要 · {COMPANY_LABELS[otherId]}</h3>
        <p className="mt-1 text-xs text-slate-600">
          內稽 {otherSettings.auditYear} 年 · {otherPdca.annualCloseReady ? '年度可結案' : `${otherPdca.annualCloseGaps.length} 項年度缺口`}
        </p>
        {state.activeCompanyId === 'zhenglongxing' && customerGate && (
          <p className="mt-2 text-xs text-rose-800">客戶關係：{customerGate.label}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">請使用頂欄切換公司查看 {COMPANY_LABELS[otherId]} 台帳。</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <Icon name={DASHBOARD_KPI_ICONS.score} size="sm" />
            年度總分
          </p>
          <p className="mt-1 text-sm font-bold text-blue-700">{summary.overallScore == null ? '—' : `${summary.overallScore}%`}</p>
          {summary.overallScore == null && <p className="text-xs text-slate-500">尚無可計分項目</p>}
          {summary.overallScore != null && (
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.min(summary.overallScore, 100)}%` }}
              />
            </div>
          )}
        </Card>
        <button
          type="button"
          className="text-left"
          onClick={() => go('followups')}
          aria-label={`待追蹤 ${openFollowups} 件`}
        >
          <Card className="h-full transition hover:border-amber-300 hover:shadow-sm">
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <Icon name={DASHBOARD_KPI_ICONS.observations} size="sm" />
              待追蹤
            </p>
            <p className="mt-1 text-sm font-bold text-amber-700">{openFollowups}</p>
            <p className="text-xs text-slate-500">NCR · 觀察 · 建議</p>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => go('schedule')}>
          <Card className="h-full transition hover:border-blue-300 hover:shadow-sm">
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <Icon name={DASHBOARD_KPI_ICONS.audits} size="sm" />
              稽核事件
            </p>
            <p className="mt-1 text-sm font-bold text-blue-800">
              {notStarted} / {inProgress} / {reported}
            </p>
            <p className="text-xs text-slate-500">未開始 · 執行中 · 已回報</p>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => go('prep')}>
          <Card className="h-full transition hover:border-slate-300 hover:shadow-sm">
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <Icon name={DASHBOARD_KPI_ICONS.prep} size="sm" />
              外稽準備
            </p>
            <p className={`mt-1 text-sm font-bold ${pdca.act.ready ? 'text-green-700' : 'text-amber-800'}`}>
              {pdca.act.ready ? '已就緒' : '待完成'}
            </p>
          </Card>
        </button>
      </div>

      <Card>
        <PageToolbar
          title="程序風險與得分"
          actions={(
            <>
              <button type="button" className="text-sm font-medium text-blue-700 underline" onClick={() => go('plan')}>
                完整計畫
              </button>
              <span className="text-slate-300">·</span>
              <button type="button" className="text-sm font-medium text-blue-700 underline" onClick={() => go('schedule')}>
                稽核日程
              </button>
            </>
          )}
        />

        <FilterChips
          options={attentionFilterOptions}
          value={attentionFilter}
          onChange={setAttentionFilter}
          ariaLabel="程序清單篩選"
        />

        {visibleAttentionRows.length === 0 ? (
          <EmptyState
            message={attentionFilter === 'needsAttention' ? '目前無需關注項目。' : '目前篩選沒有程序列。'}
            action={attentionFilter === 'needsAttention' ? (
              <Button variant="ghost" onClick={() => setAttentionFilter('all')}>查看全部程序</Button>
            ) : undefined}
          />
        ) : (
          <ScrollRegion ariaLabel="程序風險與得分工作表">
            <table className="w-full min-w-[760px] border-collapse text-sm" aria-label="程序風險與得分工作表">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border p-2">程序</th>
                  <th className="border p-2">風險</th>
                  <th className="border p-2">類型</th>
                  <th className="border p-2">狀態</th>
                  <th className="border p-2">得分</th>
                </tr>
              </thead>
              <tbody>
                {visibleAttentionRows.map((row) => (
                  <tr key={`${row.sheet}-${row.qpCode}-${row.department}`} className="hover:bg-slate-50">
                    <td className="border p-2">
                      <button
                        type="button"
                        className="font-medium text-blue-800 underline-offset-2 hover:underline"
                        onClick={() => navigateToRow(row.auditId)}
                      >
                        {row.qpCode} · {row.department}
                      </button>
                    </td>
                    <td className="border p-2"><Badge label={row.riskLevel} /></td>
                    <td className="border p-2 text-xs">
                      {row.auditCategory !== '系統稽核' ? row.auditCategory : '—'}
                    </td>
                    <td className="border p-2 text-xs">
                      {row.status}
                      {row.totalItems > 0 ? ` · ${row.judgedCount}/${row.totalItems}` : ''}
                    </td>
                    <td className="border p-2">
                      {row.score == null ? (
                        <span className="text-sm font-medium text-slate-500">未計分</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="hidden h-2 w-16 rounded-full bg-slate-100 sm:block">
                            <div
                              className={`h-2 rounded-full ${row.score >= 80 ? 'bg-green-500' : row.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(row.score, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-800">{row.score}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </Card>
    </div>
  )
}
