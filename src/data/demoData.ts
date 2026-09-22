import type { AppState, CompanyData, LegacyV5AppState } from '../types'
import { DUAL_COMPANY_LABEL, DEFAULT_SCORING_RULES } from '../types'
import { autoArrangePlan } from '../lib/planner'
import { createDefaultPrepState } from '../lib/externalAuditPrep'
import { createChecklistForProcedure } from './checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE } from './procedurePlan'
import { getProcedureTitle } from './checklistLoader'
import { migrateV5ToV6 } from '../lib/migrateToV6'

const departments = [
  {
    id: 'dept-admin',
    name: '管理部',
    owner: '周瑞婷',
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
    owner: '周瑞婷',
    auditUnit: '品保部',
    defaultAuditors: '李稽核',
    stakeholders: ['客戶', '經營層'] as const,
    riskOccurrence: 3,
    riskSeverity: 3,
  },
  {
    id: 'dept-eng',
    name: '開發工程',
    owner: '劉尚榤',
    auditUnit: '品保部',
    defaultAuditors: '李稽核',
    stakeholders: ['客戶', '法規/認證'] as const,
    riskOccurrence: 3,
    riskSeverity: 4,
  },
  {
    id: 'dept-qa',
    name: '品保部',
    owner: '陳智富',
    auditUnit: '管理部',
    defaultAuditors: '王稽核',
    stakeholders: ['客戶', '法規/認證', '供應商'] as const,
    riskOccurrence: 2,
    riskSeverity: 5,
  },
  {
    id: 'dept-prod',
    name: '生產製造部',
    owner: '陳志嘉',
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
  managementReviewDate: '2026-08-01',
  scoringRules: DEFAULT_SCORING_RULES,
}

function buildAudit(
  qpCode: string,
  departmentId: string,
  partialItems: Array<{ no: number; judgment: '符合' | '不符' | '觀察' | '不適用'; description?: string }>,
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
    }
  })
  return {
    id: `audit-${qpCode}-${departmentId}`,
    qpCode,
    departmentId,
    department: dept.name,
    process: entry.process,
    documents: entry.documents,
    notifyDate: '2026-03-01',
    auditDate: '2026-03-15',
    departmentManager: dept.owner,
    auditors: dept.defaultAuditors,
    auditCategory: entry.auditCategory,
    items,
  }
}

function createCompanyData(): CompanyData {
  const planRows = autoArrangePlan(
    {
      departments,
      planEntries: PROCEDURE_PLAN_TEMPLATE,
      auditYear: settings.auditYear,
      planWindowStart: settings.planWindowStart,
      planWindowEnd: settings.planWindowEnd,
      managementReviewDate: settings.managementReviewDate,
      externalAuditDate: settings.externalAuditDate,
      openCarryForwardCount: 2,
    },
    { leadAuditor: settings.leadAuditor },
  )

  const audits = [
    buildAudit('QP-28', 'dept-qa', [{ no: 1, judgment: '符合' }]),
    buildAudit('QP-16', 'dept-qa', [
      { no: 1, judgment: '不符', description: '不合格品隔離區標示不完整' },
    ]),
    buildAudit('QP-20', 'dept-admin', [{ no: 1, judgment: '符合' }]),
  ]

  const ncrs = [
    {
      id: 'ncr-demo-1',
      ncrNumber: 'NCR-2026-001',
      qpCode: 'QP-16',
      departmentId: 'dept-qa',
      department: '品保部',
      process: '製程/最終檢驗',
      description: '不合格品隔離區標示不完整',
      date: '2026-03-15',
      status: '矯正中' as const,
      checklistItemId: audits[1].items.find((i) => i.judgment === '不符')?.id,
      companyScope: 'both' as const,
    },
  ]

  return {
    name: DUAL_COMPANY_LABEL,
    departments,
    planRows,
    audits,
    ncrs,
    observations: [
      {
        id: 'obs-2025-1',
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
        id: 'obs-2025-2',
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
        id: 'sug-2025-1',
        year: 2025,
        procedure: 'QP-18',
        issue: '部分量測設備校正標籤資訊不完整',
        progress: '已通知各單位補貼，待複查',
        responsibleUnit: '品保部',
        status: 'open' as const,
      },
      {
        id: 'sug-2025-2',
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

export function createDemoState(): AppState {
  const prep = createDefaultPrepState(settings.auditYear)

  return {
    settings,
    company: createCompanyData(),
    externalAuditPrep: prep,
    version: 6,
  }
}

export const STORAGE_KEY = 'qms-annual-internal-audit-v6'

export function migrateToV4(raw: LegacyV5AppState | AppState): AppState {
  if (raw.version >= 6 && 'company' in raw && raw.company) return raw as AppState
  return migrateV5ToV6(raw as LegacyV5AppState)
}

/** 舊版 v1 遷移（若存在） */
export function migrateV1State(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const old = raw as Record<string, unknown>
  if ((old.version as number) >= 6 && old.company) return raw as AppState
  if (old.version === 2 && old.companies) return migrateV5ToV6(raw as LegacyV5AppState)
  if (!old.departments || !old.settings) return null

  const demo = createDemoState()
  const company = demo.company
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
  if (old.ncrs) company.ncrs = old.ncrs as CompanyData['ncrs']
  if (old.observations) company.observations = old.observations as CompanyData['observations']
  return demo
}

export { getProcedureTitle }
