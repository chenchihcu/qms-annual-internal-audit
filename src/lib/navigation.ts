import type { TabId } from '../types'

export interface TabEntry {
  id: TabId
  label: string
}

export interface TabGroup {
  label: string
  tabs: TabEntry[]
}

export const TAB_GROUPS: TabGroup[] = [
  {
    label: '規劃',
    tabs: [
      { id: 'settings', label: '設定' },
      { id: 'risk', label: '風險評估' },
      { id: 'plan', label: '年度計畫' },
    ],
  },
  {
    label: '執行',
    tabs: [{ id: 'audit', label: '程序稽核' }],
  },
  {
    label: '發現',
    tabs: [
      { id: 'ncr', label: '不符合' },
      { id: 'observations', label: '觀察事項' },
      { id: 'suggestions', label: '建議追蹤' },
    ],
  },
  {
    label: '外部',
    tabs: [
      { id: 'prep', label: '外部稽核準備' },
      { id: 'clauses', label: '條款對照' },
    ],
  },
  {
    label: '總覽',
    tabs: [{ id: 'dashboard', label: '儀表板' }],
  },
]

export const ALL_TABS: TabEntry[] = TAB_GROUPS.flatMap((g) => g.tabs)

const VALID_TABS = new Set<TabId>(ALL_TABS.map((t) => t.id))

export function isValidTabId(id: string): id is TabId {
  return VALID_TABS.has(id as TabId)
}

export interface HashState {
  tab: TabId
  auditKey?: string
  ncrId?: string
}

export function parseAppHash(hash: string): HashState {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { tab: 'settings' }
  const params = new URLSearchParams(raw)
  const tabParam = params.get('tab') ?? 'settings'
  const tab = isValidTabId(tabParam) ? tabParam : 'settings'
  const auditKey = params.get('audit') ?? undefined
  const ncrId = params.get('ncr') ?? undefined
  return { tab, auditKey, ncrId }
}

export function buildAppHash(tab: TabId, auditKey?: string, ncrId?: string): string {
  const params = new URLSearchParams()
  params.set('tab', tab)
  if (auditKey) params.set('audit', auditKey)
  if (ncrId) params.set('ncr', ncrId)
  return `#${params.toString()}`
}

export function syncHash(tab: TabId, auditKey?: string, ncrId?: string) {
  const next = buildAppHash(tab, auditKey, ncrId)
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next)
  }
}
