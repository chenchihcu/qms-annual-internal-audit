import type { ChecklistItem, SharedChecklistQuestion } from '../types'
import seed from './checklists.seed.json'

export interface SeedCategory {
  name: string
  items: Array<{ no: number; content: string }>
}

export interface SeedProcedure {
  title: string
  categories: SeedCategory[]
  _pending?: boolean
  sheet?: string
  department?: string
  supervisor?: string
  procedureCode?: string
  supplemented?: boolean
  supplementReason?: string
}

export interface FocusLegendRow {
  sheet: string
  riskLevel: '高' | '中' | '低'
  department: string
  owner: string
  itemCountHint: string
}

export const CHECKLIST_SEED = seed as {
  version: string
  year: number
  note?: string
  import?: {
    source: string
    status: 'in_progress' | 'complete'
    chunksReceived: number
    totalChunks: number
    finalized: boolean
  }
  proceduresRaw?: unknown[]
  procedures: Record<string, SeedProcedure>
  supplements: Record<string, unknown>
  processAudits: Record<string, { title: string; department: string; itemCount: number }>
  configAudits: Record<string, { title: string; department: string; itemCount: number }>
  focusLegend?: FocusLegendRow[]
}

export function procedureSeedKey(qpCode: string, department: string): string {
  return `${qpCode}|${department}`
}

/** 部門主檔名稱與查檢種子 procedures 鍵不一致時的對照（與 procedurePlan DEPT_ID 語意一致） */
const DEPARTMENT_SEED_ALIASES: Record<string, string> = {
  開發工程: '開發工程部',
}

export function normalizeDepartmentForSeedLookup(department?: string): string | undefined {
  if (!department) return department
  const trimmed = department.trim()
  return DEPARTMENT_SEED_ALIASES[trimmed] ?? trimmed
}

function departmentSeedLookupCandidates(department?: string): string[] {
  if (!department) return []
  const trimmed = department.trim()
  const normalized = normalizeDepartmentForSeedLookup(trimmed) ?? trimmed
  const out: string[] = []
  for (const name of [trimmed, normalized]) {
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

export function isSeedFinalized(): boolean {
  return CHECKLIST_SEED.import?.finalized ?? true
}

export function seedImportProgress(): string | null {
  const imp = CHECKLIST_SEED.import
  if (!imp || imp.finalized) return null
  return `種子資料匯入中 ${imp.chunksReceived}/${imp.totalChunks}`
}

export function resolveProcedureSeed(
  qpCode: string,
  department?: string,
): SeedProcedure | undefined {
  for (const dep of departmentSeedLookupCandidates(department)) {
    const composite = CHECKLIST_SEED.procedures[procedureSeedKey(qpCode, dep)]
    if (composite && !composite._pending) return composite
  }
  const direct = CHECKLIST_SEED.procedures[qpCode]
  if (direct && !direct._pending) return direct
  for (const dep of departmentSeedLookupCandidates(department)) {
    const match = Object.values(CHECKLIST_SEED.procedures).find(
      (p) => p.procedureCode === qpCode && p.department === dep && !p._pending,
    )
    if (match) return match
  }
  return undefined
}

export function getFocusLegend(): FocusLegendRow[] {
  return CHECKLIST_SEED.focusLegend ?? []
}

export function getProceduresRaw(): Array<{
  sheet: string
  procedureCode: string
  department: string
  procedureName: string
  items: unknown[]
}> {
  return (CHECKLIST_SEED.proceduresRaw ?? []) as Array<{
    sheet: string
    procedureCode: string
    department: string
    procedureName: string
    items: unknown[]
  }>
}

export function getSeedStats() {
  const raw = (CHECKLIST_SEED.proceduresRaw ?? []) as Array<{ procedureCode: string; items: unknown[] }>
  const qpCodes = new Set(raw.map((p) => p.procedureCode))
  const systemItems = raw.reduce((s, p) => s + p.items.length, 0)
  const processItems = CHECKLIST_SEED.processAudits['QR-28-04']?.itemCount ?? 0
  const configItems = CHECKLIST_SEED.configAudits['QR-28-05']?.itemCount ?? 0
  return {
    procedureEntries: raw.length,
    uniqueQpCodes: qpCodes.size,
    qpCoverage: qpCodes.size,
    qpTotal: 28,
    systemItems,
    processItems,
    configItems,
    totalItems: systemItems + processItems + configItems,
    focusRows: getFocusLegend().length,
  }
}

export function listProcedureCodes(): string[] {
  const codes = new Set<string>()
  for (const proc of Object.values(CHECKLIST_SEED.procedures)) {
    if (proc._pending) continue
    if (proc.procedureCode) codes.add(proc.procedureCode)
  }
  return [...codes].filter(Boolean).sort()
}

export function getProcedureTitle(qpCode: string, department?: string): string {
  return resolveProcedureSeed(qpCode, department)?.title ?? qpCode
}

export function getSeedChecklistQuestions(
  qpCode: string,
  department?: string,
): SharedChecklistQuestion[] {
  const proc = resolveProcedureSeed(qpCode, department)
  return proc?.categories.flatMap((category) =>
    category.items.map((item) => ({
      category: category.name,
      no: item.no,
      content: item.content,
    })),
  ) ?? []
}

export function createChecklistForProcedure(
  qpCode: string,
  department?: string,
  sharedQuestions?: SharedChecklistQuestion[],
): ChecklistItem[] {
  const questions = sharedQuestions ?? getSeedChecklistQuestions(qpCode, department)
  if (questions.length === 0) {
    const progress = seedImportProgress()
    return [
      {
        id: `chk-${qpCode}-empty-${Date.now()}`,
        category: '待匯入',
        no: 1,
        content: progress
          ? `（${qpCode}${department ? `·${department}` : ''} 查檢項目待匯入：${progress}）`
          : `（${qpCode} 查檢項目待匯入）`,
        judgment: null,
        description: '',
        procedureRef: qpCode,
      },
    ]
  }

  const items: ChecklistItem[] = []
  questions.forEach((question, index) => {
      items.push({
        id: `chk-${qpCode}-${index + 1}-${Date.now()}`,
        category: question.category,
        no: question.no,
        content: question.content,
        judgment: null,
        description: '',
        procedureRef: qpCode,
      })
  })
  return items
}

export function countChecklistItems(qpCode: string, department?: string): number {
  const proc = resolveProcedureSeed(qpCode, department)
  if (!proc) return 0
  return proc.categories.reduce((sum, c) => sum + c.items.length, 0)
}

function checklistItemHasUserWork(item: ChecklistItem): boolean {
  if (item.judgment) return true
  if (item.description?.trim()) return true
  if (item.objectiveEvidence?.trim()) return true
  if (item.evidenceReference?.trim()) return true
  if (item.notApplicableReason?.trim()) return true
  if (item.attachments?.length) return true
  if (item.origin === 'custom' || item.origin === 'carryforward') return true
  return false
}

/** 僅含未填寫的「待匯入」占位、可安全以種子題目取代 */
export function isPendingImportOnlyAudit(items: ChecklistItem[]): boolean {
  if (items.length === 0) return false
  return items.every((item) => item.category === '待匯入' && !checklistItemHasUserWork(item))
}

export function refreshedSeedItemsIfPendingOnly(
  qpCode: string,
  department: string | undefined,
  items: ChecklistItem[],
): ChecklistItem[] | null {
  if (!isPendingImportOnlyAudit(items)) return null
  const seedItems = createChecklistForProcedure(qpCode, department)
  if (seedItems.length === 1 && seedItems[0].category === '待匯入') return null
  return seedItems.map((item) => ({ ...item, origin: 'seed' as const }))
}

export interface ChecklistSeedDiagnosis {
  pendingImportOnly: boolean
  seedResolved: boolean
  departmentCandidates: string[]
  seedImportInProgress: string | null
  advisory: string
}

/** 查檢「待匯入」占位時的種子／別名診斷（不修改快照） */
export function diagnoseChecklistSeed(
  qpCode: string,
  department: string | undefined,
  items: ChecklistItem[],
): ChecklistSeedDiagnosis {
  const departmentCandidates = departmentSeedLookupCandidates(department)
  const seedResolved = Boolean(resolveProcedureSeed(qpCode, department))
  const pendingImportOnly = isPendingImportOnlyAudit(items)
  const seedImportInProgress = seedImportProgress()
  const parts: string[] = []
  if (seedImportInProgress) {
    parts.push(`種子資料 ${seedImportInProgress}，完成前可能仍顯示占位。`)
  }
  if (pendingImportOnly && !seedResolved) {
    parts.push(
      `尚未解析到種子題目（QP ${qpCode}）。已嘗試部門鍵：${
        departmentCandidates.length > 0 ? departmentCandidates.join('、') : '（未提供部門）'
      }。請核對部門主檔名稱與種子別名，勿直接判定種子未上傳。`,
    )
  } else if (items.some((item) => item.category === '待匯入')) {
    parts.push('部分列仍為待匯入占位；若已填寫判定或證據，系統不會自動覆寫快照。')
  }
  if (parts.length === 0) {
    parts.push('查檢項目待確認：請核對部門別名與種子狀態。')
  }
  return {
    pendingImportOnly,
    seedResolved,
    departmentCandidates,
    seedImportInProgress,
    advisory: parts.join(' '),
  }
}
