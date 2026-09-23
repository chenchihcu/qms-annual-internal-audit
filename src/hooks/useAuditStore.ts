import { useCallback, useEffect, useState } from 'react'
import type {
  AppState,
  AuditSettings,
  ChecklistItem,
  CompanyData,
  NCR,
  NcrCompanyScope,
  Observation,
  PlanRow,
  ExternalAuditPrepItemState,
  ProcedureAudit,
  ThirdPartySuggestion,
} from '../types'
import { createDemoState, STORAGE_KEY } from '../data/demoData'
import { autoArrangePlan } from '../lib/planner'
import { carryForwardNcrIntoCompany, carryForwardObservationIntoCompany } from '../lib/carryForward'
import { collectNCRsFromAudits, generateNCRNumber, isPriorOpenNcr } from '../lib/ncr'
import { collectObservationsFromAudits, promoteObservationToNcr as applyPromoteObservationToNcr } from '../lib/observation'
import {
  createChecklistForProcedure,
  getProcedureTitle,
  mergeChecklistWithSeed,
} from '../data/checklistLoader'
import { ensurePrepItems } from '../lib/externalAuditPrep'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { MonthStatus } from '../types'
import { loadStateFromStorage, saveStateToStorage } from '../lib/storage'
import { applyAuditYearChange } from '../lib/settingsYear'
import { parseImportJSON } from '../lib/importSummary'
import { applyDepartmentOwnerChange } from '../lib/departmentOwner'
import { backfillCertificateScopeForAudit } from '../lib/certificateScope'

function patchCompanyState(state: AppState, patch: Partial<CompanyData>): AppState {
  return {
    ...state,
    company: { ...state.company, ...patch },
  }
}

export interface UpdateSettingsOptions {
  resetExternalPrep?: boolean
}

function hydrateCompanyNcrs(company: CompanyData, auditYear: number): CompanyData {
  const ncrs = company.ncrs.map((n) =>
    n.sourceYear == null ? { ...n, sourceYear: auditYear } : n,
  )
  const changed = ncrs.some((n, i) => n !== company.ncrs[i])
  return changed ? { ...company, ncrs } : company
}

function hydrateCompanyAudits(company: CompanyData): CompanyData {
  const audits = company.audits.map(backfillCertificateScopeForAudit)
  const changed = audits.some((a, i) => a !== company.audits[i])
  return changed ? { ...company, audits } : company
}

function hydrateAppState(raw: AppState): AppState {
  let company = hydrateCompanyNcrs(raw.company, raw.settings.auditYear)
  company = hydrateCompanyAudits(company)
  return {
    ...raw,
    company,
    externalAuditPrep: ensurePrepItems({
      ...raw.externalAuditPrep,
      auditedProducts: raw.externalAuditPrep?.auditedProducts ?? [],
    }),
  }
}

export function useAuditStore() {
  const initial = loadStateFromStorage()
  const [state, setState] = useState<AppState>(() => hydrateAppState(initial.state))
  const [loadWarning] = useState<string | undefined>(initial.warning)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const result = saveStateToStorage(state)
    if (result.ok) {
      setLastSavedAt(new Date())
      setSaveError(null)
    } else {
      setSaveError(result.error ?? '儲存失敗')
    }
  }, [state])

  const updateSettings = useCallback(
    (patch: Partial<AuditSettings>, options?: UpdateSettingsOptions) => {
      setState((s) => {
        if (patch.auditYear !== undefined && patch.auditYear !== s.settings.auditYear) {
          const { state: next, warnings } = applyAuditYearChange(
            s,
            patch.auditYear,
            options?.resetExternalPrep ?? false,
          )
          setActionError(warnings.length > 0 ? warnings.join('；') : null)
          return next
        }
        return { ...s, settings: { ...s.settings, ...patch } }
      })
    },
    [],
  )

  const updateDepartment = useCallback(
    (id: string, patch: Partial<CompanyData['departments'][0]>) => {
      setState((s) => {
        const co = s.company
        return patchCompanyState(s, {
          departments: co.departments.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })
      })
    },
    [],
  )

  const updateDepartmentOwner = useCallback((departmentId: string, newOwner: string) => {
    setState((s) => applyDepartmentOwnerChange(s, departmentId, newOwner, s.settings.scoringRules))
  }, [])

  const regeneratePlan = useCallback(() => {
    setState((s) => {
      const co = s.company
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
          externalAuditDate: s.settings.externalAuditDate,
          existingRows: co.planRows,
          openCarryForwardCount: openCount,
        },
        { leadAuditor: s.settings.leadAuditor },
      )
      return patchCompanyState(s, { planRows })
    })
  }, [])

  const updatePlanRow = useCallback((id: string, patch: Partial<PlanRow>) => {
    setState((s) => {
      const co = s.company
      return patchCompanyState(s, {
        planRows: co.planRows.map((r) =>
          r.id === id ? { ...r, ...patch, manualOverride: true } : r,
        ),
      })
    })
  }, [])

  const setPlanMonthStatus = useCallback((rowId: string, monthIndex: number, status: MonthStatus) => {
    setState((s) => {
      const co = s.company
      return patchCompanyState(s, {
        planRows: co.planRows.map((r) => {
          if (r.id !== rowId) return r
          const months = [...r.months] as MonthStatus[]
          months[monthIndex] = status
          return { ...r, months, manualOverride: true }
        }),
      })
    })
  }, [])

  const getOrCreateAudit = useCallback(
    (qpCode: string, departmentId: string): ProcedureAudit => {
      const co = state.company
      const auditId = `audit-${qpCode}-${departmentId}`
      const existing = co.audits.find((a) => a.id === auditId)
      if (existing) {
        const dept = co.departments.find((d) => d.id === departmentId)
        const mergedItems = mergeChecklistWithSeed(existing.items, qpCode, dept?.name)
        const withScope = backfillCertificateScopeForAudit({
          ...existing,
          items: mergedItems,
        })
        const itemsUnchanged =
          withScope.items.length === existing.items.length &&
          withScope.items.every((item, i) => item === existing.items[i])
        if (itemsUnchanged) return existing
        return withScope
      }

      const dept = co.departments.find((d) => d.id === departmentId)
      const entry = PROCEDURE_PLAN_TEMPLATE.find(
        (e) => e.qpCode === qpCode && e.departmentId === departmentId,
      ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === qpCode)
      if (!dept || !entry) {
        return {
          id: auditId,
          qpCode,
          departmentId,
          department: dept?.name ?? departmentId,
          process: entry?.process ?? qpCode,
          documents: entry?.documents ?? qpCode,
          notifyDate: '',
          auditDate: '',
          departmentManager: dept?.owner ?? '',
          auditors: dept?.defaultAuditors ?? '',
          auditCategory: entry?.auditCategory ?? '系統稽核',
          items: createChecklistForProcedure(qpCode, dept?.name),
        }
      }

      return {
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
    },
    [state.company],
  )

  const persistAudit = useCallback((s: AppState, audits: ProcedureAudit[]): AppState => {
    const co = s.company
    const ncrs = collectNCRsFromAudits(audits, s.settings.auditYear, co.ncrs)
    const observations = collectObservationsFromAudits(
      audits,
      s.settings.auditYear,
      co.observations,
    )
    return patchCompanyState(s, { audits, ncrs, observations })
  }, [])

  const updateAudit = useCallback(
    (audit: ProcedureAudit) => {
      setState((s) => {
        const co = s.company
        const exists = co.audits.some((a) => a.id === audit.id)
        const audits = exists
          ? co.audits.map((a) => (a.id === audit.id ? audit : a))
          : [...co.audits, audit]
        return persistAudit(s, audits)
      })
    },
    [persistAudit],
  )

  const updateChecklistItem = useCallback(
    (auditId: string, itemId: string, patch: Partial<ChecklistItem>) => {
      setState((s) => {
        const audits = s.company.audits.map((a) => {
          if (a.id !== auditId) return a
          return {
            ...a,
            items: a.items.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          }
        })
        return persistAudit(s, audits)
      })
    },
    [persistAudit],
  )

  const addChecklistItem = useCallback((auditId: string) => {
    setState((s) => {
      const audits = s.company.audits.map((a) => {
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
              certificateScope: 'shared' as const,
            },
          ],
        }
      })
      return patchCompanyState(s, { audits })
    })
  }, [])

  const removeChecklistItem = useCallback(
    (auditId: string, itemId: string) => {
      setState((s) => {
        const audits = s.company.audits.map((a) => {
          if (a.id !== auditId) return a
          const items = a.items
            .filter((i) => i.id !== itemId)
            .map((item, idx) => ({ ...item, no: idx + 1 }))
          return { ...a, items }
        })
        return persistAudit(s, audits)
      })
    },
    [persistAudit],
  )

  const markChecklistItemNA = useCallback(
    (auditId: string, itemId: string) => {
      updateChecklistItem(auditId, itemId, { judgment: '不適用' })
    },
    [updateChecklistItem],
  )

  const updateNCR = useCallback((id: string, patch: Partial<NCR>) => {
    setState((s) => {
      const co = s.company
      return patchCompanyState(s, {
        ncrs: co.ncrs.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      })
    })
  }, [])

  const addManualNCR = useCallback(
    (input: {
      qpCode: string
      departmentId: string
      description: string
      process?: string
      companyScope: NcrCompanyScope
    }) => {
      setState((s) => {
        const co = s.company
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
          companyScope: input.companyScope,
          sourceYear: s.settings.auditYear,
        }
        return patchCompanyState(s, { ncrs: [...co.ncrs, ncr] })
      })
    },
    [],
  )

  const updateObservation = useCallback((id: string, patch: Partial<Observation>) => {
    setState((s) => {
      const co = s.company
      return patchCompanyState(s, {
        observations: co.observations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      })
    })
  }, [])

  const promoteObservationToNcr = useCallback((observationId: string) => {
    setState((s) => {
      const result = applyPromoteObservationToNcr(s.company, observationId, s.settings.auditYear)
      if (!result) return s
      return patchCompanyState(s, {
        ncrs: result.ncrs,
        observations: result.observations,
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
        const co = s.company
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
        return patchCompanyState(s, {
          observations: [...co.observations, obs],
        })
      })
    },
    [],
  )

  const updateSuggestion = useCallback((id: string, patch: Partial<ThirdPartySuggestion>) => {
    setState((s) => {
      const co = s.company
      return patchCompanyState(s, {
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
        const co = s.company
        const sug: ThirdPartySuggestion = {
          id: `sug-${Date.now()}`,
          year: s.settings.auditYear,
          procedure: input.procedure,
          issue: input.issue,
          progress: input.progress ?? '',
          responsibleUnit: input.responsibleUnit,
          status: 'open',
        }
        return patchCompanyState(s, {
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
        Pick<AppState['externalAuditPrep'], 'managementReviewComplete' | 'auditedProducts'>
      >,
    ) => {
      setState((s) => ({
        ...s,
        externalAuditPrep: { ...s.externalAuditPrep, ...patch },
      }))
    },
    [],
  )

  const carryForwardObservation = useCallback((obsId: string, _qpCode: string, _departmentId: string) => {
      setState((s) => {
        const co = s.company
        const obs = co.observations.find((o) => o.id === obsId)
        if (!obs || obs.carriedToYear) return s
        try {
          const updated = carryForwardObservationIntoCompany(co, obs, s.settings.auditYear)
          setActionError(null)
          return patchCompanyState(s, updated)
        } catch (err) {
          const message = err instanceof Error ? err.message : '觀察事項帶入失敗'
          setActionError(message)
          return s
        }
      })
    },
    [],
  )

  const carryForwardNCR = useCallback((ncrId: string, _qpCode: string, _departmentId: string) => {
    setState((s) => {
      const co = s.company
      const ncr = co.ncrs.find((n) => n.id === ncrId)
      if (!ncr || ncr.carriedToYear) return s
      try {
        const updated = carryForwardNcrIntoCompany(co, ncr, s.settings.auditYear)
        setActionError(null)
        return patchCompanyState(s, updated)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'NCR 帶入失敗'
        setActionError(message)
        return s
      }
    })
  }, [])

  const importPriorYearCarryForward = useCallback(() => {
    setState((s) => {
      const currentYear = s.settings.auditYear
      let co = s.company
      const warnings: string[] = []

      for (const obs of co.observations.filter(
        (o) => o.status === 'open' && o.year < currentYear && !o.carriedToYear,
      )) {
        try {
          co = carryForwardObservationIntoCompany(co, obs, currentYear)
        } catch (err) {
          warnings.push(err instanceof Error ? err.message : '觀察事項帶入失敗')
        }
      }

      for (const ncr of co.ncrs.filter(
        (n) => isPriorOpenNcr(n, currentYear) && !n.carriedToYear,
      )) {
        try {
          co = carryForwardNcrIntoCompany(co, ncr, currentYear)
        } catch (err) {
          warnings.push(err instanceof Error ? err.message : 'NCR 帶入失敗')
        }
      }

      setActionError(warnings.length > 0 ? warnings.join('；') : null)
      return co === s.company ? s : patchCompanyState(s, co)
    })
  }, [])

  const carryForwardSuggestion = useCallback(
    (sugId: string, qpCode: string, departmentId: string) => {
      setState((s) => {
        const co = s.company
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
          certificateScope: 'shared' as const,
        }

        const audits = co.audits.some((a) => a.id === audit!.id)
          ? co.audits.map((a) =>
              a.id === audit!.id ? { ...a, items: [...a.items, newItem] } : a,
            )
          : [...co.audits, { ...audit, items: [...audit.items, newItem] }]

        const suggestions = co.suggestions.map((sg) =>
          sg.id === sugId ? { ...sg, carriedToYear: s.settings.auditYear } : sg,
        )

        return patchCompanyState(s, { audits, suggestions })
      })
    },
    [],
  )

  const exportJSON = useCallback(() => JSON.stringify(state, null, 2), [state])

  const importJSON = useCallback((json: string) => {
    const parsed = parseImportJSON(json)
    setState(hydrateAppState(parsed))
  }, [])

  const resetToDemo = useCallback(() => setState(createDemoState()), [])

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('qms-annual-internal-audit-v5')
    localStorage.removeItem('qms-annual-internal-audit-v1')
    setState(createDemoState())
  }, [])

  return {
    state,
    loadWarning,
    lastSavedAt,
    saveError,
    actionError,
    updateSettings,
    updateDepartment,
    updateDepartmentOwner,
    regeneratePlan,
    updatePlanRow,
    setPlanMonthStatus,
    getOrCreateAudit,
    updateAudit,
    updateChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    markChecklistItemNA,
    updateNCR,
    addManualNCR,
    updateObservation,
    promoteObservationToNcr,
    addObservation,
    updateSuggestion,
    addSuggestion,
    updateExternalPrepItem,
    updateExternalPrepSequence,
    carryForwardObservation,
    carryForwardNCR,
    importPriorYearCarryForward,
    carryForwardSuggestion,
    exportJSON,
    importJSON,
    resetToDemo,
    clearAll,
    getProcedureTitle,
  }
}

export type AuditStore = ReturnType<typeof useAuditStore>
