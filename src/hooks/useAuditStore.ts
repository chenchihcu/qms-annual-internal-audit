import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppState,
  AuditSettings,
  ChecklistItem,
  CompanyData,
  CompanyId,
  NCR,
  Observation,
  ObservationRevisionFields,
  PlanRow,
  ExternalAuditPrepItemState,
  ProcedureAudit,
  ThirdPartySuggestion,
  Person,
  AnnualPersonnelAssignment,
  CompanyAuditProfile,
  AuditTeamSnapshot,
  ProcedureRiskRecord,
} from '../types'
import { createDefaultPrepState } from '../lib/externalAuditPrep'
import {
  createDemoState,
  createBlankState,
  migrateToV6,
  migrateV1State,
  STORAGE_KEY,
} from '../data/demoData'
import {
  findActiveLeadAppointment,
  findMatchingAuditQualification,
  resolveLeadAuditorPersonId,
  validateAuditTeam,
} from '../lib/personnel'
import { isSeedChecklistItem } from '../lib/checklistItem'
import { parseBackupJson, serializeBackup } from '../lib/backup'
import { autoArrangePlan } from '../lib/planner'
import { buildEffectiveProcedureRisks } from '../lib/risk'
import { collectNCRsFromAudits, syncNCRDescriptions } from '../lib/ncr'
import { createChecklistForProcedure, getProcedureTitle } from '../data/checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { MonthStatus } from '../types'

interface LoadStateResult {
  state: AppState
  persistenceAllowed: boolean
  storageWarning: string | null
}

function loadFailure(message: string): LoadStateResult {
  return {
    state: createBlankState(),
    persistenceAllowed: false,
    storageWarning: `${message}。原始瀏覽器資料已保留且不會自動覆寫；請由系統設定還原有效備份、重設示範資料或清除全部資料。`,
  }
}

function parseStoredState(raw: string, label: string): AppState | LoadStateResult {
  let parsed: AppState
  try {
    parsed = JSON.parse(raw) as AppState
  } catch {
    return loadFailure(`${label} JSON 已損壞`)
  }
  if (typeof parsed.version !== 'number') return loadFailure(`${label} 缺少資料版本`)
  if (parsed.version > 6) return loadFailure(`${label} 為較新的 v${parsed.version}，本系統拒絕降版載入`)
  if (!parsed.companies) return loadFailure(`${label} 結構不完整`)
  try {
    return migrateToV6(parsed)
  } catch {
    return loadFailure(`${label} 無法安全遷移至 v6`)
  }
}

function loadState(): LoadStateResult {
  const current = localStorage.getItem(STORAGE_KEY)
  if (current) {
    const loaded = parseStoredState(current, 'v6 資料')
    return 'state' in loaded
      ? loaded
      : { state: loaded, persistenceAllowed: true, storageWarning: null }
  }
  for (const [key, label] of [
    ['qms-annual-internal-audit-v5', 'v5 資料'],
    ['qms-annual-internal-audit-v4', 'v4 資料'],
  ] as const) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    const loaded = parseStoredState(raw, label)
    return 'state' in loaded
      ? loaded
      : { state: loaded, persistenceAllowed: true, storageWarning: null }
  }
  const legacy = localStorage.getItem('qms-annual-internal-audit-v1')
  if (legacy) {
    let parsed: unknown
    try {
      parsed = JSON.parse(legacy)
    } catch {
      return loadFailure('v1 資料 JSON 已損壞')
    }
    try {
      const migrated = migrateV1State(parsed)
      if (!migrated) return loadFailure('v1 資料結構不完整')
      return { state: migrateToV6(migrated), persistenceAllowed: true, storageWarning: null }
    } catch {
      return loadFailure('v1 資料無法安全遷移至 v6')
    }
  }
  return { state: createDemoState(), persistenceAllowed: true, storageWarning: null }
}

function nextId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`
}

function emptyYearCompanies(source: AppState['companies']): AppState['companies'] {
  return Object.fromEntries(Object.entries(source).map(([id, company]) => [id, {
    ...company,
    planRows: company.planRows.map((row) => ({
      ...row,
      months: Array.from({ length: 12 }, () => null),
      manualOverride: false,
    })),
    audits: [],
    ncrs: [],
    observations: [],
    suggestions: [],
  }])) as unknown as AppState['companies']
}

function switchYearState(state: AppState, year: number): AppState {
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || year === state.settings.auditYear) return state
  const archives = {
    ...state.yearArchives,
    [String(state.settings.auditYear)]: {
      settings: state.settings,
      companies: state.companies,
      externalAuditPrep: state.externalAuditPrep,
    },
  }
  const restored = archives[String(year)]
  if (restored) {
    return { ...state, ...restored, settings: { ...restored.settings, auditYear: year }, yearArchives: archives }
  }
  const replaceYear = (value?: string) => value ? value.replace(/^\d{4}/, String(year)) : value
  return {
    ...state,
    settings: {
      ...state.settings,
      auditYear: year,
      yearStart: replaceYear(state.settings.yearStart)!,
      planWindowStart: replaceYear(state.settings.planWindowStart)!,
      planWindowEnd: replaceYear(state.settings.planWindowEnd)!,
      externalAuditDate: replaceYear(state.settings.externalAuditDate),
      managementReviewDate: replaceYear(state.settings.managementReviewDate),
    },
    companies: emptyYearCompanies(state.companies),
    externalAuditPrep: createDefaultPrepState(year),
    yearArchives: archives,
  }
}

function buildTeamSnapshot(state: AppState, audit: ProcedureAudit): AuditTeamSnapshot {
  const members: AuditTeamSnapshot['members'] = []
  const auditDate = audit.auditDate || audit.plannedDate || ''
  const standards = state.companyAuditProfiles[state.activeCompanyId].applicableStandards
    .filter((standard) => standard.confirmationStatus === 'confirmed')
    .map((standard) => `${standard.name}:${standard.version}`)
  const add = (personId: string | undefined, role: 'lead' | 'auditor' | 'escort') => {
    if (!personId) return
    const person = state.people.find((p) => p.id === personId)
    if (!person) return
    const affiliation = person.affiliations.find((candidate) => (
      candidate.companyId === state.activeCompanyId
      && (!candidate.effectiveFrom || candidate.effectiveFrom <= auditDate)
      && (!candidate.effectiveTo || candidate.effectiveTo >= auditDate)
    )) ?? person.affiliations.find((candidate) => Boolean(candidate.externalOrganization))
    const departmentName = state.companies[state.activeCompanyId].departments
      .find((department) => department.id === affiliation?.departmentId)?.name
    const qualification = role === 'escort'
      ? undefined
      : findMatchingAuditQualification(
          person,
          role === 'lead' ? 'internal_lead_auditor' : 'internal_auditor',
          state.activeCompanyId,
          audit.qpCode,
          audit.departmentId,
          auditDate,
          standards,
        )
    const appointment = role === 'lead'
      ? findActiveLeadAppointment(person, state.activeCompanyId, auditDate)
      : undefined
    const scope = role === 'escort'
      ? `陪同／協調：${audit.scope || `${audit.qpCode} ${audit.department}`}`
      : qualification
        ? [
            qualification.standardVersions.join('、') || '全部已確認標準',
            qualification.procedureScopes.join('、') || '全部程序',
            qualification.departmentScopes.join('、') || '全部責任單位',
          ].join('／')
        : ''
    members.push({
      personId,
      name: person.name,
      role,
      affiliation: affiliation?.externalOrganization ?? departmentName ?? affiliation?.departmentId ?? '',
      qualificationReference: qualification ? `${qualification.documentTitle} ${qualification.documentNumber}`.trim() : '',
      qualificationScope: scope,
      appointmentReference: appointment?.documentReference ?? '',
    })
  }
  add(audit.team?.leadAuditorPersonId, 'lead')
  audit.team?.auditorPersonIds.forEach((id) => add(id, 'auditor'))
  audit.team?.escortPersonIds.forEach((id) => add(id, 'escort'))
  return { capturedAt: new Date().toISOString(), members }
}

function validateAuditStartState(state: AppState, audit: ProcedureAudit) {
  const profile = state.companyAuditProfiles[state.activeCompanyId]
  const standards = profile.applicableStandards
    .filter((item) => item.confirmationStatus === 'confirmed')
    .map((item) => `${item.name}:${item.version}`)
  const result = validateAuditTeam(
    state.people, audit.team, state.activeCompanyId, audit.qpCode, audit.departmentId,
    audit.auditDate || audit.plannedDate || '', standards,
  )
  const errors = [...result.errors]
  if (!audit.auditDate) errors.unshift('開始稽核前須填寫實際實施日期')
  if (standards.length === 0) errors.unshift('公司適用標準與版本尚未確認')
  if (!profile.auditProcedureCode.trim()) errors.unshift('稽核程序代碼尚未確認')
  if (!profile.auditProcedureVersion || profile.auditProcedureVersion === '待確認') errors.unshift('稽核程序版本尚未確認')
  if (!profile.formalRecordLocation.trim()) errors.unshift('正式紀錄保存位置尚未確認')
  return {
    ...result,
    canStart: errors.length === 0,
    errors,
    standards,
    procedureCode: profile.auditProcedureCode,
    procedureVersion: profile.auditProcedureVersion,
    formalRecordLocation: profile.formalRecordLocation,
  }
}

function syncObservationsFromAudits(audits: ProcedureAudit[], existing: Observation[], year: number): Observation[] {
  const result = [...existing]
  audits.forEach((audit) => audit.items.forEach((item) => {
    if (item.judgment !== '觀察') return
    const id = `observation-${item.id}`
    if (result.some((observation) => observation.id === id || observation.sourceChecklistItemId === item.id)) return
    result.push({
      id, year: audit.year ?? year, qpCode: audit.qpCode, departmentId: audit.departmentId,
      department: audit.department, process: audit.process, content: item.content,
      description: item.description, status: 'open', sourceType: 'internal_audit', sourceAuditId: audit.id,
      sourceChecklistItemId: item.id, sourceReference: audit.reportReference ?? audit.id,
      occurrenceDate: audit.auditDate || audit.plannedDate || '', followUps: [],
    })
  }))
  return result
}

function findObservation(state: AppState, id: string): Observation | undefined {
  return state.companies[state.activeCompanyId].observations.find((item) => item.id === id)
    ?? Object.values(state.yearArchives).flatMap((archive) => archive.companies[state.activeCompanyId].observations).find((item) => item.id === id)
}

function findNCR(state: AppState, id: string): NCR | undefined {
  return state.companies[state.activeCompanyId].ncrs.find((item) => item.id === id)
    ?? Object.values(state.yearArchives).flatMap((archive) => archive.companies[state.activeCompanyId].ncrs).find((item) => item.id === id)
}

function findSuggestion(state: AppState, id: string): ThirdPartySuggestion | undefined {
  return state.companies[state.activeCompanyId].suggestions.find((item) => item.id === id)
    ?? Object.values(state.yearArchives).flatMap((archive) => archive.companies[state.activeCompanyId].suggestions).find((item) => item.id === id)
}

function observationRevisionFields(item: Observation): ObservationRevisionFields {
  return {
    content: item.content,
    description: item.description,
    owner: item.owner ?? '',
    dueDate: item.dueDate ?? '',
    closedAt: item.closedAt ?? '',
    closeEvidence: item.closeEvidence ?? '',
    status: item.status,
  }
}

function patchObservation(state: AppState, id: string, patch: (item: Observation) => Observation): AppState {
  const company = state.companies[state.activeCompanyId]
  if (company.observations.some((item) => item.id === id)) {
    return patchCompany(state, state.activeCompanyId, {
      observations: company.observations.map((item) => item.id === id ? patch(item) : item),
    })
  }
  for (const [year, archive] of Object.entries(state.yearArchives)) {
    const sourceCompany = archive.companies[state.activeCompanyId]
    if (!sourceCompany.observations.some((item) => item.id === id)) continue
    return {
      ...state,
      yearArchives: {
        ...state.yearArchives,
        [year]: {
          ...archive,
          companies: {
            ...archive.companies,
            [state.activeCompanyId]: {
              ...sourceCompany,
              observations: sourceCompany.observations.map((item) => item.id === id ? patch(item) : item),
            },
          },
        },
      },
    }
  }
  return state
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

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

export function useAuditStore() {
  const [initial] = useState<LoadStateResult>(loadState)
  const [state, setState] = useState<AppState>(initial.state)
  const [persistenceAllowed, setPersistenceAllowed] = useState(initial.persistenceAllowed)
  const [storageWarning, setStorageWarning] = useState<string | null>(initial.storageWarning)

  useEffect(() => {
    if (persistenceAllowed) saveState(state)
  }, [state, persistenceAllowed])

  const activeCompany = state.companies[state.activeCompanyId]

  const updateSettings = useCallback((patch: Partial<AuditSettings>) => {
    setState((s) => {
      if (patch.auditYear != null && (!Number.isInteger(patch.auditYear) || patch.auditYear < 2000 || patch.auditYear > 2200)) return s
      const base = patch.auditYear == null ? s : switchYearState(s, patch.auditYear)
      return { ...base, settings: { ...base.settings, ...patch } }
    })
  }, [])

  const switchAuditYear = useCallback((year: number) => {
    setState((s) => switchYearState(s, year))
  }, [])

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

  const updateProcedureRisk = useCallback((qpCode: string, departmentId: string, patch: Partial<ProcedureRiskRecord>) => {
    setState((s) => {
      const company = s.companies[s.activeCompanyId]
      const current = company.procedureRisks ?? []
      const existing = current.find((item) => item.qpCode === qpCode && item.departmentId === departmentId)
      const next: ProcedureRiskRecord = {
        id: existing?.id ?? nextId('risk'),
        qpCode,
        departmentId,
        inherentRisk: existing?.inherentRisk ?? 3,
        evidenceReference: existing?.evidenceReference ?? '',
        updatedAt: new Date().toISOString(),
        ...existing,
        ...patch,
      }
      return patchCompany(s, s.activeCompanyId, {
        procedureRisks: existing
          ? current.map((item) => item.id === existing.id ? next : item)
          : [...current, next],
      })
    })
  }, [])

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
          procedureRisks: buildEffectiveProcedureRisks(co),
        },
        { leadAuditor: s.settings.leadAuditor },
      )
      return patchCompany(s, s.activeCompanyId, { planRows })
    })
  }, [])

  const replacePlanRows = useCallback((planRows: PlanRow[]) => {
    setState((s) => patchCompany(s, s.activeCompanyId, { planRows }))
  }, [])

  const updatePlanRow = useCallback((id: string, patch: Partial<PlanRow>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
        planRows: co.planRows.map((r) =>
          r.id === id ? { ...r, ...patch, manualOverride: true } : r,
        ),
      })
    })
  }, [])

  const setPlanMonthStatus = useCallback((rowId: string, monthIndex: number, status: MonthStatus) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
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

      const entry =
        PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === qpCode && e.departmentId === departmentId,
        ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === qpCode)
      const resolvedDeptId = entry?.departmentId ?? departmentId
      const dept =
        co.departments.find((d) => d.id === departmentId) ??
        co.departments.find((d) => d.id === resolvedDeptId)

      if (!dept || !entry) {
        return {
          id: auditId,
          qpCode,
          departmentId: resolvedDeptId,
          department: dept?.name ?? entry?.departmentName ?? departmentId,
          process: entry?.process ?? qpCode,
          documents: entry?.documents ?? qpCode,
          notifyDate: '',
          auditDate: '',
          departmentManager: dept?.owner ?? '',
          auditors: dept?.defaultAuditors ?? '',
          auditCategory: entry?.auditCategory ?? '系統稽核',
          items: dept ? createChecklistForProcedure(qpCode, dept.name) : [],
        }
      }

      return {
        id: auditId,
        qpCode,
        departmentId: entry.departmentId,
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
    [activeCompany],
  )

  const createAuditEvent = useCallback((qpCode: string, departmentId: string, plannedDate = '') => {
    const id = nextId(`audit-${state.settings.auditYear}-${qpCode}-${departmentId}`)
    setState((s) => {
      const company = s.companies[s.activeCompanyId]
      const entry = PROCEDURE_PLAN_TEMPLATE.find((item) => item.qpCode === qpCode && item.departmentId === departmentId)
        ?? PROCEDURE_PLAN_TEMPLATE.find((item) => item.qpCode === qpCode)
      const department = company.departments.find((item) => item.id === departmentId)
      if (!entry || !department) return s
      const leadId = resolveLeadAuditorPersonId(
        s.people,
        s.activeCompanyId,
        s.settings.auditYear,
        s.annualPersonnelAssignments,
      )
      const audit: ProcedureAudit = {
        id, qpCode, departmentId, department: department.name, process: entry.process, documents: entry.documents,
        notifyDate: '', auditDate: '', plannedDate, departmentManager: department.owner,
        auditors: department.defaultAuditors, auditCategory: entry.auditCategory,
        items: createChecklistForProcedure(qpCode, department.name).map((item) => ({ ...item, origin: 'seed' })),
        year: s.settings.auditYear, status: '規劃中', scope: `${department.name}／${entry.process}`,
        criteria: `${qpCode} 與公司程序`, procedureVersion: s.companyAuditProfiles[s.activeCompanyId].auditProcedureVersion,
        standardSnapshot: [],
        team: {
          leadAuditorPersonId: leadId,
          auditorPersonIds: [],
          escortPersonIds: [],
          impartialityConfirmed: false,
          impartialityNote: '',
        },
      }
      return patchCompany(s, s.activeCompanyId, { audits: [...company.audits, audit] })
    })
    return id
  }, [state.settings.auditYear])

  const updateAudit = useCallback((audit: ProcedureAudit) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const exists = co.audits.some((a) => a.id === audit.id)
      const audits = exists
        ? co.audits.map((stored) => {
            if (stored.id !== audit.id) return stored
            if (stored.status === '已回報') return stored
            if (stored.status === '執行中') {
              const status = audit.status === '已回報' && audit.reportReference?.trim() ? '已回報' : '執行中'
              return {
                ...stored,
                reportReference: audit.reportReference,
                status: status as ProcedureAudit['status'],
              }
            }
            return audit
          })
        : [...co.audits, audit]

      let ncrs = collectNCRsFromAudits(audits, s.settings.auditYear, co.ncrs)
      ncrs = syncNCRDescriptions(ncrs, audits)

      const observations = syncObservationsFromAudits(audits, co.observations, s.settings.auditYear)
      return patchCompany(s, s.activeCompanyId, { audits, ncrs, observations })
    })
  }, [])

  const updateChecklistItem = useCallback(
    (auditId: string, itemId: string, patch: Partial<ChecklistItem>) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const audits = co.audits.map((a) => {
          if (a.id !== auditId) return a
          if (a.status === '已回報') return a
          return {
            ...a,
            items: a.items.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          }
        })
        let ncrs = collectNCRsFromAudits(audits, s.settings.auditYear, co.ncrs)
        ncrs = syncNCRDescriptions(ncrs, audits)
        const observations = syncObservationsFromAudits(audits, co.observations, s.settings.auditYear)
        return patchCompany(s, s.activeCompanyId, { audits, ncrs, observations })
      })
    },
    [],
  )

  const addChecklistItem = useCallback((auditId: string) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const audits = co.audits.map((a) => {
        if (a.id !== auditId) return a
        if (a.status === '已回報') return a
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
        if (a.status === '已回報') return a
        const target = a.items.find((item) => item.id === itemId)
        if (!target || isSeedChecklistItem(target)) return a
        const items = a.items
          .filter((i) => i.id !== itemId)
          .map((item, idx) => ({ ...item, no: idx + 1 }))
        return { ...a, items }
      })
      return patchCompany(s, s.activeCompanyId, { audits })
    })
  }, [])

  const updateNCR = useCallback((id: string, patch: Partial<NCR>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
        ncrs: co.ncrs.map((n) => {
          if (n.id !== id) return n
          const next = { ...n, ...patch }
          if (next.status === '結案' && (!next.correctiveActionReference || !next.effectivenessReference || !next.effectivenessVerifiedBy || !next.effectivenessVerifiedAt)) return n
          return next
        }),
      })
    })
  }, [])

  const updateObservation = useCallback((id: string, patch: Partial<Observation>) => {
    setState((s) => {
      return patchObservation(s, id, (observation) => {
        if (observation.status === 'became_ncr') return observation
        const next = { ...observation, ...patch }
        if (next.status === 'closed' && (!next.closeEvidence?.trim() || !next.closedAt)) return observation
        const final = next.status === 'open' && observation.status === 'closed' ? { ...next, closedAt: '', closeEvidence: '' } : next
        const before = observationRevisionFields(observation)
        const after = observationRevisionFields(final)
        if (JSON.stringify(before) === JSON.stringify(after)) return observation
        return {
          ...final,
          revisions: [...(observation.revisions ?? []), { id: nextId('observation-revision'), changedAt: new Date().toISOString(), before, after }],
        }
      })
    })
  }, [])

  const addObservation = useCallback((observation: Omit<Observation, 'id'>) => {
    setState((s) => {
      const company = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, { observations: [...company.observations, { ...observation, id: nextId('observation') }] })
    })
  }, [])

  const addObservationFollowUp = useCallback((id: string, date: string, note: string) => {
    if (!note.trim()) return
    setState((s) => {
      return patchObservation(s, id, (item) => item.status === 'open'
        ? { ...item, followUps: [...(item.followUps ?? []), { id: nextId('follow-up'), date, note: note.trim() }] }
        : item)
    })
  }, [])

  const convertObservationToNCR = useCallback((id: string) => {
    setState((s) => {
      const company = s.companies[s.activeCompanyId]
      const observation = findObservation(s, id)
      if (!observation || observation.status !== 'open' || observation.convertedNcrId) return s
      const ncrId = nextId('ncr-observation')
      const ncr: NCR = {
        id: ncrId,
        ncrNumber: `NCR-${s.settings.auditYear}-${String(company.ncrs.length + 1).padStart(3, '0')}`,
        qpCode: observation.qpCode,
        departmentId: observation.departmentId,
        department: observation.department,
        process: observation.process,
        description: observation.description || observation.content,
        date: new Date().toISOString().slice(0, 10),
        status: '開立',
        sourceYear: observation.year,
        sourceAuditId: observation.sourceAuditId,
        requirementSnapshot: observation.content,
        evidenceSnapshot: observation.sourceReference,
        findingSnapshot: observation.description || observation.content,
      }
      return patchObservation(
        patchCompany(s, s.activeCompanyId, { ncrs: [...company.ncrs, ncr] }),
        id,
        (item) => ({
          ...item,
          status: 'became_ncr',
          convertedNcrId: ncrId,
          revisions: [...(item.revisions ?? []), {
            id: nextId('observation-revision'), changedAt: new Date().toISOString(),
            before: observationRevisionFields(item),
            after: { ...observationRevisionFields(item), status: 'became_ncr' },
          }],
        }),
      )
    })
  }, [])

  const updateSuggestion = useCallback((id: string, patch: Partial<ThirdPartySuggestion>) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      if (co.suggestions.some((sg) => sg.id === id)) {
        return patchCompany(s, s.activeCompanyId, {
          suggestions: co.suggestions.map((sg) => (sg.id === id ? { ...sg, ...patch } : sg)),
        })
      }
      const yearKey = Object.keys(s.yearArchives).find((year) =>
        s.yearArchives[year].companies[s.activeCompanyId].suggestions.some((sg) => sg.id === id),
      )
      if (!yearKey) return s
      const archive = s.yearArchives[yearKey]
      return {
        ...s,
        yearArchives: {
          ...s.yearArchives,
          [yearKey]: {
            ...archive,
            companies: {
              ...archive.companies,
              [s.activeCompanyId]: {
                ...archive.companies[s.activeCompanyId],
                suggestions: archive.companies[s.activeCompanyId].suggestions.map((sg) =>
                  sg.id === id ? { ...sg, ...patch } : sg,
                ),
              },
            },
          },
        },
      }
    })
  }, [])

  const addSuggestion = useCallback((suggestion: Omit<ThirdPartySuggestion, 'id'>) => {
    setState((s) => {
      const company = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
        suggestions: [...company.suggestions, { ...suggestion, id: nextId('suggestion') }],
      })
    })
  }, [])

  const addPerson = useCallback((person: Omit<Person, 'id'>) => {
    const id = nextId('person')
    setState((s) => ({ ...s, people: [...s.people, { ...person, id }] }))
    return id
  }, [])

  const updatePerson = useCallback((id: string, patch: Partial<Person>) => {
    setState((s) => ({
      ...s,
      people: s.people.map((person) => person.id === id ? { ...person, ...patch, id } : person),
    }))
  }, [])

  const deactivatePerson = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      people: s.people.map((person) => person.id === id ? { ...person, active: false } : person),
    }))
  }, [])

  const upsertAnnualPersonnelAssignment = useCallback((assignment: Omit<AnnualPersonnelAssignment, 'id'> & { id?: string }) => {
    setState((s) => {
      const match = s.annualPersonnelAssignments.find((item) => (
        item.personId === assignment.personId
        && item.year === assignment.year
        && item.companyId === assignment.companyId
        && item.role === assignment.role
        && (assignment.role !== 'annual_escort' || item.departmentId === assignment.departmentId)
      ))
      const id = assignment.id ?? match?.id ?? nextId('annual-person')
      const value = { ...assignment, id } as AnnualPersonnelAssignment
      const exists = s.annualPersonnelAssignments.some((item) => item.id === id)
      return {
        ...s,
        annualPersonnelAssignments: exists
          ? s.annualPersonnelAssignments.map((item) => item.id === id ? value : item)
          : [...s.annualPersonnelAssignments, value],
      }
    })
  }, [])

  const updateCompanyAuditProfile = useCallback((companyId: CompanyId, patch: Partial<CompanyAuditProfile>) => {
    setState((s) => ({
      ...s,
      companyAuditProfiles: {
        ...s.companyAuditProfiles,
        [companyId]: { ...s.companyAuditProfiles[companyId], ...patch, companyId },
      },
    }))
  }, [])

  const validateAuditStart = useCallback((audit: ProcedureAudit) => validateAuditStartState(state, audit), [state])

  const startAudit = useCallback((auditId: string) => {
    const audit = state.companies[state.activeCompanyId].audits.find((item) => item.id === auditId)
    if (!audit) return { canStart: false, errors: ['找不到稽核事件'], warnings: [] }
    if (audit.status === '執行中' || audit.status === '已回報') {
      return { canStart: false, errors: ['稽核事件已開始，歷史資格快照不可重新建立'], warnings: [] }
    }
    const result = validateAuditStartState(state, audit)
    if (!result.canStart) return result
    setState((s) => {
      const company = s.companies[s.activeCompanyId]
      return patchCompany(s, s.activeCompanyId, {
        audits: company.audits.map((item) => item.id === auditId
          ? {
              ...item,
              status: '執行中',
              standardSnapshot: result.standards,
              procedureCodeSnapshot: result.procedureCode,
              procedureVersion: result.procedureVersion,
              formalRecordLocationSnapshot: result.formalRecordLocation,
              teamSnapshot: buildTeamSnapshot(s, item),
            }
          : item),
      })
    })
    return result
  }, [state])

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
        const obs = findObservation(s, obsId)
        if (!obs || obs.status !== 'open' || obs.carriedToYear === s.settings.auditYear || obs.carryForwards?.some((entry) => entry.year === s.settings.auditYear)) return s

        const auditId = `audit-${qpCode}-${departmentId}`
        let audit = co.audits.find((a) => a.id === auditId && (a.status ?? '規劃中') === '規劃中')
        const dept = co.departments.find((d) => d.id === departmentId)
        const entry = PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === qpCode && e.departmentId === departmentId,
        )
        if (!dept || !entry) return s

        if (!audit) {
          audit = {
            id: co.audits.some((item) => item.id === auditId) ? nextId(`audit-${s.settings.auditYear}-${qpCode}-${departmentId}`) : auditId,
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

        if (audit.items.some((item) => item.carriedFromId === obs.id)) return s

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
          origin: 'carryforward',
          procedureRef: qpCode,
        }

        const audits = co.audits.some((a) => a.id === audit!.id)
          ? co.audits.map((a) =>
              a.id === audit!.id ? { ...a, items: [...a.items, newItem] } : a,
            )
          : [...co.audits, { ...audit, items: [...audit.items, newItem] }]

        return patchObservation(
          patchCompany(s, s.activeCompanyId, { audits }),
          obsId,
          (item) => ({
            ...item,
            carriedToYear: s.settings.auditYear,
            carriedToChecklistId: newItemId,
            carryForwards: [...(item.carryForwards ?? []), { year: s.settings.auditYear, auditId: audit!.id, checklistItemId: newItemId }],
          }),
        )
      })
    },
    [],
  )

  const carryForwardNCR = useCallback((ncrId: string, qpCode: string, departmentId: string) => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const ncr = findNCR(s, ncrId)
      if (!ncr || ncr.status === '結案') return s

      const auditId = `audit-${qpCode}-${departmentId}`
      let audit = co.audits.find((a) => a.id === auditId && (a.status ?? '規劃中') === '規劃中')
      const dept = co.departments.find((d) => d.id === departmentId)
      const entry = PROCEDURE_PLAN_TEMPLATE.find(
        (e) => e.qpCode === qpCode && e.departmentId === departmentId,
      ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === qpCode)
      if (!dept || !entry) return s

      if (!audit) {
        audit = {
          id: co.audits.some((item) => item.id === auditId) ? nextId(`audit-${s.settings.auditYear}-${qpCode}-${departmentId}`) : auditId,
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
      if (audit.items.some((item) => item.sourceNcrId === ncr.id)) return s
      const sourceLabel = ncr.sourceYear ? `${ncr.sourceYear}年` : '來源年度待確認'
      const newItem: ChecklistItem = {
        id: newItemId,
        category: '跨年追蹤',
        no: audit.items.length + 1,
        content: `[${sourceLabel} NCR ${ncr.ncrNumber}] ${ncr.description}`,
        judgment: null,
        description: '前年度未結案不符合追蹤',
        sourceYear: ncr.sourceYear,
        sourceNcrId: ncr.id,
        origin: 'carryforward',
        procedureRef: qpCode,
      }

      const audits = co.audits.some((a) => a.id === audit!.id)
        ? co.audits.map((a) =>
            a.id === audit!.id ? { ...a, items: [...a.items, newItem] } : a,
          )
        : [...co.audits, { ...audit, items: [...audit.items, newItem] }]

      return patchCompany(s, s.activeCompanyId, { audits })
    })
  }, [])

  const carryForwardSuggestion = useCallback(
    (sugId: string, qpCode: string, departmentId: string) => {
      setState((s) => {
        const co = s.companies[s.activeCompanyId]
        const sug = findSuggestion(s, sugId)
        if (!sug || sug.status === 'closed') return s

        const auditId = `audit-${qpCode}-${departmentId}`
        let audit = co.audits.find((a) => a.id === auditId && (a.status ?? '規劃中') === '規劃中')
        const dept = co.departments.find((d) => d.id === departmentId)
        const entry = PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === qpCode && e.departmentId === departmentId,
        )
        if (!dept || !entry) return s

        if (!audit) {
          const baseId = co.audits.some((item) => item.id === auditId) ? nextId(`audit-${s.settings.auditYear}-${qpCode}-${departmentId}`) : auditId
          audit = {
            id: baseId,
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

        if (audit.items.some((item) => item.carriedFromId === sug.id)) return s

        const newItemId = `chk-sug-cf-${Date.now()}`
        const newItem: ChecklistItem = {
          id: newItemId,
          category: '第三方建議',
          no: audit.items.length + 1,
          content: `[${sug.year}年第三方建議] ${sug.issue}`,
          judgment: null,
          description: sug.progress,
          sourceYear: sug.year,
          carriedFromId: sug.id,
          origin: 'carryforward',
          procedureRef: qpCode,
        }

        const audits = co.audits.some((a) => a.id === audit!.id)
          ? co.audits.map((a) =>
              a.id === audit!.id ? { ...a, items: [...a.items, newItem] } : a,
            )
          : [...co.audits, { ...audit, items: [...audit.items, newItem] }]

        let next = patchCompany(s, s.activeCompanyId, {
          audits,
          suggestions: co.suggestions.map((sg) =>
            sg.id === sugId ? { ...sg, carriedToYear: s.settings.auditYear } : sg,
          ),
        })
        const archiveYear = Object.keys(next.yearArchives).find((year) =>
          next.yearArchives[year].companies[next.activeCompanyId].suggestions.some((sg) => sg.id === sugId),
        )
        if (archiveYear && !co.suggestions.some((sg) => sg.id === sugId)) {
          const archive = next.yearArchives[archiveYear]
          next = {
            ...next,
            yearArchives: {
              ...next.yearArchives,
              [archiveYear]: {
                ...archive,
                companies: {
                  ...archive.companies,
                  [next.activeCompanyId]: {
                    ...archive.companies[next.activeCompanyId],
                    suggestions: archive.companies[next.activeCompanyId].suggestions.map((sg) =>
                      sg.id === sugId ? { ...sg, carriedToYear: next.settings.auditYear } : sg,
                    ),
                  },
                },
              },
            },
          }
        }
        return next
      })
    },
    [],
  )

  const exportJSON = useCallback(() => serializeBackup(state), [state])

  const importJSON = useCallback((json: string) => {
    const migrated = parseBackupJson(json)
    setPersistenceAllowed(true)
    setStorageWarning(null)
    setState(migrated)
  }, [])

  const resetToDemo = useCallback(() => {
    setPersistenceAllowed(true)
    setStorageWarning(null)
    setState(createDemoState())
  }, [])

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('qms-annual-internal-audit-v5')
    localStorage.removeItem('qms-annual-internal-audit-v4')
    localStorage.removeItem('qms-annual-internal-audit-v1')
    setPersistenceAllowed(true)
    setStorageWarning(null)
    setState(createBlankState())
  }, [])

  const ensureAllAudits = useCallback(() => {
    setState((s) => {
      const co = s.companies[s.activeCompanyId]
      const audits = [...co.audits]
      for (const entry of PROCEDURE_PLAN_TEMPLATE) {
        const id = `audit-${entry.qpCode}-${entry.departmentId}`
        if (!audits.some((a) => a.id === id)) {
          const dept = co.departments.find((d) => d.id === entry.departmentId)
          if (!dept) continue
          audits.push({
            id,
            qpCode: entry.qpCode,
            departmentId: entry.departmentId,
            department: dept.name,
            process: entry.process,
            documents: entry.documents,
            notifyDate: '',
            auditDate: '',
            departmentManager: dept.owner,
            auditors: dept.defaultAuditors,
            auditCategory: entry.auditCategory,
            items: createChecklistForProcedure(entry.qpCode, dept.name),
          })
        }
      }
      return patchCompany(s, s.activeCompanyId, { audits })
    })
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
    storageWarning,
    updateSettings,
    switchAuditYear,
    switchCompany,
    updateDepartment,
    updateProcedureRisk,
    regeneratePlan,
    replacePlanRows,
    updatePlanRow,
    setPlanMonthStatus,
    getOrCreateAudit,
    createAuditEvent,
    updateAudit,
    updateChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    updateNCR,
    updateObservation,
    addObservation,
    addObservationFollowUp,
    convertObservationToNCR,
    updateSuggestion,
    addSuggestion,
    addPerson,
    updatePerson,
    deactivatePerson,
    upsertAnnualPersonnelAssignment,
    updateCompanyAuditProfile,
    validateAuditStart,
    startAudit,
    updateExternalPrepItem,
    updateExternalPrepSequence,
    carryForwardObservation,
    carryForwardNCR,
    carryForwardSuggestion,
    exportJSON,
    importJSON,
    resetToDemo,
    clearAll,
    ensureAllAudits,
    getProcedureTitle,
  }
}

export type AuditStore = ReturnType<typeof useAuditStore>
