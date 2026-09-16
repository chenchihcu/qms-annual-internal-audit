import type { TabId } from '../types'

export interface TabEntry {
  id: TabId
  label: string
  /** Each workflow page owns one semantic form and one sidebar item. */
  formId?: string
}

export interface TabGroup {
  label: string
  tabs: TabEntry[]
}

export const TAB_GROUPS: TabGroup[] = [
  {
    label: '總覽',
    tabs: [{ id: 'dashboard', label: '稽核總覽' }],
  },
  {
    label: '0 · 受控準則與程序',
    tabs: [
      { id: 'standard', label: '標準', formId: 'standards-form' },
      { id: 'procedure', label: '程序', formId: 'procedure-settings-form' },
    ],
  },
  {
    label: '1 · 稽核方案管理',
    tabs: [
      { id: 'plan', label: '年度稽核計畫', formId: 'annual-plan-form' },
      { id: 'risk', label: '方案風險與優先順序', formId: 'risk-assessment-form' },
    ],
  },
  {
    label: '2 · 稽核資源與準備',
    tabs: [
      { id: 'personnel', label: '稽核員能力與任命', formId: 'personnel-form' },
      { id: 'prep', label: '稽核啟動與活動準備', formId: 'pre-audit-prep-form' },
    ],
  },
  {
    label: '3 · 稽核活動執行',
    tabs: [{ id: 'audit', label: '稽核執行與證據', formId: 'procedure-audit-form' }],
  },
  {
    label: '4 · 稽核結果與改善',
    tabs: [
      { id: 'ncr', label: '不符合與矯正措施', formId: 'ncr-form' },
      { id: 'observations', label: '觀察事項與追蹤', formId: 'observations-form' },
      { id: 'suggestions', label: '改善機會與建議', formId: 'suggestions-form' },
    ],
  },
  {
    label: '系統管理',
    tabs: [{ id: 'system-settings', label: '系統設定', formId: 'system-settings-form' }],
  },
]

export const ALL_TABS: TabEntry[] = TAB_GROUPS.flatMap((g) => g.tabs)

export interface TabWorkflow {
  id: TabId
  label: string
  purpose: string
  entry: string
  exit: string
  outputs: string
  prevTab?: TabId
  nextTab?: TabId
}

/** Single source of truth for page purpose, entry/exit, and prev/next navigation. */
export const TAB_WORKFLOW: TabWorkflow[] = [
  {
    id: 'dashboard',
    label: '稽核總覽',
    purpose: '掌握年度進度、待處理缺口，並導向對應表單。',
    entry: '開啟系統或點選首頁',
    exit: '辨識缺口並進入下一工作表單',
    outputs: '進度指標、待辦導向',
    nextTab: 'standard',
  },
  {
    id: 'standard',
    label: '標準',
    purpose: '確認適用標準版本、適用性與證書依據。',
    entry: '選定公司後進入',
    exit: '適用標準已確認且證書依據完整',
    outputs: '公司稽核 profile、標準匯出',
    prevTab: 'dashboard',
    nextTab: 'procedure',
  },
  {
    id: 'procedure',
    label: '程序',
    purpose: '確認稽核程序代碼、版本與正式紀錄保存位置。',
    entry: '標準確認後',
    exit: '程序來源三欄齊全、查檢表種子可引用',
    outputs: '開始稽核閘門資料、QR-28-02 匯出',
    prevTab: 'standard',
    nextTab: 'plan',
  },
  {
    id: 'plan',
    label: '年度稽核計畫',
    purpose: '編排年度窗口、關鍵日期與程序月格（QR-28-01）。',
    entry: '程序來源已備',
    exit: '月格已排定、可匯出年度計畫',
    outputs: 'QR-28-01 Excel／HTML',
    prevTab: 'procedure',
    nextTab: 'risk',
  },
  {
    id: 'risk',
    label: '方案風險與優先順序',
    purpose: '評估全部 QP 的七因素優先順序，並可套用至月格。',
    entry: '已有年度計畫列',
    exit: '風險評估完成且（可選）已預覽套用至計畫',
    outputs: 'procedureRisks、風險匯出',
    prevTab: 'plan',
    nextTab: 'personnel',
  },
  {
    id: 'personnel',
    label: '稽核員能力與任命',
    purpose: '維護人員主檔、資格、任命與年度陪稽。',
    entry: '公司／部門資料存在',
    exit: '主任稽核員與團隊資格可被開始稽核檢查',
    outputs: '人員合格名單 Excel、列印',
    prevTab: 'risk',
    nextTab: 'prep',
  },
  {
    id: 'prep',
    label: '稽核啟動與活動準備',
    purpose: '完成雙公司外部稽核前準備與序位確認。',
    entry: '外部稽核日與人員已安排',
    exit: '準備清單與序位勾選完成',
    outputs: '準備清單 Excel、列印',
    prevTab: 'personnel',
    nextTab: 'audit',
  },
  {
    id: 'audit',
    label: '稽核執行與證據',
    purpose: '執行查檢、保存證據、開始／回報並鎖定紀錄。',
    entry: '計畫列與標準／程序閘門通過',
    exit: '事件已回報、證據與快照留存',
    outputs: 'QR-28-02 Excel／HTML',
    prevTab: 'prep',
    nextTab: 'ncr',
  },
  {
    id: 'ncr',
    label: '不符合與矯正措施',
    purpose: '處理不符合、矯正措施與效果確認（QR-28-03）。',
    entry: '查檢「不符」或觀察轉 NCR',
    exit: '矯正與效果確認後結案',
    outputs: 'QR-28-03 Excel',
    prevTab: 'audit',
    nextTab: 'observations',
  },
  {
    id: 'observations',
    label: '觀察事項與追蹤',
    purpose: '登錄、追蹤、結案觀察事項並跨年帶入。',
    entry: '查檢「觀察」或手動登錄',
    exit: '追蹤完成或已轉 NCR／帶入新年度',
    outputs: '觀察台帳 Excel',
    prevTab: 'ncr',
    nextTab: 'suggestions',
  },
  {
    id: 'suggestions',
    label: '改善機會與建議',
    purpose: '追蹤第三方建議並帶入查檢表。',
    entry: '第三方建議（含歷史年度）',
    exit: '建議已追蹤或帶入今年查檢',
    outputs: '建議追蹤 Excel',
    prevTab: 'observations',
    nextTab: 'system-settings',
  },
  {
    id: 'system-settings',
    label: '系統設定',
    purpose: '評分規則、備份還原與全表單匯出。',
    entry: '任何時點',
    exit: '備份／還原或匯出完成',
    outputs: 'JSON 備份、全表單 Excel',
    prevTab: 'suggestions',
  },
]

const WORKFLOW_BY_TAB = new Map<TabId, TabWorkflow>(TAB_WORKFLOW.map((w) => [w.id, w]))

export function getTabWorkflow(tab: TabId): TabWorkflow | undefined {
  return WORKFLOW_BY_TAB.get(tab)
}

/** Ordered steps for procedure-page lifecycle cards (subset of full workflow). */
export const PROCEDURE_LIFECYCLE_STEPS: Array<{ step: string; tab: TabId; note: string }> = [
  { step: '01', tab: 'standard', note: '確認適用標準與證書依據。' },
  { step: '02', tab: 'procedure', note: '本頁完成版本與紀錄位置。' },
  { step: '03', tab: 'plan', note: '依風險與程序安排稽核月份。' },
  { step: '04', tab: 'risk', note: '評估 QP 優先順序並可套用至計畫。' },
  { step: '05', tab: 'personnel', note: '確認稽核團隊資格與任命。' },
  { step: '06', tab: 'prep', note: '外部稽核前準備與序位。' },
  { step: '07', tab: 'audit', note: '執行查檢並留存證據。' },
]

const VALID_TABS = new Set<TabId>(ALL_TABS.map((t) => t.id))
const LEGACY_TAB_ALIASES: Record<string, TabId> = {
  settings: 'system-settings',
}

export function isValidTabId(id: string): id is TabId {
  return VALID_TABS.has(id as TabId)
}

export interface HashState {
  tab: TabId
  auditKey?: string
}

export function parseAppHash(hash: string): HashState {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { tab: 'dashboard' }
  const params = new URLSearchParams(raw)
  const requestedTab = params.get('tab') ?? 'dashboard'
  const tabParam = LEGACY_TAB_ALIASES[requestedTab] ?? requestedTab
  const tab = isValidTabId(tabParam) ? tabParam : 'dashboard'
  const auditKey = params.get('audit') ?? undefined
  return { tab, auditKey }
}

export function buildAppHash(tab: TabId, auditKey?: string): string {
  const params = new URLSearchParams()
  params.set('tab', tab)
  if (auditKey) params.set('audit', auditKey)
  return `#${params.toString()}`
}

export function syncHash(tab: TabId, auditKey?: string) {
  const next = buildAppHash(tab, auditKey)
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next)
  }
}
