import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AuditStore } from '../hooks/useAuditStore'

import { useInlineFormFocus } from '../hooks/useInlineFormFocus'

import { useRecordDisclosure } from '../hooks/useRecordDisclosure'

import { FOCUS_RING } from '../lib/focusRing'

import { resolveFollowupRecordLink } from '../lib/followupRecordLink'

import {

  canTransitionNcrStatus,

  cloneNcrDraft,

  isNcrStale,

  ncrDraftEquals,

  ncrNumberLabels,

  ncrReportProgress,

} from '../lib/ncr'

import { planRowSelectOptions } from '../lib/planRowOptions'

import { ACTION_ICONS } from '../lib/uiIcons'

import { ncrCompanyScopeLabel } from '../lib/certificateScope'

import type { NCR } from '../types'

import { Badge, Button, Input, Select } from './ui/Badge'

import { EmptyState } from './ui/EmptyState'

import { PrintDocHeader } from './ui/PrintDocHeader'

import { ScrollRegion } from './ui/ScrollRegion'

import { MoveToTrashDialog, type TrashDeleteTarget } from './ui/MoveToTrashDialog'

import { useTablePagination } from '../hooks/useTablePagination'

import { TablePagination } from './ui/TablePagination'

import { FollowupRecordLinkNotice } from './ui/FollowupRecordLinkNotice'

import { NcrCorrectiveReport } from './NcrCorrectiveReport'

import { NcrReportProgressBar } from './NcrReportProgressBar'

import {

  useNcrUnsavedGuardActions,

  useNcrUnsavedGuardRegistration,

} from '../context/NcrUnsavedGuardContext'



export function NCRList({

  store,

  highlightRecordId,

}: {

  store: AuditStore

  highlightRecordId?: string

}) {

  const { state, updateNCR, addManualNCR, moveNCRToTrash } = store

  const { company, settings } = state

  const { confirmIfUnsaved } = useNcrUnsavedGuardActions()



  const [showForm, setShowForm] = useState(false)

  const { triggerRef, formRef } = useInlineFormFocus(showForm)

  const [expandedId, setExpandedIdRaw] = useRecordDisclosure(

    `${WORKSPACE_COMPANY_ID}:${settings.auditYear}`,

    highlightRecordId,

  )

  const [draft, setDraft] = useState<NCR | null>(null)

  const [saveError, setSaveError] = useState<string | undefined>()

  const [newNcr, setNewNcr] = useState({

    qpCode: company.planRows[0]?.qpCode ?? 'QP-01',

    departmentId: company.planRows[0]?.departmentId ?? '',

    description: '',

  })

  const [descriptionError, setDescriptionError] = useState<string | undefined>()

  const [deleteTarget, setDeleteTarget] = useState<TrashDeleteTarget | null>(null)



  const savedNcr = expandedId ? company.ncrs.find((n) => n.id === expandedId) : undefined

  const hasUnsaved = Boolean(draft && savedNcr && !ncrDraftEquals(draft, savedNcr))



  useNcrUnsavedGuardRegistration(useCallback(() => hasUnsaved, [hasUnsaved]))



  useEffect(() => {

    const onBeforeUnload = (event: BeforeUnloadEvent) => {

      if (!hasUnsaved) return

      event.preventDefault()

    }

    window.addEventListener('beforeunload', onBeforeUnload)

    return () => window.removeEventListener('beforeunload', onBeforeUnload)

  }, [hasUnsaved])



  const [draftRecordId, setDraftRecordId] = useState<string | null>(null)

  if (draftRecordId !== expandedId) {
    setDraftRecordId(expandedId)
    setDraft(savedNcr ? cloneNcrDraft(savedNcr) : null)
    setSaveError(undefined)
  }

  const setExpandedId = useCallback(

    (next: string | null) => {

      if (next === expandedId) {

        if (next !== null && !confirmIfUnsaved()) return

        setExpandedIdRaw(null)

        return

      }

      if (expandedId && !confirmIfUnsaved()) return

      setExpandedIdRaw(next)

    },

    [confirmIfUnsaved, expandedId, setExpandedIdRaw],

  )



  const highlightIndex = highlightRecordId

    ? company.ncrs.findIndex((ncr) => ncr.id === highlightRecordId)

    : -1

  const recordLinkResult = useMemo(

    () => (highlightRecordId ? resolveFollowupRecordLink(state, highlightRecordId, 'ncr') : null),

    [state, highlightRecordId],

  )

  const showRecordLinkNotice = Boolean(

    highlightRecordId && highlightIndex < 0 && recordLinkResult && recordLinkResult.status !== 'found',

  )

  const displayNumbers = ncrNumberLabels(company.ncrs)

  const pagination = useTablePagination(

    company.ncrs.length,

    10,

    highlightRecordId && highlightIndex >= 0 ? { key: highlightRecordId, index: highlightIndex } : undefined,

    String(settings.auditYear),

  )



  const planRowOptions = planRowSelectOptions(company.planRows)



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



  const patchDraft = (patch: Partial<NCR>) => {

    setDraft((current) => (current ? { ...current, ...patch } : current))

    setSaveError(undefined)

  }



  const handleSaveReport = () => {

    if (!draft) return

    const gate = canTransitionNcrStatus(draft, draft.status)

    if (draft.status === '結案' && !gate.ok) {

      setSaveError(`結案須填：${gate.missing?.join('、') ?? '必要欄位'}`)

      return

    }

    const result = updateNCR(draft.id, {

      date: draft.date,

      dueDate: draft.dueDate,

      description: draft.description,

      process: draft.process,

      rootCause: draft.rootCause,

      correctiveAction: draft.correctiveAction,

      correctiveActionReference: draft.correctiveActionReference,

      verificationEvidence: draft.verificationEvidence,

      effectivenessReference: draft.effectivenessReference,

      effectivenessVerifiedBy: draft.effectivenessVerifiedBy,

      effectivenessVerifiedAt: draft.effectivenessVerifiedAt,

      responsiblePerson: draft.responsiblePerson,

      status: draft.status,

      containment: draft.containment,

      classification: draft.classification,

    })

    if (!result.ok) {

      setSaveError(`結案須填：${result.missing?.join('、') ?? '必要欄位'}`)

      return

    }

    setSaveError(undefined)

  }



  const expandedDisplayNumber = expandedId

    ? displayNumbers.get(expandedId) ?? company.ncrs.find((n) => n.id === expandedId)?.ncrNumber

    : undefined



  return (

    <div className="space-y-6">

      <div className={expandedId ? 'no-print space-y-6' : 'print-area qr-form space-y-6'}>

        <PrintDocHeader

          companyName={company.name}

          auditYear={settings.auditYear}

          formTitle="不符合事項清單 QR-28-03"

        />



        {showRecordLinkNotice && recordLinkResult && <FollowupRecordLinkNotice result={recordLinkResult} />}



        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">

          <h3 className="text-sm font-semibold">不符合事項一覽（{company.ncrs.length}）</h3>

          {!showForm && (

            <Button

              ref={triggerRef}

              variant="secondary"

              icon={ACTION_ICONS.add}

              className="no-print"

              onClick={() => setShowForm(true)}

            >

              手動新增 NCR

            </Button>

          )}

        </div>



        {showForm && (

          <div ref={formRef} className="mb-6 no-print">

            <p className="mb-3 text-sm text-muted">

              查檢表判定「不符」時自動匯入。描述為發現文字，不會被查檢覆寫；矯正內容請填 QR-28-03 報告。此處可登錄會議或現場發現。

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



        {company.ncrs.length === 0 ? (

          <EmptyState message="目前無不符合事項" />

        ) : (

          <>

            <ScrollRegion ariaLabel="不符合事項一覽">

              <table className="worksheet-table min-w-[68rem]">

                <colgroup>

                  <col className="col-code" />

                  <col className="col-code" />

                  <col className="col-name" />

                  <col className="col-status" />

                  <col />

                  <col className="col-status" />

                  <col style={{ width: '11rem' }} />

                  <col className="col-date" />

                  <col className="col-date" />

                  <col className="col-action no-print" />

                </colgroup>

                <thead>

                  <tr>

                    <th>NCR#</th>

                    <th>QP</th>

                    <th>部門</th>

                    <th>公司</th>

                    <th>摘要</th>

                    <th>狀態</th>

                    <th className="no-print">進度</th>

                    <th>日期</th>

                    <th>到期</th>

                    <th className="no-print">操作</th>

                  </tr>

                </thead>

                <tbody>

                  {company.ncrs.map((ncr, index) => {

                    const stale = isNcrStale(ncr, company.audits)

                    const expanded = expandedId === ncr.id

                    const displayNumber = displayNumbers.get(ncr.id) ?? ncr.ncrNumber

                    const progress = ncrReportProgress(ncr)

                    return (

                      <tr

                        key={ncr.id}

                        id={`ncr-${ncr.id}`}

                        data-ncr-id={ncr.id}

                        className={`${!pagination.isVisible(index) ? 'pagination-hidden-row ' : ''}${stale ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}${expanded ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}

                      >

                        <td className="font-mono">{displayNumber}</td>

                        <td>{ncr.qpCode}</td>

                        <td className="break-words">{ncr.department}</td>

                        <td className="break-words">{ncrCompanyScopeLabel(ncr.companyScope) || '—'}</td>

                        <td className="break-words">

                          {stale && (

                            <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">

                              查檢已非不符，建議結案

                            </p>

                          )}

                          <span className="line-clamp-3">{ncr.description}</span>

                          <span className="print-only">{ncr.description}</span>

                        </td>

                        <td>

                          <Badge label={ncr.status} />

                        </td>

                        <td className="no-print">

                          <NcrReportProgressBar stages={progress} compact />

                        </td>

                        <td>{ncr.date || '—'}</td>

                        <td>{ncr.dueDate || '—'}</td>

                        <td className="no-print">

                          <button

                            type="button"

                            className={`min-h-11 text-sm text-link hover:underline ${FOCUS_RING}`}

                            aria-label={`${displayNumber} QR-28-03 報告`}

                            aria-expanded={expanded}

                            onClick={() => setExpandedId(expanded ? null : ncr.id)}

                          >

                            {expanded ? '收合' : '報告'}

                          </button>

                        </td>

                      </tr>

                    )

                  })}

                </tbody>

              </table>

            </ScrollRegion>

            <TablePagination pagination={pagination} label="不符合" />

          </>

        )}

      </div>



      {expandedId && draft && savedNcr && expandedDisplayNumber && (

        <NcrCorrectiveReport

          state={state}

          ncr={savedNcr}

          displayNumber={expandedDisplayNumber}

          draft={draft}

          onDraftChange={patchDraft}

          saveError={saveError}

          onSave={handleSaveReport}

          onVoid={() =>

            setDeleteTarget({

              id: draft.id,

              label: `${expandedDisplayNumber} · ${draft.department} · ${draft.description}`,

            })

          }

          onClose={() => setExpandedId(null)}

        />

      )}



      <MoveToTrashDialog

        target={deleteTarget}

        title="作廢此 NCR？"

        confirmLabel="作廢"

        descriptionSuffix="NCR 將移入回收區；可在系統設定還原。"

        onConfirm={() => {
          if (deleteTarget) {
            moveNCRToTrash(deleteTarget.id)
            setExpandedIdRaw(null)
            setDraft(null)
          }
          setDeleteTarget(null)
        }}

        onCancel={() => setDeleteTarget(null)}

      />

    </div>

  )

}
