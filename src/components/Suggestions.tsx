import { Fragment, useEffect, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { useInlineFormFocus } from '../hooks/useInlineFormFocus'
import { useRecordDisclosure } from '../hooks/useRecordDisclosure'
import { FOCUS_RING } from '../lib/focusRing'
import { exportSuggestionsExcel } from '../lib/formExport'
import type { SuggestionStatus, ThirdPartySuggestion } from '../types'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'
import { MoveToTrashDialog, type TrashDeleteTarget } from './ui/MoveToTrashDialog'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'

export function Suggestions({
  store,
  highlightRecordId,
}: {
  store: AuditStore
  highlightRecordId?: string
}) {
  const { state, updateSuggestion, carryForwardSuggestion, addSuggestion, moveSuggestionToTrash } = store
  const { company, settings } = state
  const currentYear = settings.auditYear
  const [showForm, setShowForm] = useState(false)
  const { triggerRef, formRef } = useInlineFormFocus(showForm)
  const [expandedId, setExpandedId] = useRecordDisclosure(`${state.activeCompanyId}:${currentYear}`, highlightRecordId)
  const [saveMessage, setSaveMessage] = useState(false)
  const [form, setForm] = useState({
    procedure: company.planRows[0]?.qpCode ?? '',
    departmentId: company.planRows[0]?.departmentId ?? '',
    issue: '',
    progress: '',
    responsibleUnit: '',
  })
  const [carryDept, setCarryDept] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<TrashDeleteTarget | null>(null)

  const statusLabel: Record<SuggestionStatus, string> = {
    open: '待追蹤',
    closed: '已結案',
  }

  const allSuggestions = useMemo(() => [
    ...company.suggestions,
    ...Object.entries(state.yearArchives)
      .filter(([year]) => year !== String(currentYear))
      .flatMap(([, archive]) => archive.companies[state.activeCompanyId]?.suggestions ?? []),
  ], [company.suggestions, state.yearArchives, state.activeCompanyId, currentYear])

  const prior = allSuggestions.filter((s) => s.year < currentYear)
  const current = allSuggestions.filter((s) => s.year >= currentYear)
  const listedSuggestions = [...prior, ...current]
  const highlightIndex = highlightRecordId
    ? listedSuggestions.findIndex((suggestion) => suggestion.id === highlightRecordId)
    : -1
  const pagination = useTablePagination(
    listedSuggestions.length,
    10,
    highlightRecordId && highlightIndex >= 0 ? { key: highlightRecordId, index: highlightIndex } : undefined,
    String(currentYear),
  )

  useEffect(() => {
    if (!highlightRecordId) return
    requestAnimationFrame(() => {
      document.querySelector(`[data-suggestion-id="${highlightRecordId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [highlightRecordId])

  const planRowsForProcedure = (qp: string) =>
    company.planRows.filter((row) => row.qpCode === qp)

  const procedureOptions = useMemo(() => {
    const seen = new Set<string>()
    return company.planRows.reduce<{ value: string; label: string }[]>((options, row) => {
      if (seen.has(row.qpCode)) return options
      seen.add(row.qpCode)
      options.push({ value: row.qpCode, label: `${row.qpCode} · ${row.process}` })
      return options
    }, [])
  }, [company.planRows])

  const renderCarryActions = (sug: ThirdPartySuggestion) => {
    const rows = planRowsForProcedure(sug.procedure)
    const deptId = carryDept[sug.id] ?? sug.departmentId ?? rows[0]?.departmentId ?? ''
    const canCarry = sug.status === 'open' && !sug.carriedToYear && rows.length > 0
    return (
      <div className="flex flex-col gap-2">
        {sug.carriedToYear && <span className="text-xs text-blue-600">已帶入 {sug.carriedToYear}</span>}
        {canCarry && rows.length > 1 && (
          <Select
            label="帶入部門"
            value={deptId}
            onChange={(value) => setCarryDept({ ...carryDept, [sug.id]: value })}
            options={rows.map((row) => ({ value: row.departmentId, label: row.department }))}
          />
        )}
        {canCarry && (
          <Button
            variant="secondary"
            disabled={!deptId}
            onClick={() => carryForwardSuggestion(sug.id, sug.procedure, deptId)}
          >
            帶入 {currentYear} 年
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <div>
        <PrintDocHeader
          companyName={company.name}
          auditYear={currentYear}
          formTitle="第三方稽核建議事項一覽表"
        />
        <PageToolbar
          title="第三方建議"
          actions={(
            <>
              {!showForm && <Button ref={triggerRef} icon={ACTION_ICONS.add} onClick={() => setShowForm(true)}>登錄建議</Button>}
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportSuggestionsExcel(state, state.activeCompanyId)}>匯出 Excel</Button>
            </>
          )}
        />
      {showForm && (
        <div ref={formRef} className="mb-4">
        <Card className="border-blue-200 no-print">
          <h3 className="mb-4 font-semibold">登錄第三方建議</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="程序 QP"
              value={form.procedure}
              onChange={(value) => {
                const rows = planRowsForProcedure(value)
                setForm({ ...form, procedure: value, departmentId: rows[0]?.departmentId ?? '' })
              }}
              options={procedureOptions}
            />
            <Select
              label="責任單位"
              value={form.departmentId}
              onChange={(value) => setForm({ ...form, departmentId: value })}
              options={planRowsForProcedure(form.procedure).map((row) => ({ value: row.departmentId, label: row.department }))}
            />
            <Input label="問題描述" value={form.issue} onChange={(value) => setForm({ ...form, issue: value })} />
            <Input label="負責單位（文字）" value={form.responsibleUnit} onChange={(value) => setForm({ ...form, responsibleUnit: value })} />
            <Input label="進度" value={form.progress} onChange={(value) => setForm({ ...form, progress: value })} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={!form.issue.trim()}
              onClick={() => {
                addSuggestion({
                  year: currentYear,
                  procedure: form.procedure,
                  departmentId: form.departmentId || undefined,
                  issue: form.issue,
                  progress: form.progress,
                  responsibleUnit: form.responsibleUnit,
                  status: 'open',
                })
                setForm({ procedure: form.procedure, departmentId: form.departmentId, issue: '', progress: '', responsibleUnit: '' })
                setShowForm(false)
                setSaveMessage(true)
              }}
            >
              儲存
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </Card>
        </div>
      )}
        {saveMessage && !showForm && (
          <p className="mb-3 text-sm text-green-700" role="status">已儲存</p>
        )}

        <h3 className="mb-3 font-semibold">第三方建議一覽（{listedSuggestions.length}）</h3>

        {listedSuggestions.length === 0 ? (
          <EmptyState message="目前沒有建議事項。" />
        ) : (
          <>
          <ScrollRegion ariaLabel="第三方建議一覽">
            <table className="worksheet-table min-w-[48rem]">
              <colgroup>
                <col className="col-year" />
                <col />
                <col className="col-code" />
                <col className="col-name" />
                <col />
                <col className="col-status" />
                <col className="col-action no-print" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border p-2">年度</th>
                  <th className="border p-2">摘要</th>
                  <th className="border p-2">QP</th>
                  <th className="border p-2">負責單位</th>
                  <th className="border p-2">進度</th>
                  <th className="border p-2">狀態</th>
                  <th className="border p-2 no-print">操作</th>
                </tr>
              </thead>
              <tbody>
                {listedSuggestions.map((sug, index) => (
                  <Fragment key={sug.id}>
                  <tr
                    data-suggestion-id={sug.id}
                    className={`${!pagination.isVisible(index) ? 'pagination-hidden-row ' : ''}hover:bg-slate-50 ${highlightRecordId === sug.id ? 'ring-2 ring-primary ring-inset' : ''}`}
                  >
                    <td className="border p-2 text-xs">{sug.year}</td>
                    <td className="border p-2 break-words">{sug.issue}</td>
                    <td className="border p-2 text-xs font-medium break-words">{sug.procedure}</td>
                    <td className="border p-2 text-xs break-words">{sug.responsibleUnit}</td>
                    <td className="border p-2">
                      <textarea
                        className={`w-full min-w-0 rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        rows={2}
                        aria-label={`${sug.year} ${sug.procedure} 建議進度`}
                        value={sug.progress}
                        onChange={(e) => updateSuggestion(sug.id, { progress: e.target.value })}
                      />
                      <span className="print-only">{sug.progress}</span>
                    </td>
                    <td className="border p-2">
                      <div className="no-print">
                        <Select
                          ariaLabel={`${sug.year} ${sug.procedure} 建議狀態`}
                          value={sug.status}
                          onChange={(v) => updateSuggestion(sug.id, { status: v as SuggestionStatus })}
                          options={[
                            { value: 'open', label: '待追蹤' },
                            { value: 'closed', label: '已結案' },
                          ]}
                        />
                      </div>
                      <span className="print-only"><Badge label={statusLabel[sug.status]} /></span>
                    </td>
                    <td className="border p-2 no-print">
                      {renderCarryActions(sug)}
                      <button
                        type="button"
                        className={`min-h-11 text-sm text-link hover:underline ${FOCUS_RING}`}
                        aria-label={`${sug.year} ${sug.procedure} 建議明細：${sug.issue}`}
                        aria-expanded={expandedId === sug.id}
                        aria-controls={`suggestion-detail-${sug.id}`}
                        onClick={() => setExpandedId(expandedId === sug.id ? null : sug.id)}
                      >{expandedId === sug.id ? '收合' : '明細'}</button>
                    </td>
                  </tr>
                  <tr id={`suggestion-detail-${sug.id}`} hidden={expandedId !== sug.id || !pagination.isVisible(index)} className="no-print bg-page">
                    <td colSpan={7} className="border p-3">
                      {expandedId === sug.id && (
                        <div className="flex flex-wrap items-center gap-3">
                          <Button variant="ghost" icon={ACTION_ICONS.delete} className="text-red-700"
                            aria-label={`移至回收區：${sug.year} ${sug.procedure}`}
                            onClick={() => setDeleteTarget({ id: sug.id, label: `${sug.year} · ${sug.procedure} · ${sug.issue}` })}
                          >移至回收區</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
          <TablePagination pagination={pagination} label="第三方建議" />
          </>
        )}
      </div>


      <MoveToTrashDialog
        target={deleteTarget}
        onConfirm={() => {
          if (deleteTarget) moveSuggestionToTrash(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
