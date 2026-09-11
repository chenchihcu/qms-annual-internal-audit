import type { SeedCategory, SeedProcedure } from './checklistLoader'

export interface SeedImportMeta {
  source: string
  status: 'in_progress' | 'complete'
  chunksReceived: number
  totalChunks: number
  finalized: boolean
}

export interface RawSeedProcedure {
  sheet: string
  department: string
  procedureCode: string
  procedureName: string
  supervisor: string
  items: Array<{ no: number; category: string; content: string }>
}

export function rawProcedureToSeed(proc: RawSeedProcedure): SeedProcedure & {
  sheet?: string
  department?: string
  supervisor?: string
} {
  const catMap = new Map<string, Array<{ no: number; content: string }>>()
  for (const item of proc.items) {
    const list = catMap.get(item.category) ?? []
    list.push({ no: item.no, content: item.content })
    catMap.set(item.category, list)
  }
  const categories: SeedCategory[] = [...catMap.entries()].map(([name, items]) => ({
    name,
    items,
  }))
  return {
    title: proc.procedureName,
    sheet: proc.sheet,
    department: proc.department,
    supervisor: proc.supervisor,
    categories,
  }
}

export function countItemsInRaw(procedures: RawSeedProcedure[]): number {
  return procedures.reduce((sum, p) => sum + p.items.length, 0)
}
