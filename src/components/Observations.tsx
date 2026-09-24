import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportObservationsExcel } from '../lib/formExport'
import { MANUAL_OVERRIDE_PLAN_NOTE } from '../lib/planner'
import type { ObservationStatus } from '../types'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { EmptyState } from './ui/EmptyState'
import { FilterChips } from './ui/FilterChips'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'

type YearFilter = 'all' | string
type SourceFilter = 'all' | 'internal_audit' | 'third_party_audit' | 'checklist_unsynced'
type StatusFilter = 'all' | ObservationStatus

export function Observations({ store }: { store: AuditStore }) {
  const {
    state,
    updateObservation,
    convertObservationToNCR,
    addObservation,
    addObservationFollowUp,
    carryForwardObservation,
    carryForwardNCR,
    regeneratePlan,
  } = store
  const { company, settings } = state
  const currentYear = settings.auditYear
  const [showForm, setShowForm] = useState(false)
  const [yearFilter, setYearFilter] = useState<YearFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [followDraft, setFollowDraft] = useState<Record<string, string>>({})
  const [followDate, setFollowDate] = useState<Record<string, string>>({})
  const [todayLocal] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10))
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ content: '', description: '', owner: '', dueDate: '', closedAt: '', closeEvidence: '' })
  const [form, setForm] = useState({ sourceType: 'third_party_audit' as 'internal_audit' | 'third_party_audit', sourceAuditId: '', sourceReference: '', occurrenceDate: '', qpCode: '', departmentId: company.departments[0]?.id ?? '', content: '', description: '', owner: '', dueDate: '' })
  const [pendingNcrId, setPendingNcrId] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const allObservations = useMemo(() => [
    ...company.observations,
    ...Object.entries(state.yearArchives).filter(([year]) => year !== String(currentYear)).flatMap(([, archive]) => archive.companies[state.activeCompanyId]?.observations ?? []),
  ], [company.observations, state.yearArchives, state.activeCompanyId, currentYear])
  const priorObs = allObservations.filter((o) => o.year < currentYear && o.status === 'open')
  const openPriorNCR = Object.entries(state.yearArchives)
    .filter(([year]) => year !== String(currentYear))
    .flatMap(([, archive]) => archive.companies[state.activeCompanyId]?.ncrs ?? [])
    .filter((n) => n.status !== '結案')
  const years = [...new Set(allObservations.map((item) => item.year))].sort((a, b) => b - a)
  const auditEvents = useMemo(() => [
    ...company.audits,
    ...Object.entries(state.yearArchives).filter(([year]) => year !== String(currentYear)).flatMap(([, archive]) => archive.companies[state.activeCompanyId]?.audits ?? []),
  ], [company.audits, state.yearArchives, state.activeCompanyId, currentYear])
  const records = useMemo(() => allObservations.filter((item) =>
    (yearFilter === 'all' || item.year === Number(yearFilter)) &&
    (sourceFilter === 'all' || sourceFilter === 'checklist_unsynced' || (item.sourceType ?? 'internal_audit') === sourceFilter) &&
    (statusFilter === 'all' || item.status === statusFilter),
  ).sort((a, b) => (b.occurrenceDate ?? `${b.year}`).localeCompare(a.occurrenceDate ?? `${a.year}`)), [allObservations, yearFilter, sourceFilter, statusFilter])

  const ledgerChecklistIds = new Set(
    company.observations
      .map((item) => item.sourceChecklistItemId)
      .filter(Boolean),
  )
  const auditObservations = company.audits.flatMap((audit) =>
    audit.items
      .filter((item) => item.judgment === '觀察' && !ledgerChecklistIds.has(item.id))
      .map((item) => ({
        id: item.id,
        label: `${audit.qpCode} · ${audit.department}`,
        content: item.content,
        description: item.description,
        sourceYear: item.sourceYear,
        ledgerId: company.observations.find((obs) => obs.sourceChecklistItemId === item.id)?.id,
      })),
  )

  const statusLabel: Record<ObservationStatus, string> = {
    open: '待追蹤',
    closed: '已結案',
    became_ncr: '已轉 NCR',
  }

  const yearFilterOptions = [
    { id: 'all' as YearFilter, label: '全部年度' },
    ...years.map((year) => ({ id: String(year) as YearFilter, label: `${year} 年` })),
  ]
  const sourceFilterOptions = [
    { id: 'all' as SourceFilter, label: '全部來源' },
    { id: 'internal_audit' as SourceFilter, label: '內部稽核' },
    { id: 'third_party_audit' as SourceFilter, label: '第三方稽核' },
    { id: 'checklist_unsynced' as SourceFilter, label: '查檢未同步' },
  ]
  const statusFilterOptions = [
    { id: 'all' as StatusFilter, label: '全部狀態' },
    { id: 'open' as StatusFilter, label: '待追蹤' },
    { id: 'closed' as StatusFilter, label: '已結案' },
    { id: 'became_ncr' as StatusFilter, label: '已轉 NCR' },
  ]

  const importableObs = priorObs.filter(
    (o) => o.carriedToYear !== currentYear && !o.carryForwards?.some((entry) => entry.year === currentYear),
  )
  const importableNCR = openPriorNCR.filter(
    (ncr) => !company.audits.some((audit) => audit.items.some((item) => item.sourceNcrId === ncr.id)),
  )
  const pendingNcrObs = pendingNcrId ? allObservations.find((o) => o.id === pendingNcrId) : undefined

  const showingUnsynced = sourceFilter === 'checklist_unsynced'
  const listCount = showingUnsynced ? auditObservations.length : records.length
  const listTitle = showingUnsynced
    ? `查檢未同步（${auditObservations.length}）`
    : `觀察事項紀錄（${records.length}）`

  const importAllOpen = () => {
    for (const obs of importableObs) {
      const qp = obs.qpCode || 'QP-01'
      carryForwardObservation(obs.id, qp, obs.departmentId)
    }
    for (const ncr of importableNCR) {
      carryForwardNCR(ncr.id, ncr.qpCode, ncr.departmentId)
    }
    regeneratePlan()
    setShowImportDialog(false)
  }

  return (
    <div className="space-y-6 print-area qr-form">
      {(importableObs.length > 0 || importableNCR.length > 0) && (
        <Card className="border-amber-200 bg-amber-50/40 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-900">
              跨年待帶入：觀察 {importableObs.length} 件、NCR {importableNCR.length} 件。
            </p>
            <Button
              icon={ACTION_ICONS.restore}
              disabled={importableObs.length === 0 && importableNCR.length === 0}
              onClick={() => setShowImportDialog(true)}
            >
              匯入全部待追蹤項目
            </Button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">逐筆帶入</summary>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-medium">前年度觀察事項（{priorObs.length}）</h3>
                {priorObs.length === 0 ? (
                  <p className="text-sm text-slate-500">無前年度觀察事項</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {priorObs.map((obs) => (
                      <li key={obs.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2">
                        <span className="min-w-0 truncate">
                          <Badge label={`${obs.year}年`} />
                          <span className="ml-2 font-medium">{obs.qpCode} · {obs.department}</span>
                          <span className="ml-2 text-slate-600">{obs.content}</span>
                          {obs.carriedToYear && (
                            <span className="ml-2 text-xs text-blue-600">已帶入 {obs.carriedToYear} 年</span>
                          )}
                        </span>
                        {obs.carriedToYear !== currentYear && !obs.carryForwards?.some((entry) => entry.year === currentYear) && (
                          <Button variant="secondary" onClick={() => carryForwardObservation(obs.id, obs.qpCode, obs.departmentId)}>
                            帶入 {currentYear} 年查檢表
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">未結案 NCR 跨年追蹤（{openPriorNCR.length}）</h3>
                {openPriorNCR.length === 0 ? (
                  <p className="text-sm text-slate-500">無未結案 NCR</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {openPriorNCR.map((ncr) => (
                      <li key={ncr.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                        <span>{ncr.ncrNumber} · {ncr.qpCode} · {ncr.description}</span>
                        <Button
                          variant="secondary"
                          disabled={company.audits.some((audit) => audit.items.some((item) => item.sourceNcrId === ncr.id))}
                          onClick={() => carryForwardNCR(ncr.id, ncr.qpCode, ncr.departmentId)}
                        >
                          {company.audits.some((audit) => audit.items.some((item) => item.sourceNcrId === ncr.id)) ? '已帶入查檢表' : '帶入查檢表'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        </Card>
      )}

      <div>
        <PrintDocHeader
          companyName={company.name}
          auditYear={currentYear}
          formTitle="觀察事項紀錄台帳"
        />
        <PageToolbar
          title="觀察事項"
          actions={(
            <>
              <Button icon={showForm ? undefined : ACTION_ICONS.add} onClick={() => setShowForm((value) => !value)}>{showForm ? '收起登錄' : '登錄觀察事項'}</Button>
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportObservationsExcel(state, state.activeCompanyId)}>匯出 Excel</Button>
            </>
          )}
        />

        <FilterChips
          options={yearFilterOptions}
          value={yearFilter}
          onChange={setYearFilter}
          ariaLabel="觀察事項年度篩選"
          tone="slate"
        />
        <FilterChips
          options={sourceFilterOptions}
          value={sourceFilter}
          onChange={setSourceFilter}
          ariaLabel="觀察事項來源篩選"
        />
        <FilterChips
          options={statusFilterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="觀察事項狀態篩選"
          tone="slate"
        />

        <h3 className="mb-3 font-semibold">{listTitle}</h3>

        {listCount === 0 ? (
          <EmptyState
            message={showingUnsynced ? '目前沒有查檢未同步項目。' : '目前沒有紀錄。'}
            action={!showingUnsynced && (yearFilter !== 'all' || statusFilter !== 'all') ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setYearFilter('all')
                  setStatusFilter('all')
                  setSourceFilter('all')
                }}
              >
                查看全部
              </Button>
            ) : undefined}
          />
        ) : (
          <ScrollRegion ariaLabel="觀察事項紀錄台帳">
            {showingUnsynced ? (
              <ul className="space-y-2 text-sm">
                {auditObservations.map((obs) => (
                  <li key={obs.id} className="rounded border border-slate-100 p-3">
                    <span className="font-medium">{obs.label}：</span>{obs.content}
                    {obs.sourceYear && (
                      <span className="ml-2 text-xs text-amber-600">（源自 {obs.sourceYear} 年）</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-1">
                {records.map((item) => {
                  const expanded = expandedId === item.id || editId === item.id
                  const sourceLabel = (item.sourceType ?? 'internal_audit') === 'internal_audit' ? '內部稽核' : '第三方稽核'
                  return (
                    <div key={item.id} className="rounded-lg border border-slate-200">
                      <div
                        className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between ${expanded ? 'bg-slate-50' : 'hover:bg-slate-50/60'}`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setExpandedId(expanded && editId !== item.id ? null : item.id)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge label={`${item.year}年`} />
                            <Badge label={sourceLabel} />
                            <Badge label={statusLabel[item.status]} />
                            <span className="font-medium text-slate-800">{item.qpCode} · {item.department}</span>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-700">{item.content}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.occurrenceDate || '日期待確認'} · 責任 {item.owner || '待指定'} · 到期 {item.dueDate || '待確認'}
                          </p>
                        </button>
                        <div className="flex flex-wrap gap-2 no-print" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="secondary"
                            icon={ACTION_ICONS.edit}
                            disabled={item.status === 'became_ncr'}
                            onClick={() => {
                              setExpandedId(item.id)
                              setEditId(item.id)
                              setEditDraft({
                                content: item.content,
                                description: item.description,
                                owner: item.owner ?? '',
                                dueDate: item.dueDate ?? '',
                                closedAt: item.closedAt || todayLocal,
                                closeEvidence: item.closeEvidence ?? '',
                              })
                            }}
                          >
                            編輯／結案
                          </Button>
                          {item.status === 'open' && (
                            <Button variant="secondary" icon={ACTION_ICONS.convertNcr} onClick={() => setPendingNcrId(item.id)}>轉為 NCR</Button>
                          )}
                          {item.status === 'closed' && (
                            <Button variant="secondary" onClick={() => updateObservation(item.id, { status: 'open' })}>重新開啟</Button>
                          )}
                        </div>
                      </div>
                      {expanded && (
                        <div className="border-t border-slate-100 p-3">
                          <p className="text-sm text-slate-600">{item.description}</p>
                          {(item.followUps ?? []).length > 0 && (
                            <div className="mt-3 space-y-1 border-l-2 border-slate-200 pl-3">
                              {[...(item.followUps ?? [])].sort((a, b) => a.date.localeCompare(b.date)).map((entry) => (
                                <p key={entry.id} className="text-xs">
                                  <span className="font-medium">{entry.date || '未填日期'}</span> · {entry.note}
                                </p>
                              ))}
                            </div>
                          )}
                          {!!item.revisions?.length && (
                            <details className="mt-3 text-xs text-slate-600">
                              <summary className="cursor-pointer font-medium">修訂歷程（{item.revisions.length}）</summary>
                              <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
                                {item.revisions.map((revision) => (
                                  <div key={revision.id}>
                                    <p className="font-medium">{new Date(revision.changedAt).toLocaleString('zh-TW')}</p>
                                    {([
                                      ['content', '觀察事項'], ['description', '處理說明'], ['owner', '責任人'], ['dueDate', '預定完成日'], ['closedAt', '結案日期'], ['closeEvidence', '結案證據'], ['status', '狀態'],
                                    ] as const).filter(([field]) => revision.before[field] !== revision.after[field]).map(([field, label]) => (
                                      <p key={field}>{label}：{revision.before[field] || '空白'} → {revision.after[field] || '空白'}</p>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                          {editId === item.id ? (
                            <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Input label="觀察事項" value={editDraft.content} onChange={(value) => setEditDraft({ ...editDraft, content: value })} />
                                <Input label="處理要求／說明" value={editDraft.description} onChange={(value) => setEditDraft({ ...editDraft, description: value })} />
                                <Input label="責任人" value={editDraft.owner} onChange={(value) => setEditDraft({ ...editDraft, owner: value })} />
                                <Input label="預定完成日" type="date" value={editDraft.dueDate} onChange={(value) => setEditDraft({ ...editDraft, dueDate: value })} />
                                <Input label="結案日期" type="date" value={editDraft.closedAt} onChange={(value) => setEditDraft({ ...editDraft, closedAt: value })} />
                                <Input label="結案證據／紀錄" value={editDraft.closeEvidence} onChange={(value) => setEditDraft({ ...editDraft, closeEvidence: value })} />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button disabled={!editDraft.content.trim()} onClick={() => { updateObservation(item.id, editDraft); setEditId(null) }}>儲存修改</Button>
                                <Button disabled={!editDraft.content.trim() || !editDraft.closedAt || !editDraft.closeEvidence?.trim()} onClick={() => { updateObservation(item.id, { ...editDraft, status: 'closed' }); setEditId(null) }}>儲存並結案</Button>
                                <Button variant="secondary" onClick={() => setEditId(null)}>取消</Button>
                              </div>
                              {item.status === 'open' && <p className="text-xs text-slate-500">結案須填寫結案日期與結案證據，可一次按「儲存並結案」。</p>}
                            </div>
                          ) : item.status === 'open' ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                              <Input label="追蹤日期" type="date" value={followDate[item.id] ?? todayLocal} onChange={(value) => setFollowDate({ ...followDate, [item.id]: value })} />
                              <Input label="新增本次追蹤紀錄" value={followDraft[item.id] ?? ''} onChange={(value) => setFollowDraft({ ...followDraft, [item.id]: value })} />
                              <Button variant="secondary" disabled={!followDraft[item.id]?.trim() || followDate[item.id] === ''} onClick={() => { addObservationFollowUp(item.id, followDate[item.id] ?? todayLocal, followDraft[item.id] ?? ''); setFollowDraft({ ...followDraft, [item.id]: '' }) }}>加入時間軸</Button>
                            </div>
                          ) : null}
                          {item.status === 'closed' && <p className="mt-2 text-xs text-green-700">結案：{item.closedAt} · {item.closeEvidence}</p>}
                          {item.convertedNcrId && <p className="mt-2 text-xs text-blue-700">關聯 NCR：{company.ncrs.find((n) => n.id === item.convertedNcrId)?.ncrNumber ?? item.convertedNcrId}</p>}
                          {item.carriedToYear && <p className="mt-2 text-xs text-blue-700">已帶入 {item.carriedToYear} 年查檢表</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollRegion>
        )}
      </div>

      {showForm && (
        <Card className="border-blue-200 no-print">
          <h3 className="mb-4 font-semibold">登錄稽核活動觀察事項</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="來源活動" value={form.sourceType} onChange={(value) => setForm({ ...form, sourceType: value as typeof form.sourceType, sourceAuditId: '' })} options={[{ value: 'internal_audit', label: '內部稽核' }, { value: 'third_party_audit', label: '第三方稽核' }]} />
            {form.sourceType === 'internal_audit' && <Select label="內部稽核事件" value={form.sourceAuditId} onChange={(value) => { const audit = auditEvents.find((item) => item.id === value); setForm({ ...form, sourceAuditId: value, sourceReference: audit?.reportReference || value, occurrenceDate: audit?.auditDate || audit?.plannedDate || '', qpCode: audit?.qpCode || '', departmentId: audit?.departmentId || form.departmentId }) }} options={[{ value: '', label: '請選擇事件' }, ...auditEvents.map((audit) => ({ value: audit.id, label: `${audit.year ?? currentYear} · ${audit.qpCode} · ${audit.department} · ${audit.auditDate || audit.plannedDate || '日期待確認'}` }))]} />}
            <Input label="來源事件／報告編號" value={form.sourceReference} onChange={(value) => setForm({ ...form, sourceReference: value })} />
            <Input label="發生日" type="date" value={form.occurrenceDate} onChange={(value) => setForm({ ...form, occurrenceDate: value })} />
            <Input label="程序 QP" value={form.qpCode} onChange={(value) => setForm({ ...form, qpCode: value })} />
            <Select label="責任單位" value={form.departmentId} onChange={(value) => setForm({ ...form, departmentId: value })} options={company.departments.map((department) => ({ value: department.id, label: department.name }))} />
            <Input label="責任人" value={form.owner} onChange={(value) => setForm({ ...form, owner: value })} />
            <Input label="觀察事項" value={form.content} onChange={(value) => setForm({ ...form, content: value })} />
            <Input label="處理要求／說明" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
            <Input label="預定完成日" type="date" value={form.dueDate} onChange={(value) => setForm({ ...form, dueDate: value })} />
          </div>
          {form.occurrenceDate && Number(form.occurrenceDate.slice(0, 4)) !== currentYear && <p className="mt-2 text-sm text-amber-700">請先切換至 {form.occurrenceDate.slice(0, 4)} 年度，再登錄該年度紀錄。</p>}
          <div className="mt-4 flex gap-2">
            <Button disabled={!form.content.trim() || !form.sourceReference.trim() || !form.occurrenceDate || Number(form.occurrenceDate.slice(0, 4)) !== currentYear || (form.sourceType === 'internal_audit' && !form.sourceAuditId)} onClick={() => { const department = company.departments.find((item) => item.id === form.departmentId); addObservation({ year: currentYear, qpCode: form.qpCode || '待確認', departmentId: form.departmentId, department: department?.name ?? '待確認', process: '', content: form.content, description: form.description, status: 'open', sourceType: form.sourceType, sourceAuditId: form.sourceAuditId || undefined, sourceReference: form.sourceReference, occurrenceDate: form.occurrenceDate, owner: form.owner, dueDate: form.dueDate, followUps: [] }); setShowForm(false); setForm({ ...form, sourceAuditId: '', sourceReference: '', occurrenceDate: '', qpCode: '', content: '', description: '', owner: '', dueDate: '' }) }}>儲存紀錄</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </Card>
      )}

      {pendingNcrObs && (
        <ConfirmDialog
          open
          title="轉為 NCR？"
          description={`將建立不符合紀錄，觀察事項狀態將變為「已轉 NCR」且無法從畫面復原。\n\n${pendingNcrObs.qpCode} · ${pendingNcrObs.department}\n${pendingNcrObs.content}`}
          confirmLabel="確認轉換"
          variant="danger"
          onConfirm={() => {
            convertObservationToNCR(pendingNcrObs.id)
            setPendingNcrId(null)
          }}
          onCancel={() => setPendingNcrId(null)}
        />
      )}
      {showImportDialog && (
        <ConfirmDialog
          open
          title="匯入全部待追蹤項目？"
          description={`將帶入 ${importableObs.length} 筆前年度觀察事項與 ${importableNCR.length} 筆未結案 NCR 至本年度查檢表，並重新自動編排年度計畫（${MANUAL_OVERRIDE_PLAN_NOTE}）`}
          confirmLabel="確認匯入"
          variant="danger"
          onConfirm={importAllOpen}
          onCancel={() => setShowImportDialog(false)}
        />
      )}
    </div>
  )
}
