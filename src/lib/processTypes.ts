import type { ProcessType, RiskSourceKind } from '../types'

export interface ProcessTypeDefinition {
  label: string
  /** 主要關注的風險來源（範例，使用者提供）；用來引導事件關聯，不限制其他事件。 */
  concerns: string[]
  /** 目前可登錄的來源類別中，此類型程序應優先檢視是否關聯者。 */
  watchedKinds: RiskSourceKind[]
}

export const PROCESS_TYPES: ProcessType[] = ['design', 'purchasing', 'production', 'quality', 'equipment', 'document', 'management']

export const PROCESS_TYPE_DEFINITIONS: Record<ProcessType, ProcessTypeDefinition> = {
  design: { label: '設計開發', concerns: ['設計異常', '設計變更', '客訴', '稽核缺失'], watchedKinds: ['customer_complaint', 'major_change'] },
  purchasing: { label: '採購／供應商管理', concerns: ['供應商異常', '重大來料問題', '供應商變更', '稽核缺失'], watchedKinds: ['major_change'] },
  production: { label: '生產製造', concerns: ['製程異常', '客訴', '製程變更', '稽核缺失'], watchedKinds: ['customer_complaint', 'major_change'] },
  quality: { label: '品質管理', concerns: ['產品逃逸', '檢驗有效性', '客訴', '稽核缺失'], watchedKinds: ['customer_complaint'] },
  equipment: { label: '設備管理', concerns: ['設備異常', '保養失效', '校驗問題', '稽核缺失'], watchedKinds: [] },
  document: { label: '文件管理', concerns: ['文件失效', '變更控制問題', '稽核缺失'], watchedKinds: ['major_change'] },
  management: { label: '管理系統／其他', concerns: ['稽核缺失'], watchedKinds: [] },
}

export function processTypeKey(qpCode: string, departmentId: string): string {
  return `${qpCode}|${departmentId}`
}

/** 依程序類型判斷是否為此來源類別的建議關聯對象；未分類者不提示。 */
export function isSuggestedTarget(
  types: Partial<Record<string, ProcessType>> | undefined,
  qpCode: string,
  departmentId: string,
  kind: RiskSourceKind,
): boolean {
  const type = types?.[processTypeKey(qpCode, departmentId)]
  return type != null && PROCESS_TYPE_DEFINITIONS[type].watchedKinds.includes(kind)
}
