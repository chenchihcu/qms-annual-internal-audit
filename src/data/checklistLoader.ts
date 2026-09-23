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
  if (department) {
    const composite = CHECKLIST_SEED.procedures[procedureSeedKey(qpCode, department)]
    if (composite && !composite._pending) return composite
  }
  const direct = CHECKLIST_SEED.procedures[qpCode]
  if (direct && !direct._pending) return direct
  if (department) {
    const match = Object.values(CHECKLIST_SEED.procedures).find(
      (p) => p.procedureCode === qpCode && p.department === department && !p._pending,
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
