import { applyCertificateScopeToItem } from '../lib/certificateScope'
import type { ChecklistItem } from '../types'
import seed from './checklists.seed.json'

export interface SeedCategory {
  name: string
  items: Array<{ no: number; content: string; as9100Clauses?: string[] }>
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

export function createChecklistForProcedure(
  qpCode: string,
  department?: string,
): ChecklistItem[] {
  const proc = resolveProcedureSeed(qpCode, department)
  if (!proc || proc.categories.length === 0) {
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
  let globalNo = 1
  for (const cat of proc.categories) {
    for (const item of cat.items) {
      const base: ChecklistItem = {
        id: `chk-${qpCode}-${globalNo}-${Date.now()}`,
        category: cat.name,
        no: item.no,
        content: item.content,
        judgment: null,
        description: '',
        procedureRef: qpCode,
        as9100Clauses: item.as9100Clauses,
        origin: 'seed',
      }
      items.push(applyCertificateScopeToItem(base, qpCode, department))
      globalNo++
    }
  }
  return items
}

/** 將種子新增題合併進既有查檢列（以 category+no 辨識） */
export function mergeChecklistWithSeed(
  existing: ChecklistItem[],
  qpCode: string,
  department?: string,
): ChecklistItem[] {
  const seedItems = createChecklistForProcedure(qpCode, department)
  const key = (item: Pick<ChecklistItem, 'category' | 'no'>) => `${item.category}|${item.no}`
  const seen = new Set(existing.map(key))
  const merged = [...existing]
  for (const seed of seedItems) {
    if (seen.has(key(seed))) continue
    merged.push(
      applyCertificateScopeToItem(
        {
          ...seed,
          id: `chk-${qpCode}-seed-${seed.no}-${seed.category}`,
          judgment: null,
          description: '',
          origin: 'seed',
        },
        qpCode,
        department,
      ),
    )
    seen.add(key(seed))
  }
  return merged.sort((a, b) => a.no - b.no)
}

export function countChecklistItems(qpCode: string, department?: string): number {
  const proc = resolveProcedureSeed(qpCode, department)
  if (!proc) return 0
  return proc.categories.reduce((sum, c) => sum + c.items.length, 0)
}
