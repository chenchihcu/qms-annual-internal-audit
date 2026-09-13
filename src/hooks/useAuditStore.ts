import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppState,
  AuditSettings,
  ChecklistItem,
  CompanyData,
  CompanyId,
  NCR,
  Observation,
  PlanRow,
  ExternalAuditPrepItemState,
  ProcedureAudit,
  ThirdPartySuggestion,
} from '../types'
import { createDemoState, migrateToV4, migrateV1State, STORAGE_KEY } from '../data/demoData'
import { migrateState } from '../lib/migrate'
import { autoArrangePlan } from '../lib/planner'
import {
  auditIdForPlanRow,
  shouldPropagateAuditAuditorsToPlan,
  shouldPropagatePlanAuditorsToAudit,
} from '../lib/auditorSync'
import { carryPlanDatesToAudit } from '../lib/auditDates'
import {
  canTransitionNcrStatus,
  collectNCRsFromAudits,
  ensureNcrFromObservation,
  generateNCRNumber,
} from '../lib/ncr'
import { createChecklistForProcedure, getProcedureTitle } from '../data/checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { MonthStatus } from '../types'
import { loadStateFromStorage, saveStateToStorage } from '../lib/storage'
import { applyAuditYearChange } from '../lib/settingsYear'
import { parseImportJSON } from '../lib/importSummary'

function patchCompany(
  state: AppState,
  companyId: CompanyId,
  patch: Partial<CompanyData>,
): AppState {
  return {
    ...state,
    companies: {
      ...state.companies,
      [companyId]: { ...state.companies[companyId], ...patch },
    },
  }
}

export interface UpdateSettingsOptions {
  resetExternalPrep?: boolean
}

export function useAuditStore() {
  const initial = loadStateFromStorage()
  const [state, setState] = useState<AppState>(initial.state)
  const [loadWarning] = useState<string | undefined>(initial.warning)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const result = saveStateToStorage(state)
    if (result.ok) {
      setLastSavedAt(new Date())
      setSaveError(null)
    } else {
      setSaveError(result.error ?? '儲存失敗')
    }
  }, [state])

  const activeCompany = state.companies[state.activeCompanyId]

  const updateSettings = useCallback(
    (patch: Partial<AuditSettings>, options?: UpdateSettingsOptions) => {
      setState((s) => {
        if (patch.auditYear !== undefined && patch.auditYear !== s.settings.auditYear) {
          return applyAuditYearChange(s, patch.auditYear, options?.resetExternalPrep ?? false)
        }
        return { ...s, settings: { ...s.settings, ...patch } }
      })
    },
    [],
  )

  const switchCompany = useCallback((companyId: CompanyId) => {
    setState((s) => ({ ...s, activeCompanyId: companyId }))
  }, [])

  const updateDepartment = useCallback(
    (id: string, patch: Partial<CompanyData['departments'][0]>) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        return patchCompany(s, s.activeCompanyId, {
          departments: co.departments.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })
      })
    },
    [],
  )

  const regeneratePlan = useCallback(() => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const openCount =
        co.observations.filter((o) => o.status === 'open').length +
        co.suggestions.filter((sg) => sg.status === 'open').length +
        co.ncrs.filter((n) => n.status !== '結案').length
      const planRows = autoArrangePlan(
        {
          departments: co.departments,
          planEntries: PROCEDURE_PLAN_TEMPLATE,
          auditYear: s.settings.auditYear,
          planWindowStart: s.settings.planWindowStart,
          planWindowEnd: s.settings.planWindowEnd,
          managementReviewDate: s.settings.managementReviewDate,
          existingRows: co.planRows,
          openCarryForwardCount: openCount,
        },
        { leadAuditor: s.settings.leadAuditor },
      )
      return patchCompany(s, s.activeCompanyId, { planRows })
    })
  }, [])

  const updatePlanRow = useCallback((id: string, patch: Partial<PlanRow>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const row = co.planRows.find((r) => r.id === id)
      if (!row) return s

      let audits = co.audits
      if (patch.auditors !== undefined && patch.auditors !== row.auditors) {
        const auditId = auditIdForPlanRow(row.qpCode, row.departmentId)
        const audit = co.audits.find((a) => a.id === auditId)
        if (
          audit &&
          shouldPropagatePlanAuditorsToAudit(row.auditors, patch.auditors, audit.auditors)
        ) {
          audits = co.audits.map((a) =>
            a.id === auditId ? { ...a, auditors: patch.auditors! } : a,
          )
        }
      }

      return patchCompany(s, s.activeCompanyId, {
        planRows: co.planRows.map((r) =>
          r.id === id ? { ...r, ...patch, manualOverride: true } : r,
        ),
        audits,
      })
    })
  }, [])

  const setPlanMonthStatus = useCallback((rowId: string, monthIndex: number, status: MonthStatus) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
        planRows: co.planRows.map((r) => {
          if (r.id !== rowId) return r
          const manualMonthOverrides = [...(r.manualMonthOverrides ?? Array(12).fill(null))] as (
            | MonthStatus
            | null
          )[]
          manualMonthOverrides[monthIndex] = status
          const months = [...r.months] as MonthStatus[]
          if (status === null) {
            months[monthIndex] = null
          } else if (!months[monthIndex]) {
            months[monthIndex] = '擬定'
          }
          return { ...r, months, manualMonthOverrides, manualOverride: true }
        }),
      })
    })
  }, [])

  const getOrCreateAudit = useCallback(
    (qpCode: string, departmentId: string): ProcedureAudit => {
      const co = activeCompany
      const auditId = `audit-${qpCode}-${departmentId}`
      const existing = co.audits.find((a) => a.id === auditId)
      if (existing) return existing

      const planRow = co.planRows.find(
        (r) => r.qpCode === qpCode && r.departmentId === departmentId,
      )
      const dept = co.departments.find((d) => d.id === departmentId)
      const entry = PROCEDURE_PLAN_TEMPLATE.find(
        (e) => e.qpCode === qpCode && e.departmentId === departmentId,
      ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === qpCode)
      const auditors = planRow?.auditors ?? dept?.defaultAuditors ?? ''
      const base: ProcedureAudit = {
        id: auditId,
        qpCode,
        departmentId,
        department: dept?.name ?? departmentId,
        process: entry?.process ?? qpCode,
        documents: entry?.documents ?? qpCode,
        notifyDate: '',
        auditDate: '',
        departmentManager: dept?.owner ?? '',
        auditors,
        auditCategory: entry?.auditCategory ?? '系統稽核',
        items: createChecklistForProcedure(qpCode, dept?.name),
      }
      return planRow
        ? carryPlanDatesToAudit(planRow, base, state.settings.auditYear)
        : base
    },
    [activeCompany, state.settings.auditYear],
  )

  const persistAudit = useCallback(
    (s: AppState, audits: ProcedureAudit[], companyId: CompanyId) => {
      const co = s.companies[companyId]
      const ncrs = collectNCRsFromAudits(audits, s.settings.auditYear, co.ncrs)
      return patchCompany(s, companyId, { audits, ncrs })
    },
    [],
  )

  const updateAudit = useCallback((audit: ProcedureAudit) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const existing = co.audits.find((a) => a.id === audit.id)
      const exists = existing !== undefined
      const audits = exists
        ? co.audits.map((a) => (a.id === audit.id ? audit : a))
        : [...co.audits, audit]

      let planRows = co.planRows
      if (existing && audit.auditors !== existing.auditors) {
        planRows = co.planRows.map((row) => {
          if (row.qpCode !== audit.qpCode || row.departmentId !== audit.departmentId) return row
          if (
            shouldPropagateAuditAuditorsToPlan(existing.auditors, audit.auditors, row.auditors)
          ) {
            return { ...row, auditors: audit.auditors }
          }
          return row
        })
      }

      const next = persistAudit(s, audits, s.activeCompanyId)
      return patchCompany(next, s.activeCompanyId, { planRows })
    })
  }, [persistAudit])

  const updateChecklistItem = useCallback(
    (auditId: string, itemId: string, patch: Partial<ChecklistItem>) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const audits = co.audits.map((a) => {
          if (a.id !== auditId) return a
          return {
            ...a,
            items: a.items.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          }
        })
        return persistAudit(s, audits, s.activeCompanyId)
      })
    },
    [persistAudit],
  )

  const addChecklistItem = useCallback((auditId: string) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const audits = co.audits.map((a) => {
        if (a.id !== auditId) return a
        const nextNo = a.items.length + 1
        return {
          ...a,
          items: [
            ...a.items,
            {
              id: `chk-${Date.now()}`,
              category: '自訂',
              no: nextNo,
              content: '',
              judgment: null,
              description: '',
              procedureRef: a.qpCode,
              origin: 'custom' as const,
            },
          ],
        }
      })
      return patchCompany(s, s.activeCompanyId, { audits })
    })
  }, [])

  const removeChecklistItem = useCallback((auditId: string, itemId: string) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const audits = co.audits.map((a) => {
        if (a.id !== auditId) return a
        const items = a.items
          .filter((i) => i.id !== itemId)
          .map((item, idx) => ({ ...item, no: idx + 1 }))
        return { ...a, items }
      })
      return persistAudit(s, audits, s.activeCompanyId)
    })
  }, [persistAudit])

  const markChecklistItemNA = useCallback((auditId: string, itemId: string) => {
    updateChecklistItem(auditId, itemId, { judgment: '不適用' })
  }, [updateChecklistItem])

  const setRemainingUnjudgedToConform = useCallback((auditId: string) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const audits = co.audits.map((a) => {
        if (a.id !== auditId) return a
        return {
          ...a,
          items: a.items.map((item) =>
            item.judgment === null || item.judgment === undefined
              ? { ...item, judgment: '符合' as const }
              : item,
          ),
        }
      })
      return persistAudit(s, audits, s.activeCompanyId)
    })
  }, [persistAudit])

  const updateNCR = useCallback((id: string, patch: Partial<NCR>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const current = co.ncrs.find((n) => n.id === id)
      if (!current) return s

      const merged = { ...current, ...patch }
      if (patch.status && patch.status !== current.status) {
        const gate = canTransitionNcrStatus(merged, patch.status)
        if (!gate.ok) {
          return s
        }
      }

      return patchCompany(s, s.activeCompanyId, {
        ncrs: co.ncrs.map((n) => (n.id === id ? merged : n)),
      })
    })
  }, [])

  const addManualNCR = useCallback(
    (input: {
      qpCode: string
      departmentId: string
      description: string
      process?: string
    }) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const dept = co.departments.find((d) => d.id === input.departmentId)
        const entry = PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === input.qpCode && e.departmentId === input.departmentId,
        )
        const ncr: NCR = {
          id: `ncr-manual-${Date.now()}`,
          ncrNumber: generateNCRNumber(s.settings.auditYear, co.ncrs.length + 1),
          qpCode: input.qpCode,
          departmentId: input.departmentId,
          department: dept?.name ?? input.departmentId,
          process: input.process ?? entry?.process ?? input.qpCode,
          description: input.description,
          date: new Date().toISOString().slice(0, 10),
          status: '開立',
          rootCause: '',
          correctiveAction: '',
          verificationEvidence: '',
        }
        return { ...patchCompany(s, s.activeCompanyId, { ncrs: [...co.ncrs, ncr] }), dataSource: 'user' as const }
      })
    },
    [],
  )

  const updateObservation = useCallback((id: string, patch: Partial<Observation>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const obs = co.observations.find((o) => o.id === id)
      if (!obs) return s

      let ncrs = co.ncrs
      let ncrId = obs.ncrId
      const nextStatus = patch.status ?? obs.status

      if (nextStatus === 'became_ncr') {
        const result = ensureNcrFromObservation({ ...obs, ...patch }, ncrs, s.settings.auditYear)
        ncrs = result.ncrs
        ncrId = result.ncrId
      }

      return patchCompany(s, s.activeCompanyId, {
        observations: co.observations.map((o) =>
          o.id === id ? { ...o, ...patch, ncrId: ncrId ?? o.ncrId } : o,
        ),
        ncrs,
      })
    })
  }, [])

  const addObservation = useCallback(
    (input: {
      qpCode: string
      departmentId: string
      content: string
      description?: string
    }) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const dept = co.departments.find((d) => d.id === input.departmentId)
        const entry = PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === input.qpCode && e.departmentId === input.departmentId,
        )
        const obs: Observation = {
          id: `obs-${Date.now()}`,
          year: s.settings.auditYear,
          qpCode: input.qpCode,
          departmentId: input.departmentId,
          department: dept?.name ?? input.departmentId,
          process: entry?.process ?? input.qpCode,
          content: input.content,
          description: input.description ?? '',
          status: 'open',
        }
        return patchCompany(s, s.activeCompanyId, {
          observations: [...co.observations, obs],
        })
      })
    },
    [],
  )

  const updateSuggestion = useCallback((id: string, patch: Partial<ThirdPartySuggestion>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
        suggestions: co.suggestions.map((sg) => (sg.id === id ? { ...sg, ...patch } : sg)),
      })
    })
  }, [])

  const addSuggestion = useCallback(
    (input: {
      procedure: string
      issue: string
      progress?: string
      responsibleUnit: string
    }) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const sug: ThirdPartySuggestion = {
          id: `sug-${Date.now()}`,
          year: s.settings.auditYear,
          procedure: input.procedure,
          issue: input.issue,
          progress: input.progress ?? '',
          responsibleUnit: input.responsibleUnit,
          status: 'open',
        }
        return patchCompany(s, s.activeCompanyId, {
          suggestions: [...co.suggestions, sug],
        })
      })
    },
    [],
  )

  const updateExternalPrepItem = useCallback(
    (id: string, patch: Partial<ExternalAuditPrepItemState>) => {
      setState((s) => ({
        ...s,
        externalAuditPrep: {
          ...s.externalAuditPrep,
          items: s.externalAuditPrep.items.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        },
      }))
    },
    [],
  )

  const updateExternalPrepSequence = useCallback(
    (
      patch: Partial<
        Pick<
          AppState['externalAuditPrep'],
          'internalAuditCompleteOverride' | 'managementReviewComplete'
        >
      >,
    ) => {
      setState((s) => ({
        ...s,
        externalAuditPrep: { ...s.externalAuditPrep, ...patch },
      }))
    },
    [],
  )

  const resetInternalAuditCompleteOverride = useCallback(() => {
    setState((s) => {
      const { internalAuditCompleteOverride: _o, internalAuditComplete: _l, ...rest } =
        s.externalAuditPrep
      return {
        ...s,
        externalAuditPrep: rest,
      }
    })
  }, [])

  const carryForwardObservation = useCallback(
    (obsId: string, qpCode: string, departmentId: string) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const obs = co.observations.find((o) => o.id === obsId)
        if (!obs || obs.carriedToYear) return s

        const auditId = `audit-${qpCode}-${departmentId}`
        let audit = co.audits.find((a) => a.id === auditId)
        const dept = co.departments.find((d) => d.id === departmentId)
        const entry = PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === qpCode && e.departmentId === departmentId,
        )
        if (!dept || !entry) return s

        if (!audit) {
          audit = {
            id: auditId,
            qpCode,
            departmentId,
            department: dept.name,
            process: entry.process,
            documents: entry.documents,
            notifyDate: '',
            auditDate: '',
            departmentManager: dept.owner,
            auditors: dept.defaultAuditors,
            auditCategory: entry.auditCategory,
            items: createChecklistForProcedure(qpCode, dept.name),
          }
        }

        const newItemId = `chk-cf-${Date.now()}`
        const newItem: ChecklistItem = {
          id: newItemId,
          category: '跨年追蹤',
          no: audit.items.length + 1,
          content: `[${obs.year}年觀察事項] ${obs.content}`,
          judgment: null,
          description: obs.description,
          sourceYear: obs.year,
          carriedFromId: obs.id,
          procedureRef: qpCode,
          origin: 'carryforward',
        }

        const audits = co.audits.some((a) => a.id === audit!.id)
          ? co.audits.map((a) =>
              a.id === audit!.id ? { ...a, items: [...a.items, newItem] } : a,
            )
          : [...co.audits, { ...audit, items: [...audit.items, newItem] }]

        const observations = co.observations.map((o) =>
          o.id === obsId
            ? { ...o, carriedToYear: s.settings.auditYear, carriedToChecklistId: newItemId }
            : o,
        )

        return patchCompany(s, s.activeCompanyId, { audits, observations })
      })
    },
    [],
  )

  const carryForwardNCR = useCallback((ncrId: string, qpCode: string, departmentId: string) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const ncr = co.ncrs.find((n) => n.id === ncrId)
      if (!ncr || ncr.status === '結案' || ncr.carriedToYear) return s

      const auditId = `audit-${qpCode}-${departmentId}`
      let audit = co.audits.find((a) => a.id === auditId)
      const dept = co.departments.find((d) => d.id === departmentId)
      const entry = PROCEDURE_PLAN_TEMPLATE.find(
        (e) => e.qpCode === qpCode && e.departmentId === departmentId,
      ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === qpCode)
      if (!dept || !entry) return s

      if (!audit) {
        audit = {
          id: auditId,
          qpCode,
          departmentId,
          department: dept.name,
          process: entry.process,
          documents: entry.documents,
          notifyDate: '',
          auditDate: '',
          departmentManager: dept.owner,
          auditors: dept.defaultAuditors,
          auditCategory: entry.auditCategory,
          items: createChecklistForProcedure(qpCode, dept.name),
        }
      }

      const newItemId = `chk-ncr-cf-${Date.now()}`
      const year = ncr.sourceYear ?? s.settings.auditYear - 1
      const newItem: ChecklistItem = {
        id: newItemId,
        category: '跨年追蹤',
        no: audit.items.length + 1,
        content: `[${year}年 NCR ${ncr.ncrNumber}] ${ncr.description}`,
        judgment: null,
        description: '前年度未結案不符合追蹤',
        sourceYear: year,
        procedureRef: qpCode,
        origin: 'carryforward',
      }

      const audits = co.audits.some((a) => a.id === audit!.id)
        ? co.audits.map((a) =>
            a.id === audit!.id ? { ...a, items: [...a.items, newItem] } : a,
          )
        : [...co.audits, { ...audit, items: [...audit.items, newItem] }]

      const ncrs = co.ncrs.map((n) =>
        n.id === ncrId ? { ...n, carriedToYear: s.settings.auditYear } : n,
      )

      return patchCompany(s, s.activeCompanyId, { audits, ncrs })
    })
  }, [])

  const carryForwardSuggestion = useCallback(
    (sugId: string, qpCode: string, departmentId: string) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const sug = co.suggestions.find((sg) => sg.id === sugId)
        if (!sug || sug.status === 'closed') return s

        const auditId = `audit-${qpCode}-${departmentId}`
        let audit = co.audits.find((a) => a.id === auditId)
        const dept = co.departments.find((d) => d.id === departmentId)
        const entry = PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === qpCode && e.departmentId === departmentId,
        )
        if (!dept || !entry) return s

        if (!audit) {
          audit = {
            id: auditId,
            qpCode,
            departmentId,
            department: dept.name,
            process: entry.process,
            documents: entry.documents,
            notifyDate: '',
            auditDate: '',
            departmentManager: dept.owner,
            auditors: dept.defaultAuditors,
            auditCategory: entry.auditCategory,
            items: createChecklistForProcedure(qpCode, dept.name),
          }
        }

        const newItemId = `chk-sug-cf-${Date.now()}`
        const newItem: ChecklistItem = {
          id: newItemId,
          category: '第三方建議',
          no: audit.items.length + 1,
          content: `[${sug.year}年第三方建議] ${sug.issue}`,
          judgment: null,
          description: sug.progress,
          sourceYear: sug.year,
          procedureRef: qpCode,
          origin: 'carryforward',
        }

        const audits = co.audits.some((a) => a.id === audit!.id)
          ? co.audits.map((a) =>
              a.id === audit!.id ? { ...a, items: [...a.items, newItem] } : a,
            )
          : [...co.audits, { ...audit, items: [...audit.items, newItem] }]

        const suggestions = co.suggestions.map((sg) =>
          sg.id === sugId ? { ...sg, carriedToYear: s.settings.auditYear } : sg,
        )

        return patchCompany(s, s.activeCompanyId, { audits, suggestions })
      })
    },
    [],
  )

  const exportJSON = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importJSON = useCallback((json: string) => {
    const parsed = parseImportJSON(json)
      if (parsed.version < 4) {
      const migrated =
        parsed.version === 1 ? migrateV1State(parsed) : migrateToV4(parsed as AppState)
      if (migrated) {
        setState({ ...migrateState(migrated), dataSource: 'user' })
        return
      }
    }
    setState({ ...migrateState(parsed), dataSource: 'user' })
  }, [])

  const dismissDemoBanner = useCallback(() => {
    setState((s) => ({ ...s, dataSource: 'user' }))
  }, [])

  const resetToDemo = useCallback(() => setState(createDemoState()), [])

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('qms-annual-internal-audit-v1')
    setState(createDemoState())
  }, [])

  const syncedState = useMemo(
    () => ({
      ...state,
      company: activeCompany,
    }),
    [state, activeCompany],
  )

  return {
    state: syncedState,
    loadWarning,
    lastSavedAt,
    saveError,
    updateSettings,
    switchCompany,
    updateDepartment,
    regeneratePlan,
    updatePlanRow,
    setPlanMonthStatus,
    getOrCreateAudit,
    updateAudit,
    updateChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    markChecklistItemNA,
    setRemainingUnjudgedToConform,
    updateNCR,
    addManualNCR,
    updateObservation,
    addObservation,
    updateSuggestion,
    addSuggestion,
    updateExternalPrepItem,
    updateExternalPrepSequence,
    resetInternalAuditCompleteOverride,
    carryForwardObservation,
    carryForwardNCR,
    carryForwardSuggestion,
    exportJSON,
    importJSON,
    resetToDemo,
    clearAll,
    dismissDemoBanner,
    getProcedureTitle,
  }
}

export type AuditStore = ReturnType<typeof useAuditStore>
