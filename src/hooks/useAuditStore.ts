import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppState,
  AuditSettings,
  ChecklistItem,
  CompanyData,
  CompanyId,
  DepartmentProfile,
  NCR,
  Observation,
  PlanRow,
  ExternalAuditPrepItemState,
  ProcedureAudit,
  SharedChecklistQuestion,
  SharedPlanRow,
  ThirdPartySuggestion,
} from '../types'
import { getCompanyManagementReviewDate } from '../types'
import { createDemoState, migrateToV4, migrateV1State } from '../data/demoData'
import { autoArrangePlan } from '../lib/planner'
import { collectNCRsFromAudits, generateNCRNumber } from '../lib/ncr'
import { createChecklistForProcedure, getProcedureTitle } from '../data/checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { ProcedurePlanEntry } from '../data/procedurePlan'
import type { MonthStatus } from '../types'
import { loadStateFromStorage, saveStateToStorage } from '../lib/storage'
import { applyAuditYearChange } from '../lib/settingsYear'
import { parseImportJSON } from '../lib/importSummary'
import { hydrateSharedPlan } from '../lib/sharedPlan'
import {
  canRemoveCompanyFromPlanRow,
  COMPANY_IDS,
  projectSharedPlan,
  resolveLegacyPlanConflicts,
  scheduledMonths,
} from '../lib/sharedPlan'

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

/** 公司計畫列是共用計畫的相容投影；建立稽核當下取人員快照。 */
export function getPlannedAuditors(
  company: CompanyData,
  qpCode: string,
  departmentId: string,
): string {
  return company.planRows.find(
    (row) => row.qpCode === qpCode && row.departmentId === departmentId,
  )?.auditors ?? company.departments.find((dept) => dept.id === departmentId)?.defaultAuditors ?? ''
}

function createSharedChecklist(
  state: AppState,
  qpCode: string,
  departmentId: string,
  departmentName: string,
): ChecklistItem[] {
  const key = `${qpCode}|${departmentId}`
  return createChecklistForProcedure(qpCode, departmentName, state.sharedChecklistTemplates?.[key])
}

/** 共用計畫是新表單表頭的唯一來源；建立後成為該公司當次表單快照。 */
function createAuditFromSharedPlan(
  state: AppState,
  qpCode: string,
  departmentId: string,
): ProcedureAudit | null {
  const row = state.sharedPlanRows?.find((candidate) =>
    candidate.qpCode === qpCode
    && candidate.departmentId === departmentId
    && candidate.applicableCompanies.includes(state.activeCompanyId),
  )
  if (!row) return null
  return {
    id: `audit-${qpCode}-${departmentId}`,
    qpCode,
    departmentId,
    department: row.department,
    process: row.process,
    documents: row.documents,
    notifyDate: '',
    auditDate: '',
    departmentManager: row.owner,
    auditors: row.auditors,
    auditCategory: row.auditCategory,
    items: createSharedChecklist(state, qpCode, departmentId, row.department),
  }
}

function scopedPlannerInputs(state: AppState) {
  const current = new Map((state.sharedPlanRows ?? []).map((row) => [row.id, row]))
  const departments: DepartmentProfile[] = []
  const planEntries: ProcedurePlanEntry[] = []
  const existingRows: PlanRow[] = []
  const source = new Map<string, {
    originalDepartmentId: string
    scope: CompanyId[]
    previous?: SharedPlanRow
  }>()
  for (const entry of PROCEDURE_PLAN_TEMPLATE) {
    const previous = current.get(`plan-${entry.qpCode}-${entry.departmentId}`)
    const scope = previous?.applicableCompanies ?? [...COMPANY_IDS]
    const profiles = scope.flatMap((companyId) =>
      state.companies[companyId].departments.filter((department) => department.id === entry.departmentId),
    )
    if (profiles.length === 0) continue
    const syntheticId = `shared-${entry.qpCode}-${entry.departmentId}`
    const first = profiles[0]
    departments.push({
      ...first,
      id: syntheticId,
      riskOccurrence: Math.max(...profiles.map((profile) => profile.riskOccurrence)),
      riskSeverity: Math.max(...profiles.map((profile) => profile.riskSeverity)),
      stakeholders: [...new Set(profiles.flatMap((profile) => profile.stakeholders))],
      defaultAuditors: previous?.auditors
        ?? (profiles.every((profile) => profile.defaultAuditors === first.defaultAuditors)
          ? first.defaultAuditors : state.settings.leadAuditor),
    })
    planEntries.push({ ...entry, departmentId: syntheticId })
    source.set(syntheticId, { originalDepartmentId: entry.departmentId, scope, previous })
    if (previous) {
      const { applicableCompanies: _scope, ...row } = previous
      void _scope
      existingRows.push({ ...row, id: `plan-${entry.qpCode}-${syntheticId}`, departmentId: syntheticId })
    }
  }
  return { departments, planEntries, existingRows, source }
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
      if (!s.sharedPlanRows) return s
      const openCountFor = (companyId: CompanyId) => {
        const company = s.companies[companyId]
        return company.observations.filter((o) => o.status === 'open').length
          + company.suggestions.filter((suggestion) => suggestion.status === 'open').length
          + company.ncrs.filter((ncr) => ncr.status !== '結案').length
      }
      const openCount = COMPANY_IDS.reduce((total, companyId) => total + openCountFor(companyId), 0)
      const reviewDates = COMPANY_IDS.map((id) => getCompanyManagementReviewDate(s.settings, id)).filter(Boolean)
      const scoped = scopedPlannerInputs(s)
      const arranged = autoArrangePlan(
        {
          departments: scoped.departments,
          planEntries: scoped.planEntries,
          auditYear: s.settings.auditYear,
          planWindowStart: s.settings.planWindowStart,
          planWindowEnd: s.settings.planWindowEnd,
          managementReviewDate: reviewDates.sort()[0] ?? '',
          existingRows: scoped.existingRows,
          openCarryForwardCount: openCount,
        },
        { leadAuditor: s.settings.leadAuditor },
      )
      // 共用列需趕在兩家較早的管理審查前；單公司列只受該公司的日期限制。
      // 重算單公司列時把其餘列當成既有負載，仍維持同一稽核團隊的月格平衡。
      arranged.forEach((row, index) => {
        const source = scoped.source.get(row.departmentId)
        if (!source || source.scope.length !== 1 || row.manualOverride) return
        const companyId = source.scope[0]
        const department = scoped.departments.find((item) => item.id === row.departmentId)
        const entry = scoped.planEntries.find((item) =>
          item.qpCode === row.qpCode && item.departmentId === row.departmentId,
        )
        if (!department || !entry) return
        const recalculated = autoArrangePlan({
          departments: [department],
          planEntries: [entry],
          auditYear: s.settings.auditYear,
          planWindowStart: s.settings.planWindowStart,
          planWindowEnd: s.settings.planWindowEnd,
          managementReviewDate: getCompanyManagementReviewDate(s.settings, companyId),
          existingRows: arranged.filter((candidate) => candidate.id !== row.id),
          openCarryForwardCount: openCountFor(companyId),
        }, { leadAuditor: s.settings.leadAuditor })[0]
        if (recalculated) arranged[index] = { ...recalculated, sequence: row.sequence }
      })
      const sharedPlanRows: SharedPlanRow[] = arranged.map((row) => {
        const original = scoped.source.get(row.departmentId)!
        return {
          ...row,
          id: `plan-${row.qpCode}-${original.originalDepartmentId}`,
          departmentId: original.originalDepartmentId,
          department: original.previous?.department ?? row.department,
          process: original.previous?.process ?? row.process,
          documents: original.previous?.documents ?? row.documents,
          auditUnit: original.previous?.auditUnit ?? row.auditUnit,
          owner: original.previous?.owner ?? row.owner,
          auditors: original.previous?.auditors ?? row.auditors,
          auditCategory: original.previous?.auditCategory ?? row.auditCategory,
          months: scheduledMonths(row),
          applicableCompanies: original.scope,
        }
      })
      const arrangedIds = new Set(sharedPlanRows.map((row) => row.id))
      sharedPlanRows.push(...s.sharedPlanRows.filter((row) => !arrangedIds.has(row.id)))
      return projectSharedPlan(s, sharedPlanRows)
    })
  }, [])

  const updatePlanRow = useCallback((id: string, patch: Partial<Pick<PlanRow, 'auditors' | 'owner' | 'auditUnit' | 'riskLevel' | 'documents'>>) => {
    setState((s) => {
      if (!s.sharedPlanRows) return s
      return projectSharedPlan(s, s.sharedPlanRows.map((row) =>
        row.id === id
          ? { ...row, ...patch, manualOverride: row.manualOverride || patch.riskLevel !== undefined }
          : row,
      ))
    })
  }, [])

  const setSharedPlanMonth = useCallback((rowId: string, monthIndex: number, planned: boolean) => {
    setState((s) => {
      if (!s.sharedPlanRows || monthIndex < 0 || monthIndex > 11) return s
      return projectSharedPlan(s, s.sharedPlanRows.map((row) => {
        if (row.id !== rowId) return row
        const months = [...scheduledMonths(row)]
        months[monthIndex] = planned ? '擬定' : null
        return { ...row, months, manualOverride: true }
      }))
    })
  }, [])

  const updatePlanScope = useCallback((rowId: string, applicableCompanies: CompanyId[]) => {
    setState((s) => {
      if (!s.sharedPlanRows || applicableCompanies.length === 0) return s
      const row = s.sharedPlanRows.find((candidate) => candidate.id === rowId)
      if (!row) return s
      const removed = row.applicableCompanies.filter((companyId) => !applicableCompanies.includes(companyId))
      if (removed.some((companyId) => !canRemoveCompanyFromPlanRow(s, rowId, companyId))) return s
      return projectSharedPlan(s, s.sharedPlanRows.map((candidate) =>
        candidate.id === rowId ? { ...candidate, applicableCompanies } : candidate,
      ))
    })
  }, [])

  const confirmSharedPlan = useCallback((choices: Record<string, CompanyId>) => {
    setState((s) => resolveLegacyPlanConflicts(s, choices))
  }, [])

  const updateSharedChecklistTemplate = useCallback((
    qpCode: string,
    departmentId: string,
    questions: SharedChecklistQuestion[],
  ) => {
    if (questions.length === 0 || questions.some((question) => !question.content.trim())) return
    setState((s) => ({
      ...s,
      sharedChecklistTemplates: {
        ...s.sharedChecklistTemplates,
        [`${qpCode}|${departmentId}`]: questions.map((question) => ({
          ...question,
          content: question.content.trim(),
        })),
      },
    }))
  }, [])

  const setCompanyPlanMonthStatus = useCallback((companyId: CompanyId, rowId: string, monthIndex: number, status: MonthStatus) => {
    setState((s) => {
      if (!s.sharedPlanRows || monthIndex < 0 || monthIndex > 11) return s
      const co = s.companies[companyId]
      return patchCompany(s, companyId, {
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
      const co = activeCompany
      const auditId = `audit-${qpCode}-${departmentId}`
      const existing = co.audits.find((a) => a.id === auditId)
      if (existing) return existing
      if (!state.sharedPlanRows) throw new Error('請先在年度計畫確認舊計畫差異。')
      const newAudit = createAuditFromSharedPlan(state, qpCode, departmentId)
      if (!newAudit) throw new Error('此程序不在本公司計畫範圍內。')
      return newAudit
    },
    [activeCompany, state],
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
      const exists = co.audits.some((a) => a.id === audit.id)
      if (!exists && !createAuditFromSharedPlan(s, audit.qpCode, audit.departmentId)) return s
      const audits = exists
        ? co.audits.map((a) => (a.id === audit.id ? audit : a))
        : [...co.audits, audit]
      return persistAudit(s, audits, s.activeCompanyId)
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

  const updateNCR = useCallback((id: string, patch: Partial<NCR>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
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
    }) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const dept = co.departments.find((d) => d.id === input.departmentId)
        const plan = co.planRows.find((row) =>
          row.qpCode === input.qpCode && row.departmentId === input.departmentId,
        )
        const entry = PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === input.qpCode && e.departmentId === input.departmentId,
        )
        const ncr: NCR = {
          id: `ncr-manual-${Date.now()}`,
          ncrNumber: generateNCRNumber(s.settings.auditYear, co.ncrs.length + 1),
          qpCode: input.qpCode,
          departmentId: input.departmentId,
          department: plan?.department ?? dept?.name ?? input.departmentId,
          process: input.process ?? plan?.process ?? entry?.process ?? input.qpCode,
          description: input.description,
          date: new Date().toISOString().slice(0, 10),
          status: '開立',
        }
        return patchCompany(s, s.activeCompanyId, { ncrs: [...co.ncrs, ncr] })
      })
    },
    [],
  )

  const updateObservation = useCallback((id: string, patch: Partial<Observation>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
        observations: co.observations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
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
        const plan = co.planRows.find((row) =>
          row.qpCode === input.qpCode && row.departmentId === input.departmentId,
        )
        const entry = PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === input.qpCode && e.departmentId === input.departmentId,
        )
        const obs: Observation = {
          id: `obs-${Date.now()}`,
          year: s.settings.auditYear,
          qpCode: input.qpCode,
          departmentId: input.departmentId,
          department: plan?.department ?? dept?.name ?? input.departmentId,
          process: plan?.process ?? entry?.process ?? input.qpCode,
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
    (patch: Partial<Pick<AppState['externalAuditPrep'], 'internalAuditComplete' | 'managementReviewComplete'>>) => {
      setState((s) => ({
        ...s,
        externalAuditPrep: { ...s.externalAuditPrep, ...patch },
      }))
    },
    [],
  )

  const carryForwardObservation = useCallback(
    (obsId: string, qpCode: string, departmentId: string) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const obs = co.observations.find((o) => o.id === obsId)
        if (!obs || obs.carriedToYear) return s

        const auditId = `audit-${qpCode}-${departmentId}`
        let audit = co.audits.find((a) => a.id === auditId)
        audit ??= createAuditFromSharedPlan(s, qpCode, departmentId) ?? undefined
        if (!audit) return s

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
      audit ??= createAuditFromSharedPlan(s, qpCode, departmentId) ?? undefined
      if (!audit) return s

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
        audit ??= createAuditFromSharedPlan(s, qpCode, departmentId) ?? undefined
        if (!audit) return s

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
        setState(migrated)
        return
      }
    }
    setState(hydrateSharedPlan(parsed))
  }, [])

  const resetToDemo = useCallback(() => setState(createDemoState()), [])

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
    updatePlanScope,
    confirmSharedPlan,
    setSharedPlanMonth,
    setCompanyPlanMonthStatus,
    updateSharedChecklistTemplate,
    getOrCreateAudit,
    updateAudit,
    updateChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    markChecklistItemNA,
    updateNCR,
    addManualNCR,
    updateObservation,
    addObservation,
    updateSuggestion,
    addSuggestion,
    updateExternalPrepItem,
    updateExternalPrepSequence,
    carryForwardObservation,
    carryForwardNCR,
    carryForwardSuggestion,
    exportJSON,
    importJSON,
    resetToDemo,
    getProcedureTitle,
  }
}

export type AuditStore = ReturnType<typeof useAuditStore>
