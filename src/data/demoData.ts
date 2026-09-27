import type {
  AppState,
  AuditSettings,
  CompanyAuditProfile,
  CompanyData,
  CompanyId,
  ExternalAuditPrepState,
  Person,
  PlanRow,
  ProcedureAudit,
  YearArchiveEntry,
} from '../types'
import { carryPlanDatesToAudit } from '../lib/auditDates'
import { COMPANY_IDS, COMPANY_LABELS, DEFAULT_SCORING_RULES } from '../types'
import { autoArrangePlan } from '../lib/planner'
import { normalizeNCRList } from '../lib/ncr'
import {
  createDefaultPrepState,
  DEFAULT_COMPANY_RELATIONSHIPS,
  migratePrepState,
} from '../lib/externalAuditPrep'
import { normalizeExternalAuditSchedule } from '../lib/externalAuditSchedule'
import { hydrateSharedPlan } from '../lib/sharedPlan'
import { createChecklistForProcedure } from './checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE } from './procedurePlan'
import { getProcedureTitle } from './checklistLoader'
import { isTrashEntry } from '../lib/trash'

const departments = [
  {
    id: 'dept-admin',
    name: '管理部',
    owner: '管理部主任',
    auditUnit: '品保部',
    defaultAuditors: '王稽核',
    stakeholders: ['法規/認證', '經營層'] as const,
    riskOccurrence: 2,
    riskSeverity: 3,
  },
  {
    id: 'dept-mr',
    name: '管理代表',
    owner: '管理代表',
    auditUnit: '品保部',
    defaultAuditors: '王稽核',
    stakeholders: ['客戶', '法規/認證', '經營層'] as const,
    riskOccurrence: 2,
    riskSeverity: 4,
  },
  {
    id: 'dept-sales',
    name: '業務部',
    owner: '業務部經理',
    auditUnit: '品保部',
    defaultAuditors: '李稽核',
    stakeholders: ['客戶', '經營層'] as const,
    riskOccurrence: 3,
    riskSeverity: 3,
  },
  {
    id: 'dept-eng',
    name: '開發工程',
    owner: '工程部經理',
    auditUnit: '品保部',
    defaultAuditors: '李稽核',
    stakeholders: ['客戶', '法規/認證'] as const,
    riskOccurrence: 3,
    riskSeverity: 4,
  },
  {
    id: 'dept-qa',
    name: '品保部',
    owner: '品保部經理',
    auditUnit: '管理部',
    defaultAuditors: '王稽核',
    stakeholders: ['客戶', '法規/認證', '供應商'] as const,
    riskOccurrence: 2,
    riskSeverity: 5,
  },
  {
    id: 'dept-prod',
    name: '生產製造部',
    owner: '生產部經理',
    auditUnit: '品保部',
    defaultAuditors: '陳稽核',
    stakeholders: ['客戶', '員工', '供應商'] as const,
    riskOccurrence: 4,
    riskSeverity: 4,
  },
].map((d) => ({ ...d, stakeholders: [...d.stakeholders] }))

const baseCompanySettings: AuditSettings = {
  auditYear: 2026,
  leadAuditor: '王大明',
  yearStart: '2026-01-01',
  planWindowStart: '2026-02-01',
  planWindowEnd: '2026-11-30',
  managementReviewDate: '2026-12-10',
  scoringRules: DEFAULT_SCORING_RULES,
}

function createCompanySettings(): Record<CompanyId, AuditSettings> {
  return Object.fromEntries(
    COMPANY_IDS.map((id) => [id, { ...baseCompanySettings, scoringRules: { ...baseCompanySettings.scoringRules } }]),
  ) as Record<CompanyId, AuditSettings>
}

type PartialItem = {
  no: number
  judgment: '符合' | '不符' | '觀察' | '不適用'
  description?: string
  objectiveEvidence?: string
}

function buildAudit(
  qpCode: string,
  departmentId: string,
  partialItems: PartialItem[],
  options?: { fullyJudged?: boolean; withEvidence?: boolean },
) {
  let entry = PROCEDURE_PLAN_TEMPLATE.find(
    (e) => e.qpCode === qpCode && e.departmentId === departmentId,
  )
  if (!entry) {
    entry = PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === qpCode)
  }
  if (!entry) {
    throw new Error(
      `buildAudit: no procedure plan entry for qpCode="${qpCode}" (departmentId="${departmentId}")`,
    )
  }

  const dept = departments.find((d) => d.id === entry.departmentId)
  if (!dept) {
    throw new Error(
      `buildAudit: department "${entry.departmentId}" not found for qpCode="${qpCode}"`,
    )
  }

  const items = createChecklistForProcedure(qpCode, dept.name)
  partialItems.forEach((p) => {
    const item = items.find((i) => i.no === p.no)
    if (item) {
      item.judgment = p.judgment
      item.description = p.description ?? ''
      if (p.objectiveEvidence) item.objectiveEvidence = p.objectiveEvidence
    }
  })
  if (options?.fullyJudged) {
    items.forEach((checkItem) => {
      if (!checkItem.judgment) checkItem.judgment = '符合'
    })
  }
  if (options?.withEvidence) {
    items.forEach((checkItem) => {
      if (
        (checkItem.judgment === '符合' || checkItem.judgment === '不符') &&
        !checkItem.objectiveEvidence?.trim()
      ) {
        checkItem.objectiveEvidence = `${qpCode}-demo-紀錄`
      }
    })
  }
  return {
    id: `audit-${qpCode}-${entry.departmentId}`,
    qpCode,
    departmentId: entry.departmentId,
    department: dept.name,
    process: entry.process,
    documents: entry.documents,
    notifyDate: '2026-03-01',
    auditDate: '2026-03-15',
    departmentManager: dept.owner,
    auditors: dept.defaultAuditors,
    auditCategory: entry.auditCategory,
    items,
    year: baseCompanySettings.auditYear,
    plannedDate: '2026-03-15',
    status: '執行中' as const,
    scope: `${dept.name}／${entry.process}`,
    criteria: `${entry.qpCode} 與公司程序`,
    procedureVersion: '待確認',
    standardSnapshot: [],
    team: {
      auditorPersonIds: [],
      escortPersonIds: [],
      impartialityConfirmed: false,
      impartialityNote: '',
    },
  }
}

function syncAuditsWithPlan(planRows: PlanRow[], audits: ProcedureAudit[]): ProcedureAudit[] {
  const planByKey = new Map(planRows.map((row) => [`${row.qpCode}|${row.departmentId}`, row]))
  return audits.map((audit) => {
    const row = planByKey.get(`${audit.qpCode}|${audit.departmentId}`)
    return row ? carryPlanDatesToAudit(row, audit, baseCompanySettings.auditYear) : audit
  })
}

function applyDemoImpartialityConflicts(planRows: PlanRow[]): PlanRow[] {
  const conflictDeptId = 'dept-qa'
  const dept = departments.find((d) => d.id === conflictDeptId)
  if (!dept) return planRows

  return planRows.map((row) =>
    row.qpCode === 'QP-05' && row.departmentId === conflictDeptId
      ? { ...row, auditors: dept.owner }
      : row,
  )
}

function createDemoPeople(): Person[] {
  const configs = [
    { name: '王大明', employeeNumber: 'JR-001', companyId: 'jiurun' as const, departmentId: 'dept-admin' },
    { name: '王稽核', employeeNumber: 'JR-QA-01', companyId: 'jiurun' as const, departmentId: 'dept-qa' },
    { name: '李稽核', employeeNumber: 'JR-PR-01', companyId: 'jiurun' as const, departmentId: 'dept-prod' },
    { name: '陳稽核', employeeNumber: 'ZLX-001', companyId: 'zhenglongxing' as const, departmentId: 'dept-admin' },
  ]
  return configs.map((item, index) => ({
    id: `person-demo-${index + 1}`,
    name: item.name,
    employeeNumber: item.employeeNumber,
    type: 'internal' as const,
    affiliations: [{
      id: `aff-demo-${index + 1}`,
      companyId: item.companyId,
      departmentId: item.departmentId,
    }],
    qualifications: [],
    appointments: [],
    active: true,
    notes: '既有示範姓名，資格與任命待確認',
  }))
}

function createAuditProfiles(): Record<CompanyId, CompanyAuditProfile> {
  return Object.fromEntries((['jiurun', 'zhenglongxing'] as CompanyId[]).map((companyId) => [
    companyId,
    {
      companyId,
      applicableStandards: [
        { name: 'ISO 9001', version: '2026', confirmationStatus: 'pending' },
        { name: 'AS9100', version: '2016 (Rev D)', confirmationStatus: 'pending' },
      ],
      certificateScope: '',
      certificateReference: '',
      auditProcedureCode: 'QP-28',
      auditProcedureVersion: '待確認',
      formalRecordLocation: '',
    },
  ])) as Record<CompanyId, CompanyAuditProfile>
}

function createCompanyData(companyId: CompanyId): CompanyData {
  const companySuffix = companyId === 'jiurun' ? 'jiurun' : 'zlx'

  if (companyId === 'jiurun') {
    let planRows = autoArrangePlan(
      {
        departments,
        planEntries: PROCEDURE_PLAN_TEMPLATE,
        auditYear: baseCompanySettings.auditYear,
        planWindowStart: baseCompanySettings.planWindowStart,
        planWindowEnd: baseCompanySettings.planWindowEnd,
        managementReviewDate: baseCompanySettings.managementReviewDate,
        openCarryForwardCount: 2,
      },
      { leadAuditor: baseCompanySettings.leadAuditor },
    )
    planRows = applyDemoImpartialityConflicts(planRows)

    const qp16Audit = buildAudit('QP-16', 'dept-qa', [
      {
        no: 1,
        judgment: '不符',
        description: '不合格品隔離區標示不完整',
        objectiveEvidence: '現場巡檢紀錄',
      },
    ])
    qp16Audit.items = qp16Audit.items.map((item) =>
      item.no === 1 ? { ...item, as9100Clause: '8.7' } : item,
    )

    let audits: ProcedureAudit[] = [
      buildAudit('QP-28', 'dept-qa', [{ no: 1, judgment: '符合' }], {
        fullyJudged: true,
        withEvidence: true,
      }),
      qp16Audit,
      buildAudit('QP-20', 'dept-admin', [{ no: 1, judgment: '符合' }]),
    ]
    audits = syncAuditsWithPlan(planRows, audits)

    const ncrs = normalizeNCRList([
      {
        id: 'ncr-demo-1',
        ncrNumber: `NCR-2026-001-${companySuffix}`,
        qpCode: 'QP-16',
        departmentId: 'dept-qa',
        department: '品保部',
        process: '製程/最終檢驗',
        description: '不合格品隔離區標示不完整',
        date: '2026-03-15',
        status: '矯正中',
        rootCause: '現場人員對隔離區標示規範不熟悉',
        correctiveAction: '重訓並增設標示看板',
        verificationEvidence: '',
        responsiblePerson: '品保部經理',
        dueDate: '2026-04-15',
        containment: '立即補齊隔離區標示並暫停該區進料',
        classification: '輕微',
        checklistItemId: audits[1].items.find((i) => i.judgment === '不符')?.id,
      },
    ])

    return {
      name: '',
      departments,
      planRows,
      audits,
      ncrs,
      observations: [
        {
          id: `obs-2025-1-${companySuffix}`,
          year: 2025,
          qpCode: 'QP-01',
          departmentId: 'dept-admin',
          department: '管理部',
          process: '文件管制',
          content: '文件回收舊版時，部分部門未簽收確認',
          description: '建議強化文件發放回收簽收紀錄',
          status: 'open' as const,
        },
        {
          id: `obs-2025-2-${companySuffix}`,
          year: 2025,
          qpCode: 'QP-22',
          departmentId: 'dept-prod',
          department: '生產製造部',
          process: '追溯性',
          content: '工單與現場實際用料偶有不一致',
          description: '建議每班首件核對工單物料',
          status: 'open' as const,
        },
      ],
      suggestions: [
        {
          id: `sug-2025-1-${companySuffix}`,
          year: 2025,
          procedure: 'QP-18',
          issue: '部分量測設備校正標籤資訊不完整',
          progress: '已通知各單位補貼，待複查',
          responsibleUnit: '品保部',
          status: 'open' as const,
        },
        {
          id: `sug-2025-2-${companySuffix}`,
          year: 2025,
          procedure: 'QP-09',
          issue: '合約審查紀錄缺少客戶特殊要求欄位',
          progress: '表單已修訂，舊案補登中',
          responsibleUnit: '業務部',
          status: 'open' as const,
        },
      ],
    }
  }

  let planRows = autoArrangePlan(
    {
      departments,
      planEntries: PROCEDURE_PLAN_TEMPLATE,
      auditYear: baseCompanySettings.auditYear,
      planWindowStart: baseCompanySettings.planWindowStart,
      planWindowEnd: baseCompanySettings.planWindowEnd,
      managementReviewDate: baseCompanySettings.managementReviewDate,
      openCarryForwardCount: 2,
    },
    { leadAuditor: baseCompanySettings.leadAuditor },
  )
  planRows = applyDemoImpartialityConflicts(planRows)

  let audits: ProcedureAudit[] = [
    buildAudit(
      'QP-28',
      'dept-qa',
      [
        { no: 1, judgment: '符合', objectiveEvidence: 'QP-28-內稽紀錄' },
        { no: 2, judgment: '符合', objectiveEvidence: 'QP-28-內稽紀錄' },
      ],
      { fullyJudged: true, withEvidence: true },
    ),
    buildAudit('QP-05', 'dept-qa', [{ no: 1, judgment: '符合' }]),
    buildAudit('QP-21', 'dept-prod', [
      { no: 1, judgment: '觀察', description: '首件檢查紀錄偶缺簽名' },
    ]),
  ]
  audits = syncAuditsWithPlan(planRows, audits)

  return {
    name: '',
    departments,
    planRows,
    audits,
    ncrs: [],
    observations: [
      {
        id: `obs-2025-1-${companySuffix}`,
        year: 2025,
        qpCode: 'QP-12',
        departmentId: 'dept-qa',
        department: '品保部',
        process: '進料檢驗',
        content: '供應商材質證明更新不及時',
        description: '已列管追蹤，待供應商回覆',
        status: 'open' as const,
      },
    ],
    suggestions: [
      {
        id: `sug-2025-1-${companySuffix}`,
        year: 2025,
        procedure: 'QP-07',
        issue: '教育訓練矩陣未含新進人員',
        progress: 'HR 補登中',
        responsibleUnit: '管理部',
        status: 'open' as const,
      },
    ],
  }
}

export function createDemoState(): AppState {
  const companies = {} as Record<CompanyId, CompanyData>
  for (const id of ['jiurun', 'zhenglongxing'] as CompanyId[]) {
    companies[id] = {
      ...createCompanyData(id),
      name: COMPANY_LABELS[id],
      keyCustomerName: id === 'zhenglongxing' ? COMPANY_LABELS.jiurun : '',
    }
  }

  const prep = createDefaultPrepState(baseCompanySettings.auditYear)
  prep.externalAuditDate = '2026-09-15'
  prep.internalAuditComplete = true
  prep.managementReviewComplete = false
  prep.items[0].jiurunDone = true
  prep.items[0].zhenglongxingDone = true

  const zlxPlanById = new Map(companies.zhenglongxing.planRows.map((row) => [row.id, row]))
  companies.zhenglongxing.planRows = companies.jiurun.planRows.map((row) => {
    const existing = zlxPlanById.get(row.id)
    return {
      ...row,
      months: existing?.months ?? row.months,
      manualOverride: existing?.manualOverride ?? row.manualOverride,
    }
  })

  let state: AppState = {
    activeCompanyId: 'jiurun',
    companySettings: createCompanySettings(),
    companies,
    externalAuditPrep: prep,
    companyRelationships: DEFAULT_COMPANY_RELATIONSHIPS.map((rel) => ({ ...rel })),
    people: createDemoPeople(),
    annualPersonnelAssignments: [],
    companyAuditProfiles: createAuditProfiles(),
    yearArchives: {},
    prepArchives: {},
    dataSource: 'demo',
    trash: [],
    permanentlyDeletedGeneratedRecords: [],
    version: 8,
  }

  state = hydrateSharedPlan(state)
  state = {
    ...state,
    companies: {
      jiurun: {
        ...state.companies.jiurun,
        planRows: applyDemoImpartialityConflicts(state.companies.jiurun.planRows),
      },
      zhenglongxing: {
        ...state.companies.zhenglongxing,
        planRows: applyDemoImpartialityConflicts(state.companies.zhenglongxing.planRows),
      },
    },
    externalAuditSchedule: normalizeExternalAuditSchedule(
      undefined,
      baseCompanySettings.auditYear,
      prep.externalAuditDate ?? `${baseCompanySettings.auditYear}-09-15`,
    ),
  }

  return state
}

export function createBlankState(): AppState {
  const state = createDemoState()
  state.people = []
  state.annualPersonnelAssignments = []
  ;(['jiurun', 'zhenglongxing'] as CompanyId[]).forEach((companyId) => {
    const company = state.companies[companyId]
    company.audits = []
    company.ncrs = []
    company.observations = []
    company.suggestions = []
    company.procedureRisks = []
    company.planRows = company.planRows.map((row) => ({ ...row, months: Array.from({ length: 12 }, () => null), manualOverride: false }))
  })
  state.externalAuditPrep = createDefaultPrepState(state.companySettings.jiurun.auditYear)
  return state
}

export const STORAGE_KEY = 'qms-annual-internal-audit-v14'
export const LEGACY_STORAGE_KEY_V8 = 'qms-annual-internal-audit-v8'
export const LEGACY_STORAGE_KEY_V7 = 'qms-annual-internal-audit-v7'
export const LEGACY_STORAGE_KEY_V6 = 'qms-annual-internal-audit-v6'

function stripExternalAuditDate(settings: AuditSettings): AuditSettings {
  const { externalAuditDate: _removed, ...rest } = settings as AuditSettings & { externalAuditDate?: string }
  return rest
}

function cloneSettings(settings: AuditSettings): AuditSettings {
  return {
    ...settings,
    scoringRules: { ...settings.scoringRules },
  }
}

function legacyAuditYear(base: AppState, companyId: CompanyId, fallback: number): number {
  return base.companySettings?.[companyId]?.auditYear
    ?? base.companySettings?.jiurun?.auditYear
    ?? base.settings?.auditYear
    ?? fallback
}

function migrateLegacyYearArchives(
  archives: AppState['yearArchives'] | Record<string, unknown> | undefined,
): Record<string, YearArchiveEntry> {
  if (!archives) return {}
  const next: Record<string, YearArchiveEntry> = {}
  for (const [year, entry] of Object.entries(archives)) {
    const legacy = entry as {
      settings?: AuditSettings
      companies?: Partial<Record<CompanyId, CompanyData>>
      companySettings?: Partial<Record<CompanyId, AuditSettings>>
      externalAuditPrep?: ExternalAuditPrepState
    }
    if (legacy.companySettings || !legacy.settings) {
      next[year] = {
        companies: legacy.companies ?? {},
        companySettings: legacy.companySettings ?? {},
      }
      continue
    }
    const settings = stripExternalAuditDate(cloneSettings(legacy.settings))
    next[year] = {
      companies: legacy.companies ?? {},
      companySettings: {
        jiurun: cloneSettings(settings),
        zhenglongxing: cloneSettings(settings),
      },
    }
  }
  return next
}

export function migrateToV4(raw: AppState): AppState {
  if (raw.version >= 4 && raw.externalAuditPrep) return raw
  const demo = createDemoState()
  demo.activeCompanyId = raw.activeCompanyId
  if (raw.settings) {
    const shared = stripExternalAuditDate(cloneSettings(raw.settings))
    demo.companySettings = Object.fromEntries(
      COMPANY_IDS.map((id) => [id, cloneSettings(shared)]),
    ) as Record<CompanyId, AuditSettings>
  }
  demo.companies = raw.companies
  demo.version = 7
  return migrateToV7(demo)
}

export function migrateToV5(raw: AppState): AppState {
  return migrateToV7(raw)
}

export function migrateToV6(raw: AppState): AppState {
  const defaults = createDemoState()
  const base = raw.version >= 4 && raw.externalAuditPrep ? raw : migrateToV4(raw)
  const companyAuditProfiles = base.companyAuditProfiles ?? defaults.companyAuditProfiles
  const companies = Object.fromEntries(
    (['jiurun', 'zhenglongxing'] as CompanyId[]).map((companyId) => {
      const company = base.companies[companyId] ?? defaults.companies[companyId]
      const standards = companyAuditProfiles[companyId]?.applicableStandards
        .filter((s) => s.confirmationStatus === 'confirmed')
        .map((s) => `${s.name}:${s.version}`) ?? []
      return [companyId, {
        ...company,
        audits: company.audits.map((audit) => ({
          ...audit,
          year: audit.year ?? legacyAuditYear(base, companyId, defaults.companySettings.jiurun.auditYear),
          plannedDate: audit.plannedDate ?? audit.auditDate,
          status: audit.status ?? (audit.auditDate ? '執行中' : '規劃中'),
          scope: audit.scope ?? `${audit.department}／${audit.process}`,
          criteria: audit.criteria ?? `${audit.qpCode} 與公司程序`,
          procedureVersion: audit.procedureVersion ?? companyAuditProfiles[companyId]?.auditProcedureVersion ?? '待確認',
          standardSnapshot: audit.standardSnapshot ?? standards,
          team: audit.team ?? {
            auditorPersonIds: [],
            escortPersonIds: [],
            impartialityConfirmed: false,
            impartialityNote: '',
          },
          items: audit.items.map((item) => ({ ...item, origin: item.origin ?? (item.sourceYear ? 'carryforward' : 'seed') })),
        })),
      }]
    }),
  ) as Record<CompanyId, CompanyData>

  const legacyPeople: Person[] = []
  if (!base.people && base.version < 6) {
    const addLegacy = (name: string, source: string) => {
      if (!name.trim()) return
      legacyPeople.push({ id: `legacy-${legacyPeople.length + 1}`, name, employeeNumber: '', type: 'internal', affiliations: [], qualifications: [], appointments: [], active: true, notes: `既有姓名／待配對；來源：${source}` })
    }
    addLegacy(base.companySettings?.jiurun?.leadAuditor ?? base.settings?.leadAuditor ?? '', 'leadAuditor')
    ;(['jiurun', 'zhenglongxing'] as CompanyId[]).forEach((companyId) => {
      base.companies[companyId]?.departments.forEach((department) => addLegacy(department.defaultAuditors, `${companyId}.defaultAuditors`))
      base.companies[companyId]?.audits.forEach((audit) => addLegacy(audit.auditors, `${companyId}.${audit.id}.auditors`))
    })
  }

  return {
    ...base,
    companies,
    people: base.people ?? legacyPeople,
    annualPersonnelAssignments: base.annualPersonnelAssignments ?? [],
    companyAuditProfiles,
    yearArchives: migrateLegacyYearArchives(base.yearArchives),
    version: 6,
  }
}

export function migrateToV7(raw: AppState): AppState {
  const v6 = raw.companySettings ? raw : migrateToV6(raw)
  if (v6.version >= 7 && v6.companySettings) {
    return {
      ...v6,
      companyRelationships: v6.companyRelationships ?? DEFAULT_COMPANY_RELATIONSHIPS.map((rel) => ({ ...rel })),
      externalAuditPrep: migratePrepState(v6.externalAuditPrep),
      yearArchives: migrateLegacyYearArchives(v6.yearArchives),
      prepArchives: v6.prepArchives ?? {},
      version: 7,
    }
  }

  if (v6.companySettings) {
    return {
      ...v6,
      companyRelationships: v6.companyRelationships ?? DEFAULT_COMPANY_RELATIONSHIPS.map((rel) => ({ ...rel })),
      externalAuditPrep: migratePrepState(v6.externalAuditPrep),
      yearArchives: migrateLegacyYearArchives(v6.yearArchives),
      prepArchives: v6.prepArchives ?? {},
      version: 7,
      settings: undefined,
    }
  }

  const legacySettings = v6.settings ?? createCompanySettings().jiurun
  const externalAuditDate = (legacySettings as AuditSettings & { externalAuditDate?: string }).externalAuditDate
  const sharedSettings = stripExternalAuditDate(cloneSettings(legacySettings))
  const companySettings = Object.fromEntries(
    COMPANY_IDS.map((id) => [id, cloneSettings(sharedSettings)]),
  ) as Record<CompanyId, AuditSettings>

  const prepArchives: Record<string, ExternalAuditPrepState> = { ...(v6.prepArchives ?? {}) }
  for (const [year, archive] of Object.entries(v6.yearArchives ?? {})) {
    const legacy = archive as { externalAuditPrep?: ExternalAuditPrepState }
    if (legacy.externalAuditPrep) {
      prepArchives[year] = migratePrepState(legacy.externalAuditPrep, externalAuditDate)
    }
  }

  return {
    ...v6,
    companySettings,
    companyRelationships: DEFAULT_COMPANY_RELATIONSHIPS.map((rel) => ({ ...rel })),
    externalAuditPrep: migratePrepState(v6.externalAuditPrep, externalAuditDate),
    yearArchives: migrateLegacyYearArchives(v6.yearArchives),
    prepArchives,
    version: 7,
    settings: undefined,
  }
}

export function migrateToV8(raw: AppState): AppState {
  if (raw.version >= 8 && !Array.isArray(raw.trash)) {
    throw new Error('v8 回收區資料結構不完整')
  }
  const permanentlyDeletedGeneratedRecords = raw.version >= 8
    ? raw.permanentlyDeletedGeneratedRecords
    : []
  if (!Array.isArray(permanentlyDeletedGeneratedRecords) || permanentlyDeletedGeneratedRecords.some((entry) => (
    !entry
    || (entry.kind !== 'ncr' && entry.kind !== 'observation')
    || typeof entry.recordId !== 'string'
    || (entry.companyId !== 'jiurun' && entry.companyId !== 'zhenglongxing')
    || typeof entry.year !== 'number'
    || !Number.isInteger(entry.year)
  ))) {
    throw new Error('v8 自動產生紀錄刪除索引結構不完整')
  }
  const v7 = migrateToV7(raw)
  const trash = raw.version >= 8 ? raw.trash : []
  if (!Array.isArray(trash) || !trash.every(isTrashEntry)) {
    throw new Error('回收區資料結構不完整')
  }
  return {
    ...v7,
    trash,
    permanentlyDeletedGeneratedRecords,
    version: 8,
  }
}

/** 舊版 v1 遷移（若存在） */
export function migrateV1State(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const old = raw as Record<string, unknown>
  if (old.version === 2 && old.companies) return raw as AppState
  if (!old.departments || !old.settings) return null

  const demo = createBlankState()
  // A v1 payload represents imported user data; never let demo refresh replace or add records.
  demo.dataSource = 'user'
  demo.activeCompanyId = 'jiurun'
  demo.companies.zhenglongxing = {
    ...demo.companies.zhenglongxing,
    name: '',
    keyCustomerName: '',
    departments: [],
    planRows: [],
    audits: [],
    ncrs: [],
    observations: [],
    suggestions: [],
    procedureRisks: [],
  }
  const legacySettings = old.settings as Partial<AuditSettings> & { externalAuditDate?: string }
  const merged = {
    ...demo.companySettings.jiurun,
    ...legacySettings,
    scoringRules: { ...demo.companySettings.jiurun.scoringRules, ...legacySettings.scoringRules },
  }
  if (legacySettings.externalAuditDate) {
    demo.externalAuditPrep.externalAuditDate = legacySettings.externalAuditDate
  }
  demo.companySettings = Object.fromEntries(
    COMPANY_IDS.map((id) => [id, { ...merged, scoringRules: { ...merged.scoringRules } }]),
  ) as Record<CompanyId, AuditSettings>
  const company = demo.companies.jiurun
  company.departments = old.departments as CompanyData['departments']
  company.planRows = Array.isArray(old.planRows) ? old.planRows as CompanyData['planRows'] : []
  if (Array.isArray(old.audits)) {
    company.audits = (old.audits as Array<Record<string, unknown>>).map((a) => ({
      ...a,
      qpCode: (a.qpCode as string) ?? 'QP-01',
      auditCategory: (a.auditCategory as string) ?? '系統稽核',
      items: ((a.items as Array<Record<string, unknown>>) ?? []).map((item) => ({
        ...item,
        category: (item.category as string) ?? '一般',
      })),
    })) as CompanyData['audits']
  }
  company.ncrs = Array.isArray(old.ncrs) ? old.ncrs as CompanyData['ncrs'] : []
  company.observations = Array.isArray(old.observations) ? old.observations as CompanyData['observations'] : []
  return demo
}

export { getProcedureTitle }
