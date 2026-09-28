import { Fragment, useEffect, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { useInlineFormFocus } from '../hooks/useInlineFormFocus'
import { useRecordDisclosure } from '../hooks/useRecordDisclosure'
import { FOCUS_RING } from '../lib/focusRing'
import { isNcrStale, ncrNumberLabels } from '../lib/ncr'
import { planRowSelectOptions } from '../lib/planRowOptions'
import { ACTION_ICONS } from '../lib/uiIcons'
import { NCR_COMPANY_SCOPE_LABELS, type NCRClassification, type NCRStatus } from '../types'
import { departmentMemberCandidates, verifierCandidates } from '../lib/personnel'
import { Badge, Button, Input, Select } from './ui/Badge'
import { PersonNameSelect } from './ui/PersonNameSelect'
import { EmptyState } from './ui/EmptyState'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'
import { MoveToTrashDialog, type TrashDeleteTarget } from './ui/MoveToTrashDialog'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'

const STATUSES: NCRStatus[] = ['開立', '矯正中', '結案']
const CLASSIFICATIONS: NCRClassification[] = ['重大', '輕微']

export function NCRList({
  store,
  highlightRecordId,
}: {
  store: AuditStore
  highlightRecordId?: string
}) {
  const { state, updateNCR, addManualNCR, moveNCRToTrash } = store
  const { company, settings } = state

  const [showForm, setShowForm] = useState(false)
  const { triggerRef, formRef } = useInlineFormFocus(showForm)
  const [expandedId, setExpandedId] = useRecordDisclosure(`${state.activeCompanyId}:${settings.auditYear}`, highlightRecordId)
  const [closeErrors, setCloseErrors] = useState<Record<string, string>>({})
  const [newNcr, setNewNcr] = useState({
    qpCode: company.planRows[0]?.qpCode ?? 'QP-01',
    departmentId: company.planRows[0]?.departmentId ?? '',
    description: '',
  })
  const [descriptionError, setDescriptionError] = useState<string | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<TrashDeleteTarget | null>(null)
  const highlightIndex = highlightRecordId
    ? company.ncrs.findIndex((ncr) => ncr.id === highlightRecordId)
    : -1
  const displayNumbers = ncrNumberLabels(company.ncrs)
  const pagination = useTablePagination(
    company.ncrs.length,
    10,
    highlightRecordId && highlightIndex >= 0 ? { key: highlightRecordId, index: highlightIndex } : undefined,
    String(settings.auditYear),
  )

  const planRowOptions = planRowSelectOptions(company.planRows)

  const referenceDate = `${settings.auditYear}-12-31`

  const verifierPeople = verifierCandidates(
    state.people,
    state.activeCompanyId,
    settings.auditYear,
    state.annualPersonnelAssignments,
    referenceDate,
  )

  useEffect(() => {
    if (!highlightRecordId) return
    requestAnimationFrame(() => {
      document.getElementById(`ncr-${highlightRecordId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [highlightRecordId])

  const handleAddNcr = () => {
    if (!newNcr.description.trim()) {
      setDescriptionError('請填寫描述')
      return
    }
    setDescriptionError(undefined)
    addManualNCR(newNcr)
    setNewNcr((s) => ({ ...s, description: '' }))
  }

  const handleStatusChange = (ncrId: string, status: NCRStatus) => {
    const result = updateNCR(ncrId, { status })
    if (!result.ok) {
      setCloseErrors((prev) => ({
        ...prev,
        [ncrId]: `結案須填：${result.missing?.join('、') ?? '必要欄位'}`,
      }))
      setExpandedId(ncrId)
      return
    }
    setCloseErrors((prev) => {
      const next = { ...prev }
      delete next[ncrId]
      return next
    })
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <div>
        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="不符合事項清單 QR-28-03"
        />

        <PageToolbar
          title="不符合"
          actions={!showForm && (
            <Button
              ref={triggerRef}
              variant="secondary"
              icon={ACTION_ICONS.add}
              onClick={() => setShowForm(true)}
            >
              手動新增 NCR
            </Button>
          )}
        />

        {showForm && (
          <div ref={formRef} className="mb-6 no-print">
            <p className="mb-3 text-sm text-muted">
              查檢表判定「不符」時自動匯入；發現快照會隨查檢更新，描述欄供矯正說明，不會被查檢覆寫。此處可登錄會議或現場發現。
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="程序／部門"
                value={`${newNcr.qpCode}|${newNcr.departmentId}`}
                onChange={(v) => {
                  const [qp, dept] = v.split('|')
                  setNewNcr((s) => ({ ...s, qpCode: qp, departmentId: dept }))
                }}
                options={planRowOptions}
              />
              <div>
                <Input
                  label="描述"
                  value={newNcr.description}
                  onChange={(v) => {
                    setNewNcr((s) => ({ ...s, description: v }))
                    if (descriptionError && v.trim()) setDescriptionError(undefined)
                  }}
                />
                {descriptionError && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{descriptionError}</p>
                )}
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleAddNcr} disabled={!newNcr.description.trim()}>
                  新增 NCR
                </Button>
                <Button variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
              </div>
            </div>
          </div>
        )}

        <h3 className="mb-3 text-sm font-semibold">不符合事項一覽（{company.ncrs.length}）</h3>

        {company.ncrs.length === 0 ? (
          <EmptyState message="目前無不符合事項" />
        ) : (
          <>
          <ScrollRegion ariaLabel="不符合事項一覽">
            <table className="worksheet-table min-w-[61.5rem]">
              <colgroup>
                <col className="col-code" />
                <col className="col-code" />
                <col className="col-name" />
                <col className="col-status" />
                <col />
                <col className="col-status" />
                <col className="col-date" />
                <col className="col-date" />
                <col className="col-action no-print" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border p-2">NCR#</th>
                  <th className="border p-2">QP</th>
                  <th className="border p-2">部門</th>
                  <th className="border p-2">公司</th>
                  <th className="border p-2">摘要</th>
                  <th className="border p-2">狀態</th>
                  <th className="border p-2">日期</th>
                  <th className="border p-2">到期</th>
                  <th className="border p-2 no-print">操作</th>
                </tr>
              </thead>
              <tbody>
                {company.ncrs.map((ncr, index) => {
                  const stale = isNcrStale(ncr, company.audits)
                  const expanded = expandedId === ncr.id
                  const displayNumber = displayNumbers.get(ncr.id) ?? ncr.ncrNumber
                  return (
                    <Fragment key={ncr.id}>
                      <tr
                        id={`ncr-${ncr.id}`}
                        data-ncr-id={ncr.id}
                        className={`${!pagination.isVisible(index) ? 'pagination-hidden-row ' : ''}hover:bg-slate-50 ${stale ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                      >
                        <td className="border p-2 font-mono text-xs">{displayNumber}</td>
                        <td className="border p-2 text-xs">{ncr.qpCode}</td>
                        <td className="border p-2 text-xs break-words">{ncr.department}</td>
                        <td className="border p-2 text-xs break-words">{ncr.companyScope ? NCR_COMPANY_SCOPE_LABELS[ncr.companyScope] : '—'}</td>
                        <td className="border p-2">
                          {stale && (
                            <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              查檢已非不符，建議結案
                            </p>
                          )}
                          <textarea
                            className={`w-full min-w-0 rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                            rows={2}
                            value={ncr.description}
                            onChange={(e) => updateNCR(ncr.id, { description: e.target.value })}
                            aria-label={`${displayNumber} 描述`}
                          />
                          <span className="print-only">{ncr.description}</span>
                        </td>
                        <td className="border p-2">
                          <div className="no-print">
                            <Select
                              value={ncr.status}
                              onChange={(v) => handleStatusChange(ncr.id, v as NCRStatus)}
                              ariaLabel={`${displayNumber} 狀態`}
                              options={STATUSES.map((s) => ({ value: s, label: s }))}
                            />
                          </div>
                          <span className="print-only"><Badge label={ncr.status} /></span>
                          {closeErrors[ncr.id] && (
                            <p className="mt-1 text-xs text-red-700" role="alert">{closeErrors[ncr.id]}</p>
                          )}
                        </td>
                        <td className="border p-2 text-xs">{ncr.date || '—'}</td>
                        <td className="border p-2 text-xs">{ncr.dueDate || '—'}</td>
                        <td className="border p-2 no-print">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className={`min-h-11 text-sm text-link hover:underline ${FOCUS_RING}`}
                              aria-label={`${displayNumber} 明細`}
                              aria-expanded={expanded}
                              aria-controls={`ncr-detail-${ncr.id}`}
                              onClick={() => setExpandedId(expanded ? null : ncr.id)}
                            >
                              {expanded ? '收合' : '明細'}
                            </button>
                          </div>
                        </td>
                      </tr>
                        <tr id={`ncr-detail-${ncr.id}`} hidden={!expanded || !pagination.isVisible(index)} className="no-print bg-page">
                          <td colSpan={9} className="border p-3">
                            {expanded && <>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              <Input label="日期" ariaLabel={`${displayNumber} 日期`} type="date" value={ncr.date} onChange={(v) => updateNCR(ncr.id, { date: v })} />
                              <Input label="根本原因" value={ncr.rootCause} onChange={(v) => updateNCR(ncr.id, { rootCause: v })} />
                              <Input label="矯正措施" value={ncr.correctiveAction} onChange={(v) => updateNCR(ncr.id, { correctiveAction: v })} />
                              <Input label="遏制措施" value={ncr.containment ?? ''} onChange={(v) => updateNCR(ncr.id, { containment: v })} />
                              <Select
                                label="分類"
                                value={ncr.classification ?? ''}
                                onChange={(v) => updateNCR(ncr.id, { classification: (v || undefined) as NCRClassification | undefined })}
                                options={[
                                  { value: '', label: '—' },
                                  ...CLASSIFICATIONS.map((c) => ({ value: c, label: c })),
                                ]}
                              />
                              <PersonNameSelect
                                label="責任人"
                                value={ncr.responsiblePerson ?? ''}
                                onChange={(v) => updateNCR(ncr.id, { responsiblePerson: v })}
                                candidates={departmentMemberCandidates(
                                  state.people,
                                  state.activeCompanyId,
                                  ncr.departmentId,
                                  referenceDate,
                                )}
                              />
                              <Input label="到期日" type="date" value={ncr.dueDate ?? ''} onChange={(v) => updateNCR(ncr.id, { dueDate: v })} />
                              <Input label="矯正措施引用" value={ncr.correctiveActionReference ?? ''} onChange={(v) => updateNCR(ncr.id, { correctiveActionReference: v })} />
                              <Input label="效果確認引用" value={ncr.effectivenessReference ?? ''} onChange={(v) => updateNCR(ncr.id, { effectivenessReference: v })} />
                              <PersonNameSelect
                                label="效果確認人"
                                value={ncr.effectivenessVerifiedBy ?? ''}
                                onChange={(v) => updateNCR(ncr.id, { effectivenessVerifiedBy: v })}
                                candidates={verifierPeople}
                              />
                              <Input label="效果確認日" type="date" value={ncr.effectivenessVerifiedAt ?? ''} onChange={(v) => updateNCR(ncr.id, { effectivenessVerifiedAt: v })} />
                              <Input label="驗證佐證" value={ncr.verificationEvidence} onChange={(v) => updateNCR(ncr.id, { verificationEvidence: v })} />
                            </div>
                            <Button
                              variant="ghost"
                              icon={ACTION_ICONS.delete}
                              className="mt-3 text-red-700"
                              aria-label={`移至回收區：${displayNumber}`}
                              onClick={() => setDeleteTarget({ id: ncr.id, label: `${displayNumber} · ${ncr.department} · ${ncr.description}` })}
                            >移至回收區</Button>
                            </>}
                          </td>
                        </tr>
                    </Fragment>
                  )
                })}
              </tbody>
          </table>
        </ScrollRegion>
        <TablePagination pagination={pagination} label="不符合" />
          </>
        )}
      </div>
      <MoveToTrashDialog
        target={deleteTarget}
        onConfirm={() => {
          if (deleteTarget) moveNCRToTrash(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
