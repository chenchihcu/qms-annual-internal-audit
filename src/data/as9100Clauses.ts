/** AS9100D 條款摘要（非完整標準全文，供對照查詢） */
export interface As9100ClauseEntry {
  id: string
  clause: string
  title: string
  category: string
}

export const AS9100_CLAUSE_SEED: As9100ClauseEntry[] = [
  { id: 'c-4', clause: '4', title: '組織環境', category: '情境' },
  { id: 'c-4.1', clause: '4.1', title: '組織及其環境', category: '情境' },
  { id: 'c-4.2', clause: '4.2', title: '相關方需求', category: '情境' },
  { id: 'c-5', clause: '5', title: '領導', category: '領導' },
  { id: 'c-5.1', clause: '5.1', title: '領導與承諾', category: '領導' },
  { id: 'c-5.2', clause: '5.2', title: '品質方針', category: '領導' },
  { id: 'c-6', clause: '6', title: '規劃', category: '規劃' },
  { id: 'c-6.1', clause: '6.1', title: '風險與機會', category: '規劃' },
  { id: 'c-7', clause: '7', title: '支援', category: '支援' },
  { id: 'c-7.1', clause: '7.1', title: '資源', category: '支援' },
  { id: 'c-7.1.5', clause: '7.1.5', title: '監視與量測資源', category: '支援' },
  { id: 'c-7.2', clause: '7.2', title: '能力', category: '支援' },
  { id: 'c-7.5', clause: '7.5', title: '文件化資訊', category: '支援' },
  { id: 'c-8', clause: '8', title: '運作', category: '運作' },
  { id: 'c-8.1', clause: '8.1', title: '運作規劃與管制', category: '運作' },
  { id: 'c-8.2', clause: '8.2', title: '產品與服務要求', category: '運作' },
  { id: 'c-8.4', clause: '8.4', title: '外部提供之流程、產品與服務', category: '運作' },
  { id: 'c-8.5', clause: '8.5', title: '生產與服務提供', category: '運作' },
  { id: 'c-8.5.1', clause: '8.5.1', title: '生產與服務提供之管制', category: '運作' },
  { id: 'c-8.5.2', clause: '8.5.2', title: '產品與服務之識別與追溯', category: '運作' },
  { id: 'c-8.5.3', clause: '8.5.3', title: '顧客或外部供應者財產', category: '運作' },
  { id: 'c-8.5.4', clause: '8.5.4', title: '保存', category: '運作' },
  { id: 'c-8.5.5', clause: '8.5.5', title: '交付後活動', category: '運作' },
  { id: 'c-8.5.6', clause: '8.5.6', title: '變更管制', category: '運作' },
  { id: 'c-8.6', clause: '8.6', title: '產品與服務之放行', category: '運作' },
  { id: 'c-8.7', clause: '8.7', title: '不合格輸出之管制', category: '運作' },
  { id: 'c-9', clause: '9', title: '績效評估', category: '績效' },
  { id: 'c-9.1', clause: '9.1', title: '監視、量測、分析與評估', category: '績效' },
  { id: 'c-9.2', clause: '9.2', title: '內部稽核', category: '績效' },
  { id: 'c-9.3', clause: '9.3', title: '管理審查', category: '績效' },
  { id: 'c-10', clause: '10', title: '改善', category: '改善' },
  { id: 'c-10.2', clause: '10.2', title: '不符合與矯正措施', category: '改善' },
]

export function findClauseEntry(clause: string): As9100ClauseEntry | undefined {
  const normalized = clause.trim()
  if (!normalized) return undefined

  const exact = AS9100_CLAUSE_SEED.find((e) => e.clause === normalized)
  if (exact) return exact

  const candidates = AS9100_CLAUSE_SEED.filter(
    (e) => normalized.startsWith(`${e.clause}.`) || e.clause.startsWith(`${normalized}.`),
  ).sort((a, b) => b.clause.length - a.clause.length)

  return candidates[0]
}
