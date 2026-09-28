import { useCallback, useMemo, useState } from 'react'

import type { AuditStore } from '../hooks/useAuditStore'

import {

  calculateProcedurePriority,

  cycleFactorScale,

  factorKind,

  factorNames,

  formatFactorLabel,

  inherentScaleFromSeed,

  parseRiskInputValue,

} from '../lib/risk'

import type { ProcedurePriorityInput } from '../lib/risk'

import type { PlanRow, ProcedureRiskRecord } from '../types'

import { Badge, Button, Input } from './ui/Badge'

import { EmptyState } from './ui/EmptyState'

import { PrintDocHeader } from './ui/PrintDocHeader'

import { ScrollRegion } from './ui/ScrollRegion'

import { useTablePagination } from '../hooks/useTablePagination'

import { TablePagination } from './ui/TablePagination'



const FOCUS_RING =

  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'



const OPTIONAL_FACTORS: Array<keyof ProcedurePriorityInput> = [

  'previousInternalNcrCount',

  'previousThirdPartyNcrCount',

  'overdueOpenNcrCount',

  'customerComplaintLevel',

  'changeImpact',

  'monthsSinceLastAudit',

]



function rowKey(row: PlanRow): string {

  return `${row.qpCode}|${row.departmentId}`

}



function savedRecord(

  company: AuditStore['state']['company'],

  row: PlanRow,

): ProcedureRiskRecord | undefined {

  return company.procedureRisks?.find(

    (item) => item.qpCode === row.qpCode && item.departmentId === row.departmentId,

  )

}



function isPersisted(saved: ProcedureRiskRecord | undefined): boolean {

  return Boolean(saved && saved.inherentRisk >= 1 && saved.updatedAt)

}



type RowDraft = {

  inherentRisk: string

  evidenceReference: string

  optional: Partial<Record<keyof ProcedurePriorityInput, string>>

}



function draftFromSaved(row: PlanRow, saved?: ProcedureRiskRecord): RowDraft {

  const optional: Partial<Record<keyof ProcedurePriorityInput, string>> = {}

  for (const key of OPTIONAL_FACTORS) {

    const value = saved?.[key]

    optional[key] = value == null ? '' : String(value)

  }

  return {

    inherentRisk: saved ? String(saved.inherentRisk) : String(inherentScaleFromSeed(row.riskLevel)),

    evidenceReference: saved?.evidenceReference ?? '',

    optional,

  }

}



function draftToPatch(draft: RowDraft): Partial<ProcedureRiskRecord> | null {

  const inherent = parseRiskInputValue(draft.inherentRisk)

  if (inherent == null) return null

  const patch: Partial<ProcedureRiskRecord> = {

    inherentRisk: inherent,

    evidenceReference: draft.evidenceReference.trim(),

  }

  for (const key of OPTIONAL_FACTORS) {

    const raw = draft.optional[key]?.trim() ?? ''

    if (raw === '') {

      patch[key] = undefined

    } else {

      const parsed = parseRiskInputValue(raw)

      if (parsed == null) return null

      patch[key] = parsed

    }

  }

  return patch

}



export function RiskAssessment({ store }: { store: AuditStore }) {

  const { state, updateProcedureRisk } = store

  const { company, settings } = state

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})

  const [errors, setErrors] = useState<Record<string, string>>({})

  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({})



  const getDraft = useCallback(

    (row: PlanRow): RowDraft => {

      const key = rowKey(row)

      if (drafts[key]) return drafts[key]

      return draftFromSaved(row, savedRecord(company, row))

    },

    [company, drafts],

  )



  const setDraftField = (row: PlanRow, patch: Partial<RowDraft>) => {

    const key = rowKey(row)

    setDrafts((prev) => ({

      ...prev,

      [key]: { ...getDraft(row), ...patch },

    }))

    setErrors((prev) => {

      const next = { ...prev }

      delete next[key]

      return next

    })

  }



  const cycleFactor = (row: PlanRow, field: keyof ProcedurePriorityInput) => {

    const draft = getDraft(row)

    const saved = savedRecord(company, row)

    const currentRaw = field === 'inherentRisk'

      ? draft.inherentRisk

      : draft.optional[field] ?? ''

    const current = currentRaw === '' ? undefined : Number(currentRaw)

    const required = field === 'inherentRisk'

    const next = cycleFactorScale(field, current, required)

    if (field === 'inherentRisk') {

      setDraftField(row, { inherentRisk: next == null ? '' : String(next) })

    } else {

      setDraftField(row, {

        optional: { ...draft.optional, [field]: next == null ? '' : String(next) },

      })

    }

    if (saved && field !== 'inherentRisk') {

      const kind = factorKind(field)

      if (kind === 'band' || kind === 'months' || kind === 'count') {

        // keep draft only

      }

    }

  }



  const saveRow = (row: PlanRow) => {

    const key = rowKey(row)

    const patch = draftToPatch(getDraft(row))

    if (!patch) {

      setErrors((prev) => ({ ...prev, [key]: '固有風險須為 1 至 5；其餘因素若填寫亦須為 1 至 5。' }))

      return

    }

    updateProcedureRisk(row.qpCode, row.departmentId, patch)

    setDrafts((prev) => {

      const next = { ...prev }

      delete next[key]

      return next

    })

    setSavedFlash((prev) => ({ ...prev, [key]: true }))

    setTimeout(() => {

      setSavedFlash((prev) => {

        const next = { ...prev }

        delete next[key]

        return next

      })

    }, 2000)

  }



  const rows = useMemo(() => company.planRows, [company.planRows])

  const unsavedRiskRowCount = useMemo(
    () => rows.filter((row) => {
      const saved = savedRecord(company, row)
      const persisted = isPersisted(saved)
      const draft = drafts[rowKey(row)] ?? draftFromSaved(row, saved)
      if (!persisted) return true
      return JSON.stringify(draft) !== JSON.stringify(draftFromSaved(row, saved))
    }).length,
    [rows, company, drafts],
  )

  const pagination = useTablePagination(rows.length)




  return (

    <div className="space-y-6 print-area">

      <PrintDocHeader

        companyName={company.name}

        auditYear={settings.auditYear}

        formTitle="程序風險評估 QR-02-01"

      />

      {unsavedRiskRowCount > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 no-print" role="status">
          尚有 {unsavedRiskRowCount} 列方案風險未按「存檔」寫入；PDCA 就緒仍只計已存檔列。
        </p>
      )}

      <div>

        {rows.length === 0 ? (

          <EmptyState message="尚無年度計畫列。" />

        ) : (

          <ScrollRegion ariaLabel="程序風險評估一覽">

            <table className="worksheet-table min-w-[52rem]">

              <colgroup>

                <col className="col-code" />

                <col className="col-name" />

                <col className="col-inherent" />

                <col className="col-status" />

                <col className="col-status" />

                <col />

                <col className="col-action no-print" />

              </colgroup>

              <thead>

                <tr>

                  <th >QP</th>

                  <th >部門</th>

                  <th >固有風險</th>

                  <th >優先分</th>

                  <th >等級</th>

                  <th >證據引用</th>

                  <th className="no-print">操作</th>

                </tr>

              </thead>

              <tbody>

                {rows.map((row, rowIndex) => {

                  const key = rowKey(row)

                  const draft = getDraft(row)

                  const saved = savedRecord(company, row)

                  const persisted = isPersisted(saved)

                  const inherent = parseRiskInputValue(draft.inherentRisk)

                  const priorityInput: ProcedurePriorityInput = {

                    inherentRisk: inherent ?? inherentScaleFromSeed(row.riskLevel),

                  }

                  for (const factor of OPTIONAL_FACTORS) {

                    const raw = draft.optional[factor]?.trim()

                    if (raw) {

                      const parsed = parseRiskInputValue(raw)

                      if (parsed != null) priorityInput[factor] = parsed

                    }

                  }

                  const priority = calculateProcedurePriority(priorityInput)

                  const dirty = persisted

                    ? JSON.stringify(draft) !== JSON.stringify(draftFromSaved(row, saved))

                    : true



                  return (

                    <tr

                      key={key}

                      className={`${!pagination.isVisible(rowIndex) ? 'pagination-hidden-row ' : ''}${!persisted ? 'bg-amber-50/50' : ''}`}

                    >

                      <td className="font-medium text-slate-900">{row.qpCode}</td>

                      <td>{row.department}</td>

                      <td className="align-top">

                        <div className="flex flex-wrap items-center gap-2">

                          <button

                            type="button"

                            className={`min-h-9 w-fit shrink-0 whitespace-nowrap rounded border border-slate-300 px-2 text-xs font-medium no-print ${FOCUS_RING}`}

                            onClick={() => cycleFactor(row, 'inherentRisk')}

                            aria-label={`${row.qpCode} 固有風險`}

                          >

                            {formatFactorLabel('inherentRisk', inherent ?? undefined)}

                          </button>

                          <span className="print-only text-xs">{formatFactorLabel('inherentRisk', inherent ?? undefined)}</span>

                          <details className="no-print shrink-0">

                            <summary className="cursor-pointer whitespace-nowrap text-sm text-blue-800">其他因素（可暫定）</summary>

                            <ul className="mt-1 space-y-1 text-xs">

                              {OPTIONAL_FACTORS.map((field) => (

                                <li key={field} className="flex flex-wrap items-center gap-2">

                                  <span className="min-w-[8rem] text-slate-600">{factorNames[field]}</span>

                                  <button

                                    type="button"

                                    className={`rounded border border-slate-300 px-1.5 py-0.5 ${FOCUS_RING}`}

                                    onClick={() => cycleFactor(row, field)}

                                  >

                                    {formatFactorLabel(field, parseRiskInputValue(draft.optional[field] ?? '') ?? undefined)}

                                  </button>

                                </li>

                              ))}

                            </ul>

                          </details>

                        </div>

                      </td>

                      <td className="align-top font-semibold">

                        {priority.score}

                        {priority.provisional && (

                          <span className="ml-1.5 font-normal text-slate-500">暫定</span>

                        )}

                      </td>

                      <td className="align-top">

                        <Badge label={priority.level} />

                      </td>

                      <td className="align-top">

                        <Input

                          value={draft.evidenceReference}

                          onChange={(value) => setDraftField(row, { evidenceReference: value })}

                          className="no-print min-w-[8rem]"

                          ariaLabel={`${row.qpCode} 證據引用`}

                        />

                        <span className="print-only text-xs">{draft.evidenceReference || '—'}</span>

                      </td>

                      <td className="align-top no-print">

                        {errors[key] && (

                          <p className="mb-1 text-xs font-medium text-red-700" role="alert">{errors[key]}</p>

                        )}

                        <Button

                          variant="secondary"

                          onClick={() => saveRow(row)}

                          disabled={!dirty && persisted}

                        >

                          {savedFlash[key] ? '已存檔' : '存檔'}

                        </Button>

                      </td>

                    </tr>

                  )

                })}

              </tbody>

            </table>

          </ScrollRegion>

        )}

        <TablePagination pagination={pagination} label="方案風險" />

      </div>

    </div>

  )

}


