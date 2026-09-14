import type { AppState, CompanyData, CompanyId, PlanRow, ProcedureAudit } from '../types'
import { COMPANY_LABELS, DEFAULT_SCORING_RULES } from '../types'
import { carryPlanDatesToAudit } from '../lib/auditDates'
import { autoArrangePlan } from '../lib/planner'
import { createDefaultPrepState } from '../lib/externalAuditPrep'
import { normalizeNCRList } from '../lib/ncr'
import { createChecklistForProcedure } from './checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE } from './procedurePlan'
import { getProcedureTitle } from './checklistLoader'

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

const settings = {
  auditYear: 2026,
  leadAuditor: '王大明',
  yearStart: '2026-01-01',
  planWindowStart: '2026-02-01',
  planWindowEnd: '2026-11-30',
  externalAuditDate: '2026-09-15',
  managementReviewDate: '2026-12-10',
  scoringRules: DEFAULT_SCORING_RULES,
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
  const dept = departments.find((d) => d.id === departmentId)
  if (!dept) {
    throw new Error(`demoData: unknown departmentId ${departmentId}`)
  }
  const entry =
    PROCEDURE_PLAN_TEMPLATE.find(
      (e) => e.qpCode === qpCode && e.departmentId === departmentId,
    ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === qpCode)
  if (!entry) {
    throw new Error(`demoData: no plan entry for ${qpCode} / ${departmentId}`)
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
    id: `audit-${qpCode}-${departmentId}`,
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
    items,
  }
}

function syncAuditsWithPlan(planRows: PlanRow[], audits: ProcedureAudit[]): ProcedureAudit[] {
  const planByKey = new Map(planRows.map((row) => [`${row.qpCode}|${row.departmentId}`, row]))
  return audits.map((audit) => {
    const row = planByKey.get(`${audit.qpCode}|${audit.departmentId}`)
    return row ? carryPlanDatesToAudit(row, audit, settings.auditYear) : audit
  })
}

function applyDemoImpartialityConflicts(planRows: PlanRow[], companyId: CompanyId): PlanRow[] {
  const conflictQp = companyId === 'jiurun' ? 'QP-16' : 'QP-05'
  const conflictDeptId = 'dept-qa'
  const dept = departments.find((d) => d.id === conflictDeptId)
  if (!dept) return planRows

  return planRows.map((row) =>
    row.qpCode === conflictQp && row.departmentId === conflictDeptId
      ? { ...row, auditors: dept.owner }
      : row,
  )
}

function createCompanyData(companyId: CompanyId): CompanyData {
  const companySuffix = companyId === 'jiurun' ? 'jiurun' : 'zlx'

  if (companyId === 'jiurun') {
    let planRows = autoArrangePlan(
      {
        departments,
        planEntries: PROCEDURE_PLAN_TEMPLATE,
        auditYear: settings.auditYear,
        planWindowStart: settings.planWindowStart,
        planWindowEnd: settings.planWindowEnd,
        managementReviewDate: settings.managementReviewDate,
        openCarryForwardCount: 2,
      },
      { leadAuditor: settings.leadAuditor },
    )
    planRows = applyDemoImpartialityConflicts(planRows, companyId)

    let audits = [
      buildAudit('QP-28', 'dept-qa', [{ no: 1, judgment: '符合' }], {
        fullyJudged: true,
        withEvidence: true,
      }),
      buildAudit('QP-16', 'dept-qa', [
        {
          no: 1,
          judgment: '不符',
          description: '不合格品隔離區標示不完整',
          objectiveEvidence: '現場巡檢紀錄',
        },
      ]),
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
          status: 'open',
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
          status: 'open',
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
          status: 'open',
        },
        {
          id: `sug-2025-2-${companySuffix}`,
          year: 2025,
          procedure: 'QP-09',
          issue: '合約審查紀錄缺少客戶特殊要求欄位',
          progress: '表單已修訂，舊案補登中',
          responsibleUnit: '業務部',
          status: 'open',
        },
      ],
    }
  }

  let planRows = autoArrangePlan(
    {
      departments,
      planEntries: PROCEDURE_PLAN_TEMPLATE,
      auditYear: settings.auditYear,
      planWindowStart: settings.planWindowStart,
      planWindowEnd: settings.planWindowEnd,
      managementReviewDate: settings.managementReviewDate,
      openCarryForwardCount: 0,
    },
    { leadAuditor: settings.leadAuditor },
  )
  planRows = applyDemoImpartialityConflicts(planRows, companyId)

  let audits = [
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
        status: 'open',
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
        status: 'open',
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

  const prep = createDefaultPrepState(settings.auditYear)
  prep.internalAuditCompleteOverride = true
  prep.items[0].jiurunDone = true
  prep.items[0].zhenglongxingDone = true

  return {
    activeCompanyId: 'jiurun',
    settings,
    companies,
    externalAuditPrep: prep,
    dataSource: 'demo',
    version: 12,
  }
}

export const STORAGE_KEY = 'qms-annual-internal-audit-v9'

function migrateCompanyNcrs(company: CompanyData): CompanyData {
  return {
    ...company,
    ncrs: normalizeNCRList(company.ncrs),
  }
}

export function migrateToV6(raw: AppState): AppState {
  if (raw.version >= 6) {
    return {
      ...raw,
      companies: {
        jiurun: migrateCompanyNcrs(raw.companies.jiurun),
        zhenglongxing: migrateCompanyNcrs(raw.companies.zhenglongxing),
      },
      dataSource: raw.dataSource,
    }
  }
  const prep = raw.externalAuditPrep
  const migratedPrep = {
    ...prep,
    internalAuditCompleteOverride:
      prep.internalAuditCompleteOverride ??
      (prep.internalAuditComplete === true ? true : undefined),
  }
  const { internalAuditComplete: _legacy, ...prepWithoutLegacy } = migratedPrep as AppState['externalAuditPrep'] & {
    internalAuditComplete?: boolean
  }
  return {
    ...raw,
    companies: {
      jiurun: migrateCompanyNcrs(raw.companies.jiurun),
      zhenglongxing: migrateCompanyNcrs(raw.companies.zhenglongxing),
    },
    externalAuditPrep: prepWithoutLegacy,
    dataSource: raw.dataSource,
    version: 6,
  }
}

export function migrateToV7(raw: AppState): AppState {
  const base =
    raw.version >= 6
      ? migrateToV6(raw)
      : raw.version >= 4 && raw.externalAuditPrep
        ? migrateToV6(raw)
        : raw.companies
          ? migrateToV4(raw)
          : raw
  return {
    ...base,
    dataSource: base.dataSource ?? 'user',
    version: 7,
  }
}

export function migrateToV4(raw: AppState): AppState {
  if (raw.version >= 6 && raw.externalAuditPrep) return migrateToV6(raw)
  if (raw.version >= 5 && raw.externalAuditPrep) return migrateToV6(raw)
  const demo = createDemoState()
  demo.activeCompanyId = raw.activeCompanyId
  demo.settings = raw.settings
  demo.companies = {
    jiurun: migrateCompanyNcrs(raw.companies.jiurun),
    zhenglongxing: migrateCompanyNcrs(raw.companies.zhenglongxing),
  }
  demo.dataSource = 'user'
  return demo
}

export { migrateState } from '../lib/migrate'

/** 舊版 v1 遷移（若存在） */
export function migrateV1State(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const old = raw as Record<string, unknown>
  if (old.version === 2 && old.companies) return raw as AppState
  if (!old.departments || !old.settings) return null

  const demo = createDemoState()
  demo.activeCompanyId = 'jiurun'
  const company = demo.companies.jiurun
  company.departments = old.departments as CompanyData['departments']
  if (old.planRows) company.planRows = old.planRows as CompanyData['planRows']
  if (old.audits) {
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
  if (old.ncrs) company.ncrs = normalizeNCRList(old.ncrs as CompanyData['ncrs'])
  if (old.observations) company.observations = old.observations as CompanyData['observations']
  return demo
}

export { getProcedureTitle }
