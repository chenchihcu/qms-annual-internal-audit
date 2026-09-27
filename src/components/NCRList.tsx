import { Fragment, useEffect, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { FOCUS_RING } from '../lib/focusRing'
import { isNcrStale, ncrNumberLabels } from '../lib/ncr'
import { planRowSelectOptions } from '../lib/planRowOptions'
import { ACTION_ICONS } from '../lib/uiIcons'
import type { NCRClassification, NCRStatus } from '../types'
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
  const [expandedState, setExpandedState] = useState<{ highlightRecordId?: string; id: string | null }>(() => ({
    highlightRecordId,
    id: highlightRecordId ?? null,
  }))
  if (expandedState.highlightRecordId !== highlightRecordId) {
    setExpandedState({ highlightRecordId, id: highlightRecordId ?? null })
  }
  const expandedId = expandedState.highlightRecordId === highlightRecordId
    ? expandedState.id
    : highlightRecordId ?? null
  const setExpandedId = (id: string | null) => setExpandedState({ highlightRecordId, id })
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
          actions={(
            <Button
              variant="secondary"
              icon={showForm ? undefined : ACTION_ICONS.add}
              onClick={() => setShowForm((value) => !value)}
            >
              {showForm ? '收起登錄' : '手動新增 NCR'}
            </Button>
          )}
        />

        {showForm && (
          <div className="mb-6 no-print">
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
              <div className="flex items-end">
                <Button onClick={handleAddNcr} disabled={!newNcr.description.trim()}>
                  新增 NCR
                </Button>
              </div>
            </div>
          </div>
        )}

        {company.ncrs.length === 0 ? (
          <EmptyState message="目前無不符合事項" />
        ) : (
          <>
          <ScrollRegion ariaLabel="不符合事項清單">
            <table className="qr-checklist w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page text-left text-muted">
                  <th className="border border-line p-2">NCR#</th>
                  <th className="border border-line p-2">QP</th>
                  <th className="border border-line p-2">部門</th>
                  <th className="border border-line p-2">描述</th>
                  <th className="border border-line p-2">日期</th>
                  <th className="border border-line p-2">狀態</th>
                  <th className="border border-line p-2 no-print">操作</th>
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
                        className={`${!pagination.isVisible(index) ? 'pagination-hidden-row ' : ''}${stale ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                      >
                        <td className="border border-line p-2 font-mono text-xs">{displayNumber}</td>
                        <td className="border border-line p-2">{ncr.qpCode}</td>
                        <td className="border border-line p-2">{ncr.department}</td>
                        <td className="border border-line p-2">
                          {stale && (
                            <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              查檢已非不符，建議結案
                            </p>
                          )}
                          <textarea
                            className={`w-full min-w-[200px] rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                            rows={2}
                            value={ncr.description}
                            onChange={(e) => updateNCR(ncr.id, { description: e.target.value })}
                            aria-label={`${displayNumber} 描述`}
                          />
                          <span className="print-only">{ncr.description}</span>
                        </td>
                        <td className="border border-line p-2">
                          <input
                            type="date"
                            className={`rounded border border-line bg-surface px-1 no-print ${FOCUS_RING}`}
                            value={ncr.date}
                            onChange={(e) => updateNCR(ncr.id, { date: e.target.value })}
                            aria-label={`${displayNumber} 日期`}
                          />
                          <span className="print-only">{ncr.date}</span>
                        </td>
                        <td className="border border-line p-2">
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
                        <td className="border border-line p-2 no-print">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className={`text-xs text-link hover:underline ${FOCUS_RING}`}
                              onClick={() => setExpandedId(expanded ? null : ncr.id)}
                            >
                              {expanded ? '收合' : '展開'}
                            </button>
                            <Button
                              variant="ghost"
                              icon={ACTION_ICONS.delete}
                              className="text-red-700"
                              aria-label={`移至回收區：${displayNumber}`}
                              onClick={() => setDeleteTarget({ id: ncr.id, label: `${displayNumber} · ${ncr.department} · ${ncr.description}` })}
                            >
                              移至回收區
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${ncr.id}-detail`} className={`${!pagination.isVisible(index) ? 'pagination-hidden-row ' : ''}no-print bg-slate-50/80`}>
                          <td colSpan={8} className="border border-line p-4">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                          </td>
                        </tr>
                      )}
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
