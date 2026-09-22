import type { TabId } from '../types'

export interface TabEntry {
  id: TabId
  label: string
}

/** 側欄分頁：依內部稽核流程順序，含未選取／選取色彩 */
export interface NavTabEntry extends TabEntry {
  inactiveClass: string
  activeClass: string
}

/** 設定 → 風險 → 計畫 → 程序稽核 → 發現 → 儀表板 → 外部準備 */
export const NAV_TABS: NavTabEntry[] = [
  {
    id: 'settings',
    label: '設定',
    inactiveClass: 'text-slate-600 dark:text-slate-400',
    activeClass: 'bg-slate-600 text-white dark:bg-slate-500',
  },
  {
    id: 'risk',
    label: '風險評估',
    inactiveClass: 'text-blue-700 dark:text-blue-300',
    activeClass: 'bg-blue-600 text-white dark:bg-blue-500',
  },
  {
    id: 'plan',
    label: '年度計畫',
    inactiveClass: 'text-indigo-700 dark:text-indigo-300',
    activeClass: 'bg-indigo-600 text-white dark:bg-indigo-500',
  },
  {
    id: 'audit',
    label: '程序稽核',
    inactiveClass: 'text-emerald-700 dark:text-emerald-300',
    activeClass: 'bg-emerald-600 text-white dark:bg-emerald-500',
  },
  {
    id: 'ncr',
    label: '不符合',
    inactiveClass: 'text-red-700 dark:text-red-300',
    activeClass: 'bg-red-600 text-white dark:bg-red-500',
  },
  {
    id: 'observations',
    label: '觀察事項',
    inactiveClass: 'text-amber-700 dark:text-amber-300',
    activeClass: 'bg-amber-600 text-white dark:bg-amber-500',
  },
  {
    id: 'suggestions',
    label: '建議追蹤',
    inactiveClass: 'text-orange-700 dark:text-orange-300',
    activeClass: 'bg-orange-600 text-white dark:bg-orange-500',
  },
  {
    id: 'dashboard',
    label: '儀表板',
    inactiveClass: 'text-violet-700 dark:text-violet-300',
    activeClass: 'bg-violet-600 text-white dark:bg-violet-500',
  },
  {
    id: 'prep',
    label: '外部稽核準備',
    inactiveClass: 'text-cyan-700 dark:text-cyan-300',
    activeClass: 'bg-cyan-600 text-white dark:bg-cyan-500',
  },
]

export const ALL_TABS: TabEntry[] = NAV_TABS

const VALID_TABS = new Set<TabId>(ALL_TABS.map((t) => t.id))

export function isValidTabId(id: string): id is TabId {
  return VALID_TABS.has(id as TabId)
}

export type ObservationSection = 'current' | 'prior'

export interface HashState {
  tab: TabId
  auditKey?: string
  section?: ObservationSection
}

export interface NavigateOptions {
  auditKey?: string
  section?: ObservationSection
}

export function isValidObservationSection(value: string): value is ObservationSection {
  return value === 'current' || value === 'prior'
}

export function parseAppHash(hash: string): HashState {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { tab: 'dashboard' }
  const params = new URLSearchParams(raw)
  const tabParam = params.get('tab') ?? 'dashboard'
  const tab = isValidTabId(tabParam) ? tabParam : 'dashboard'
  const auditKey = tab === 'audit' ? (params.get('audit') ?? undefined) : undefined
  const sectionRaw = params.get('section')
  const section =
    tab === 'observations' && sectionRaw && isValidObservationSection(sectionRaw)
      ? sectionRaw
      : undefined
  return { tab, auditKey, section }
}

export function buildAppHash(tab: TabId, options?: NavigateOptions): string {
  const params = new URLSearchParams()
  params.set('tab', tab)
  if (tab === 'audit' && options?.auditKey) {
    params.set('audit', options.auditKey)
  }
  if (tab === 'observations' && options?.section) {
    params.set('section', options.section)
  }
  return `#${params.toString()}`
}

export function syncHash(tab: TabId, options?: NavigateOptions) {
  const next = buildAppHash(tab, options)
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next)
  }
}
