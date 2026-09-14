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
  /** 由年度計畫月格點擊帶入的計畫月份（1–12） */
  planMonth?: number
}

export function parseAppHash(hash: string): HashState {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { tab: 'settings' }
  const params = new URLSearchParams(raw)
  const tabParam = params.get('tab') ?? 'settings'
  const tab = isValidTabId(tabParam) ? tabParam : 'settings'
  const auditKey = params.get('audit') ?? undefined
  const ncrId = params.get('ncr') ?? undefined
  const planMonthRaw = params.get('planMonth')
  const planMonthParsed = planMonthRaw ? Number(planMonthRaw) : NaN
  const planMonth =
    Number.isFinite(planMonthParsed) && planMonthParsed >= 1 && planMonthParsed <= 12
      ? planMonthParsed
      : undefined
  return { tab, auditKey, ncrId, planMonth }
}

export function buildAppHash(
  tab: TabId,
  auditKey?: string,
  ncrId?: string,
  planMonth?: number,
): string {
  const params = new URLSearchParams()
  params.set('tab', tab)
  if (auditKey) params.set('audit', auditKey)
  if (ncrId) params.set('ncr', ncrId)
  if (planMonth !== undefined && planMonth >= 1 && planMonth <= 12) {
    params.set('planMonth', String(planMonth))
  }
  return `#${params.toString()}`
}

export function syncHash(tab: TabId, auditKey?: string, ncrId?: string, planMonth?: number) {
  const next = buildAppHash(tab, auditKey, ncrId, planMonth)
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next)
  }
}
