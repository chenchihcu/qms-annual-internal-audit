import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { useTablePagination } from '../hooks/useTablePagination'
import { FOCUS_RING } from '../lib/focusRing'
import { localIsoDate } from '../lib/localDate'
import { isSuggestedTarget } from '../lib/processTypes'
import { NOT_APPLICABLE_REASONS, isReasonFilled } from '../lib/reasonOptions'
import { FACTOR_DEFINITIONS } from '../lib/risk'
import {
  effectiveLinkStatus,
  isCoverageCurrent,
  targetKey,
  validateCoverageDraft,
  type RiskSourceDraftErrors,
  type RiskSourceEventDraft,
} from '../lib/riskSources'
import {
  RISK_COVERAGE_KIND_LABELS,
  RISK_SOURCE_KIND_LABELS,
  RISK_SOURCE_LINK_STATUS_LABELS,
  RISK_SOURCE_LINK_TYPE_LABELS,
  type PlanRow,
  type RiskCoverageKind,
  type RiskSourceKind,
  type RiskSourceLinkStatus,
  type RiskSourceLinkType,
  type RiskSourceTarget,
} from '../types'
import type { LiveRiskScores } from '../lib/riskWorkingValues'
import { ProcessTypeMatrix } from './ProcessTypeMatrix'
import { Button, Input, Select } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { ReasonSelect } from './ui/ReasonSelect'
import { ScrollRegion } from './ui/ScrollRegion'
import { TablePagination } from './ui/TablePagination'

const KINDS: RiskSourceKind[] = ['customer_complaint', 'major_change']
const COVERAGE_KINDS: RiskCoverageKind[] = ['customer_complaint', 'major_change', 'third_party_audit']
const KIND_FACTOR = { customer_complaint: 'customerComplaintLevel', major_change: 'changeImpact' } as const
const VOID_REASONS = ['登錄錯誤', '重複登錄', '其他'] as const
/** 是否計入風險：只有已確認的關聯計入。 */
const LINK_COUNTED_LABELS: Record<RiskSourceLinkStatus, string> = {
  confirmed: '計入',
  pending: '暫不計入',
  not_applicable: '不計入',
}


function emptyDraft(): RiskSourceEventDraft {
  return { kind: 'customer_complaint', externalReference: '', date: '', summary: '', targets: [] }
}

function shortProcess(row: PlanRow): string {
  return row.process.replace(/管理程序$/, '').replace(/程序$/, '')
}

/** 方案風險的外部來源輸入：登錄事件後點選關聯程序，受影響程序的件數與優先分自動統計。 */
export function RiskSourceRegister({ store, liveScores }: { store: AuditStore; liveScores: LiveRiskScores }) {
  const { state, addRiskSourceEvent, voidRiskSourceEvent, setRiskSourceCoverage, setRiskSourceLinkStatus } = store
  const { company, settings } = state
  const events = company.riskSourceEvents ?? []
  const activeEvents = events.filter((event) => !event.voidedAt)
  const coverage = company.riskSourceCoverage ?? {}
  const previousCount = (state.yearArchives[String(settings.auditYear - 1)]?.workspace.riskSourceEvents ?? [])
    .filter((event) => !event.voidedAt).length
  const today = localIsoDate()

  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<RiskSourceEventDraft>(emptyDraft)
  const [errors, setErrors] = useState<RiskSourceDraftErrors>({})
  const [voiding, setVoiding] = useState<{ id: string; reason: string } | null>(null)
  const [rejecting, setRejecting] = useState<{ eventId: string; key: string; reason: string } | null>(null)
  const [coverageDate, setCoverageDate] = useState<Partial<Record<RiskCoverageKind, string>>>({})
  const [coverageError, setCoverageError] = useState<Partial<Record<RiskCoverageKind, string>>>({})
  const pagination = useTablePagination(events.length, 10, undefined, String(settings.auditYear))

  const rowFor = (target: Pick<RiskSourceTarget, 'qpCode' | 'departmentId'>) =>
    company.planRows.find((row) => row.qpCode === target.qpCode && row.departmentId === target.departmentId)
  const suggested = (row: PlanRow) => isSuggestedTarget(row.qpCode, draft.kind)
  const suggestedCount = company.planRows.filter(suggested).length

  const departments = [...new Map(company.planRows.map((row) => [row.department, row.department])).keys()]
  const selectedKeys = new Set(draft.targets.map(targetKey))
  const linkCount = (status: RiskSourceLinkStatus) =>
    activeEvents.reduce((sum, event) => sum + event.targets.filter((target) => effectiveLinkStatus(target) === status).length, 0)

  const toggleTarget = (row: PlanRow, checked: boolean) => {
    const key = `${row.qpCode}|${row.departmentId}`
    setDraft((current) => ({
      ...current,
      targets: checked
        ? [...current.targets, { qpCode: row.qpCode, departmentId: row.departmentId, linkType: 'primary', linkStatus: 'confirmed' }]
        : current.targets.filter((target) => targetKey(target) !== key),
    }))
  }

  const updateTarget = (key: string, patch: Partial<RiskSourceTarget>) => {
    setDraft((current) => ({
      ...current,
      targets: current.targets.map((target) => (targetKey(target) === key ? { ...target, ...patch } : target)),
    }))
  }

  const save = () => {
    const result = addRiskSourceEvent(draft)
    setErrors(result.errors)
    if (result.ok) {
      setDraft(emptyDraft())
      setShowForm(false)
    }
  }

  const toggleCoverage = (kind: RiskCoverageKind, checked: boolean) => {
    if (!checked) {
      setRiskSourceCoverage(kind, null)
      return
    }
    const date = coverageDate[kind] ?? today
    const error = validateCoverageDraft(date, today)
    setCoverageError((prev) => ({ ...prev, [kind]: error ?? undefined }))
    if (!error) setRiskSourceCoverage(kind, { checkedThrough: date, reference: '外部來源登錄' })
  }

  const scoreText = (target: RiskSourceTarget) => {
    const live = liveScores.get(targetKey(target))
    return live ? `優先分 ${live.score}・${live.level ?? '資料不足'}` : ''
  }

  return (
    <section aria-label="外部來源登錄" className="space-y-3 no-print">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="min-w-0 flex-1 text-sm font-bold text-ink">客戶抱怨／重大變更</h3>
        {!showForm && <Button variant="secondary" onClick={() => setShowForm(true)}>登錄來源</Button>}
      </div>
      <p className="text-sm text-ink" role="status">
        {`本年度：客戶抱怨 ${activeEvents.filter((event) => event.kind === 'customer_complaint').length} 件・`
          + `重大變更 ${activeEvents.filter((event) => event.kind === 'major_change').length} 件・`
          + `計入關聯 ${linkCount('confirmed')} 筆・待確認 ${linkCount('pending')} 筆`
          + (previousCount > 0 ? `（${settings.auditYear - 1} 年度 ${previousCount} 件一併計入）` : '')}
      </p>

      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {COVERAGE_KINDS.map((kind) => {
          const declared = coverage[kind]
          const current = isCoverageCurrent(declared, today)
          return (
            <li key={kind} className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  className={FOCUS_RING}
                  checked={Boolean(declared)}
                  onChange={(event) => toggleCoverage(kind, event.target.checked)}
                />
                {RISK_COVERAGE_KIND_LABELS[kind]}已全部登錄至
              </label>
              {declared && current && <span className="text-ink">{declared.checkedThrough}</span>}
              {declared && !current && (
                <span className="inline-flex flex-wrap items-center gap-2 text-tone-warning-fg">
                  {declared.checkedThrough}（之後未盤點，視為待確認）
                  <Button
                    variant="secondary"
                    className="min-h-9 px-2 py-1"
                    onClick={() => setRiskSourceCoverage(kind, { checkedThrough: today, reference: declared.reference })}
                  >
                    更新為今天
                  </Button>
                </span>
              )}
              {!declared && (
                <Input
                  type="date"
                  ariaLabel={`${RISK_COVERAGE_KIND_LABELS[kind]}已全部登錄日期`}
                  value={coverageDate[kind] ?? today}
                  onChange={(value) => setCoverageDate((prev) => ({ ...prev, [kind]: value }))}
                />
              )}
              {coverageError[kind] && <span className="text-xs text-danger" role="alert">{coverageError[kind]}</span>}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted">勾選「已全部登錄」且日期涵蓋到今天，沒有關聯的程序才會算 0 件；未勾選或日期過舊則顯示待確認。第三方稽核缺失來自觀察台帳（來源＝第三方稽核）。</p>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-line p-3">
          <div role="radiogroup" aria-label="類別" className="flex flex-wrap gap-2">
            {KINDS.map((kind) => (
              <label key={kind} className={`inline-flex min-h-11 items-center gap-2 rounded border px-3 ${draft.kind === kind ? 'border-primary bg-row-selected' : 'border-line'}`}>
                <input
                  type="radio"
                  name="risk-source-kind"
                  className={FOCUS_RING}
                  checked={draft.kind === kind}
                  onChange={() => setDraft({ ...draft, kind })}
                />
                {RISK_SOURCE_KIND_LABELS[kind]}
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[12rem_10rem_minmax(0,1fr)]">
            <Input
              label="外部紀錄編號"
              required
              value={draft.externalReference}
              error={errors.externalReference}
              onChange={(value) => setDraft({ ...draft, externalReference: value })}
            />
            <Input
              label="日期"
              type="date"
              required
              value={draft.date}
              error={errors.date}
              onChange={(value) => setDraft({ ...draft, date: value })}
            />
            <Input label="摘要（選填）" value={draft.summary} onChange={(value) => setDraft({ ...draft, summary: value })} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-ink">關聯程序（點選＝計入，每件計 1 件）</legend>
            <p className="text-xs text-muted">
              {FACTOR_DEFINITIONS[KIND_FACTOR[draft.kind]].scale}。
              {suggestedCount > 0 ? ` 依程序類型對照，${suggestedCount} 個程序標示「建議關聯」。` : ''}
            </p>
            {departments.map((department) => {
              const rows = company.planRows
                .filter((row) => row.department === department)
                .sort((a, b) => Number(suggested(b)) - Number(suggested(a)))
              return (
                <div key={department} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 shrink-0 text-xs font-bold text-muted">{department}</span>
                  {rows.map((row) => {
                    const key = `${row.qpCode}|${row.departmentId}`
                    const checked = selectedKeys.has(key)
                    return (
                      <label
                        key={key}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded border px-2 text-xs ${checked ? 'border-primary bg-row-selected text-ink' : 'border-line text-ink'}`}
                        title={`${row.qpCode} ${row.process}（${row.department}）`}
                      >
                        <input type="checkbox" className={FOCUS_RING} checked={checked} onChange={(event) => toggleTarget(row, event.target.checked)} />
                        {row.qpCode} {shortProcess(row)}{suggested(row) ? '・建議關聯' : ''}
                      </label>
                    )
                  })}
                </div>
              )
            })}
            {errors.targets && <p className="text-xs text-danger" role="alert">{errors.targets}</p>}
          </fieldset>

          {draft.targets.length > 0 && (
            <ul className="space-y-1" aria-label="已選關聯程序">
              {draft.targets.map((target) => {
                const key = targetKey(target)
                const row = rowFor(target)
                return (
                  <li key={key} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="min-w-[12rem] text-ink">{target.qpCode} {row ? shortProcess(row) : ''}（{row?.department ?? target.departmentId}）</span>
                    <Select
                      ariaLabel={`${target.qpCode} 關聯類型`}
                      value={target.linkType ?? 'primary'}
                      onChange={(value) => updateTarget(key, { linkType: value as RiskSourceLinkType })}
                      options={(Object.keys(RISK_SOURCE_LINK_TYPE_LABELS) as RiskSourceLinkType[]).map((type) => ({ value: type, label: RISK_SOURCE_LINK_TYPE_LABELS[type] }))}
                    />
                    <label className="inline-flex min-h-9 items-center gap-1.5">
                      <input
                        type="checkbox"
                        className={FOCUS_RING}
                        checked={target.linkStatus === 'pending'}
                        onChange={(event) => updateTarget(key, { linkStatus: event.target.checked ? 'pending' : 'confirmed' })}
                      />
                      待確認（暫不計入）
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex gap-2">
            <Button onClick={save}>儲存來源</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setErrors({}); setDraft(emptyDraft()) }}>取消</Button>
          </div>
        </div>
      )}

      <ProcessTypeMatrix store={store} />

      {events.length === 0 ? (
        <EmptyState message="本年度尚無外部來源登錄。" />
      ) : (
        <ScrollRegion ariaLabel="外部來源登錄一覽">
          <table className="worksheet-table min-w-[52rem]">
            <colgroup>
              <col className="col-status" />
              <col className="col-name" />
              <col className="col-date" />
              <col className="col-name" />
              <col />
              <col className="col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>類別</th>
                <th>外部編號</th>
                <th>日期</th>
                <th>摘要</th>
                <th>關聯程序・是否計入・即時優先分</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, eventIndex) => (
                <tr
                  key={event.id}
                  className={`${!pagination.isVisible(eventIndex) ? 'pagination-hidden-row ' : ''}${event.voidedAt ? 'text-muted' : ''}`}
                >
                  <td>{RISK_SOURCE_KIND_LABELS[event.kind]}</td>
                  <td className="break-words">{event.externalReference}</td>
                  <td>{event.date}</td>
                  <td className="break-words">
                    {event.summary || '—'}
                    {event.voidedAt && <span className="block text-xs">已作廢：{event.voidReason}</span>}
                  </td>
                  <td className="text-xs">
                    <ul className="space-y-1">
                      {event.targets.map((target) => {
                        const key = targetKey(target)
                        const row = rowFor(target)
                        const status = effectiveLinkStatus(target)
                        const editing = rejecting?.eventId === event.id && rejecting.key === key ? rejecting : null
                        return (
                          <li key={key} className="space-y-1">
                            <span className="block break-words">
                              {target.qpCode} {row ? shortProcess(row) : ''}（{row?.department ?? target.departmentId}）・
                              {RISK_SOURCE_LINK_TYPE_LABELS[target.linkType ?? 'primary']}・
                              <span className={status === 'pending' ? 'font-bold text-tone-warning-fg' : status === 'not_applicable' ? 'text-muted' : 'font-bold text-ink'}>
                                {RISK_SOURCE_LINK_STATUS_LABELS[status]}・{LINK_COUNTED_LABELS[status]}
                              </span>
                              {status === 'confirmed' && !event.voidedAt && <span className="text-muted"> → {scoreText(target)}</span>}
                              {status === 'not_applicable' && target.linkReason && <span className="text-muted">（{target.linkReason}）</span>}
                            </span>
                            {!event.voidedAt && status !== 'not_applicable' && !editing && (
                              <span className="flex flex-wrap gap-1">
                                {status === 'pending' && (
                                  <Button variant="secondary" className="min-h-9 px-2 py-1" onClick={() => setRiskSourceLinkStatus(event.id, key, 'confirmed', '')}>
                                    計入
                                  </Button>
                                )}
                                <Button variant="ghost" className="min-h-9 px-2 py-1" onClick={() => setRejecting({ eventId: event.id, key, reason: '' })}>
                                  不適用
                                </Button>
                              </span>
                            )}
                            {editing && (
                              <span className="flex flex-wrap items-end gap-1">
                                <ReasonSelect
                                  label={`${target.qpCode} 不適用理由`}
                                  options={NOT_APPLICABLE_REASONS}
                                  value={editing.reason}
                                  onChange={(reason) => setRejecting({ ...editing, reason })}
                                />
                                <Button
                                  variant="secondary"
                                  className="min-h-9 px-2 py-1"
                                  disabled={!isReasonFilled(editing.reason)}
                                  onClick={() => {
                                    setRiskSourceLinkStatus(event.id, key, 'not_applicable', editing.reason)
                                    setRejecting(null)
                                  }}
                                >
                                  判定不適用
                                </Button>
                                <Button variant="ghost" className="min-h-9 px-2 py-1" onClick={() => setRejecting(null)}>取消</Button>
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </td>
                  <td>
                    {event.voidedAt ? '已作廢' : voiding?.id === event.id ? (
                      <div className="space-y-1">
                        <ReasonSelect
                          label={`${event.externalReference} 作廢理由`}
                          options={VOID_REASONS}
                          value={voiding.reason}
                          onChange={(reason) => setVoiding({ id: event.id, reason })}
                        />
                        <div className="flex gap-1">
                          <Button
                            variant="dangerOutline"
                            className="min-h-9 px-2 py-1"
                            disabled={!isReasonFilled(voiding.reason)}
                            onClick={() => { voidRiskSourceEvent(event.id, voiding.reason); setVoiding(null) }}
                          >
                            確認作廢
                          </Button>
                          <Button variant="ghost" className="min-h-9 px-2 py-1" onClick={() => setVoiding(null)}>取消</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" className="min-h-9 px-2 py-1" onClick={() => setVoiding({ id: event.id, reason: '' })}>作廢</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      )}
      {events.length > 0 && <TablePagination pagination={pagination} label="外部來源登錄" />}
    </section>
  )
}
