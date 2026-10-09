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

/**
 * 各 QP 的固定程序類型（使用者 2026-10-10 逐項確認）；以 QP 為鍵，不分部門。
 * QR-28-04／QR-28-05 為查檢表單，不列入。未列於此者不提示建議關聯。
 */
export const QP_PROCESS_TYPES: Readonly<Record<string, readonly ProcessType[]>> = {
  'QP-01': ['management'],
  'QP-02': ['management'],
  'QP-03': ['management'],
  'QP-04': ['equipment'],
  'QP-05': ['equipment'],
  'QP-06': ['management'],
  'QP-07': ['management'],
  'QP-08': ['document'],
  'QP-09': ['document'],
  'QP-10': ['design'],
  'QP-11': ['design'],
  'QP-12': ['quality'],
  'QP-13': ['management'],
  'QP-14': ['design'],
  'QP-15': ['design', 'purchasing'],
  'QP-16': ['quality'],
  'QP-17': ['purchasing'],
  'QP-18': ['purchasing'],
  'QP-19': ['quality'],
  'QP-20': ['production'],
  'QP-21': ['production'],
  'QP-22': ['management'],
  'QP-23': ['production'],
  'QP-24': ['production'],
  'QP-25': ['quality'],
  'QP-26': ['quality'],
  'QP-27': ['quality'],
  'QP-28': ['management'],
}

export function processTypesFor(qpCode: string): readonly ProcessType[] {
  return QP_PROCESS_TYPES[qpCode] ?? []
}

/** 依固定程序類型判斷是否為此來源類別的建議關聯對象；未列入者不提示。 */
export function isSuggestedTarget(qpCode: string, kind: RiskSourceKind): boolean {
  return processTypesFor(qpCode).some((type) => PROCESS_TYPE_DEFINITIONS[type].watchedKinds.includes(kind))
}
