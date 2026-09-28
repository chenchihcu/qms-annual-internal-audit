import type { TabId } from '../types'
import { TAB_ICONS, TAB_GROUP_ICONS, type IconName } from './uiIcons'

export interface TabEntry {
  id: TabId
  label: string
  icon: IconName
  /** Each workflow page owns one semantic form and one sidebar item. */
  formId?: string
}

export interface TabGroup {
  label: string
  icon: IconName
  tabs: TabEntry[]
}

function tab(id: TabId, label: string, formId?: string): TabEntry {
  return { id, label, icon: TAB_ICONS[id], formId }
}

export const TAB_GROUPS: TabGroup[] = [
  {
    label: '總覽',
    icon: TAB_GROUP_ICONS.overview,
    tabs: [tab('dashboard', '稽核總覽')],
  },
  {
    label: 'P · 方案規劃',
    icon: TAB_GROUP_ICONS.P,
    tabs: [
      tab('stakeholders', '利害關係人', 'stakeholders-form'),
      tab('risk', '方案風險', 'risk-assessment-form'),
      tab('personnel', '人員合格名單', 'personnel-form'),
      tab('plan', '年度稽核計畫', 'annual-plan-form'),
    ],
  },
  {
    label: 'D · 稽核執行',
    icon: TAB_GROUP_ICONS.D,
    tabs: [
      tab('audit', '查檢表', 'procedure-audit-form'),
    ],
  },
  {
    label: 'C · 結果與改善',
    icon: TAB_GROUP_ICONS.C,
    tabs: [
      tab('observations', '觀察事項', 'observations-form'),
      tab('ncr', '不符合', 'ncr-form'),
      tab('suggestions', '第三方建議', 'suggestions-form'),
      tab('followups', '待改善追蹤', 'followups-form'),
    ],
  },
  {
    label: 'A · 結案與改進',
    icon: TAB_GROUP_ICONS.A,
    tabs: [
      tab('prep', '外稽準備', 'pre-audit-prep-form'),
    ],
  },
  {
    label: '系統管理',
    icon: TAB_GROUP_ICONS.system,
    tabs: [tab('system-settings', '系統設定', 'system-settings-form')],
  },
]

export const ALL_TABS: TabEntry[] = TAB_GROUPS.flatMap((g) => g.tabs)

const TAB_LABEL_BY_ID = new Map<TabId, string>(ALL_TABS.map((entry) => [entry.id, entry.label]))

export function tabLabel(id: TabId): string {
  return TAB_LABEL_BY_ID.get(id) ?? id
}

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
    label: tabLabel('dashboard'),
    purpose: '掌握年度 PDCA 進度與結案狀態，導向各階段表單。',
    entry: '開啟系統或點選首頁',
    exit: '辨識各階段缺口並進入方案規劃',
    outputs: 'PDCA 缺口摘要、待辦導向',
    nextTab: 'stakeholders',
  },
  {
    id: 'stakeholders',
    label: tabLabel('stakeholders'),
    purpose: '標定各部門利害關係人與 O／S（低／中／高）。',
    entry: '稽核程序與紀錄已於系統設定確認',
    exit: '每個部門至少一個利害關係人標籤',
    outputs: '部門標籤與 O／S（不改月格）',
    prevTab: 'system-settings',
    nextTab: 'risk',
  },
  {
    id: 'risk',
    label: tabLabel('risk'),
    purpose: '評估全部 QP 優先順序並存檔固有風險。',
    entry: '部門利害關係人已標註',
    exit: '各 QP 固有風險已存檔（其餘因素可暫定）',
    outputs: 'procedureRisks、QR-02-01 Excel',
    prevTab: 'stakeholders',
    nextTab: 'personnel',
  },
  {
    id: 'personnel',
    label: tabLabel('personnel'),
    purpose: '維護人員主檔、資格、任命與年度陪稽。',
    entry: '風險優先順序已評估',
    exit: '主任稽核員任命有效',
    outputs: '人員合格名單 Excel',
    prevTab: 'risk',
    nextTab: 'plan',
  },
  {
    id: 'plan',
    label: tabLabel('plan'),
    purpose: '編排年度窗口與程序月格。',
    entry: '主任稽核員任命有效',
    exit: '計畫窗口、主任稽核員與月格已排定',
    outputs: 'QR-28-01 Excel／HTML',
    prevTab: 'personnel',
    nextTab: 'audit',
  },
  {
    id: 'audit',
    label: tabLabel('audit'),
    purpose: '執行查檢、保存證據、開始／回報並鎖定紀錄。',
    entry: '從年度計畫建立稽核事件，或於查檢表選取事件',
    exit: '至少一筆事件已開始；回報須查檢全判定',
    outputs: 'QR-28-02 Excel／HTML',
    prevTab: 'plan',
    nextTab: 'observations',
  },
  {
    id: 'observations',
    label: tabLabel('observations'),
    purpose: '登錄、追蹤、結案觀察事項並跨年帶入。',
    entry: '查檢「觀察」或手動登錄',
    exit: '追蹤完成或已轉 NCR／帶入新年度',
    outputs: '觀察台帳 Excel',
    prevTab: 'audit',
    nextTab: 'ncr',
  },
  {
    id: 'ncr',
    label: tabLabel('ncr'),
    purpose: '處理不符合、矯正措施與效果確認。',
    entry: '查檢「不符」或觀察轉 NCR',
    exit: '矯正與效果確認後結案',
    outputs: 'QR-28-03 Excel',
    prevTab: 'observations',
    nextTab: 'suggestions',
  },
  {
    id: 'suggestions',
    label: tabLabel('suggestions'),
    purpose: '登錄並追蹤第三方建議。',
    entry: '第三方建議（含歷史年度）',
    exit: '建議已追蹤或帶入今年查檢',
    outputs: '建議追蹤 Excel',
    prevTab: 'ncr',
    nextTab: 'followups',
  },
  {
    id: 'followups',
    label: tabLabel('followups'),
    purpose: '合併未結 NCR、觀察與建議。',
    entry: '觀察／不符合／建議已登錄後',
    exit: '待追蹤項目已分派或結案（不阻擋下一步）',
    outputs: '合併追蹤工作台、導向各紙本表單',
    prevTab: 'suggestions',
    nextTab: 'prep',
  },
  {
    id: 'prep',
    label: tabLabel('prep'),
    purpose: '完成外稽準備表與內稽→管審→外稽序位。',
    entry: '內部稽核與改善追蹤後',
    exit: '準備清單全數完成且序位無異常',
    outputs: '稽核前準備 Excel',
    prevTab: 'followups',
    nextTab: 'dashboard',
  },
  {
    id: 'system-settings',
    label: tabLabel('system-settings'),
    purpose: '維護稽核資料、備份與匯出，並管理回收區。',
    entry: '任何時點',
    exit: '備份／還原或匯出完成',
    outputs: 'JSON 備份、全表單 Excel、回收區資料',
    prevTab: 'dashboard',
    nextTab: 'dashboard',
  },
]

const WORKFLOW_BY_TAB = new Map<TabId, TabWorkflow>(TAB_WORKFLOW.map((w) => [w.id, w]))

export function getTabWorkflow(tab: TabId): TabWorkflow | undefined {
  return WORKFLOW_BY_TAB.get(tab)
}

const VALID_TABS = new Set<TabId>(ALL_TABS.map((t) => t.id))
const LEGACY_TAB_ALIASES: Record<string, TabId> = {
  settings: 'system-settings',
  standard: 'system-settings',
  procedure: 'system-settings',
  schedule: 'audit',
  onsite: 'prep',
}

export function isValidTabId(id: string): id is TabId {
  return VALID_TABS.has(id as TabId)
}

export type ObservationSection = 'current' | 'prior'

export interface NavigateOptions {
  auditKey?: string
  section?: ObservationSection
  recordId?: string
}

export function isValidObservationSection(value: string): value is ObservationSection {
  return value === 'current' || value === 'prior'
}

export interface HashState {
  tab: TabId
  auditKey?: string
  section?: ObservationSection
  recordId?: string
}

export function parseAppHash(hash: string): HashState {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { tab: 'dashboard' }
  const params = new URLSearchParams(raw)
  const requestedTab = params.get('tab') ?? 'dashboard'
  const tabParam = LEGACY_TAB_ALIASES[requestedTab] ?? requestedTab
  const tab = isValidTabId(tabParam) ? tabParam : 'dashboard'
  const auditKey = params.get('audit') ?? undefined
  const sectionRaw = params.get('section')
  const section =
    sectionRaw && isValidObservationSection(sectionRaw) ? sectionRaw : undefined
  const recordId = params.get('record') ?? undefined
  return { tab, auditKey, section, recordId }
}

export function buildAppHash(tab: TabId, options?: NavigateOptions | string): string {
  const resolved: NavigateOptions | undefined =
    typeof options === 'string' ? { auditKey: options } : options
  const params = new URLSearchParams()
  params.set('tab', tab)
  if (tab === 'audit' && resolved?.auditKey) {
    params.set('audit', resolved.auditKey)
  }
  if (tab === 'observations' && resolved?.section) {
    params.set('section', resolved.section)
  }
  const recordTabs: TabId[] = ['ncr', 'observations', 'suggestions', 'followups']
  if (resolved?.recordId && recordTabs.includes(tab)) {
    params.set('record', resolved.recordId)
  }
  return `#${params.toString()}`
}

export function syncHash(tab: TabId, options?: NavigateOptions | string) {
  const next = buildAppHash(tab, options)
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next)
  }
}
