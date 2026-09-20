import type { TabId } from '../types'

export type IconName =
  | 'layoutDashboard'
  | 'bookOpen'
  | 'fileText'
  | 'users'
  | 'alertTriangle'
  | 'calendar'
  | 'idCard'
  | 'clock'
  | 'clipboardCheck'
  | 'listTodo'
  | 'xCircle'
  | 'eye'
  | 'lightbulb'
  | 'listChecks'
  | 'mapPin'
  | 'settings'
  | 'clipboardList'
  | 'playCircle'
  | 'flag'
  | 'checkCircle'
  | 'circleAlert'
  | 'chevronLeft'
  | 'chevronRight'
  | 'menu'
  | 'home'
  | 'printer'
  | 'warning'
  | 'check'
  | 'x'
  | 'minus'
  | 'circleDot'
  | 'minusCircle'
  | 'lock'
  | 'layers'
  | 'cog'
  | 'shapes'
  | 'download'
  | 'fileCode'
  | 'plus'
  | 'save'
  | 'upload'
  | 'pencil'
  | 'trash'
  | 'arrowRightCircle'
  | 'rotateCcw'
  | 'barChart'
  | 'target'
  | 'calendarDays'
  | 'activity'
  | 'shieldCheck'
  | 'filter'
  | 'star'

export const TAB_ICONS: Record<TabId, IconName> = {
  dashboard: 'layoutDashboard',
  standard: 'bookOpen',
  procedure: 'fileText',
  stakeholders: 'users',
  risk: 'alertTriangle',
  plan: 'calendar',
  personnel: 'idCard',
  schedule: 'clock',
  audit: 'clipboardCheck',
  followups: 'listTodo',
  ncr: 'xCircle',
  observations: 'eye',
  suggestions: 'lightbulb',
  prep: 'listChecks',
  onsite: 'mapPin',
  'system-settings': 'settings',
}

export type TabGroupKey = 'overview' | 'P' | 'D' | 'C' | 'A' | 'system'

export const TAB_GROUP_ICONS: Record<TabGroupKey, IconName> = {
  overview: 'layoutDashboard',
  P: 'clipboardList',
  D: 'playCircle',
  C: 'circleAlert',
  A: 'flag',
  system: 'settings',
}

export const TAB_GROUP_KEYS: Record<string, TabGroupKey> = {
  總覽: 'overview',
  'P · 方案規劃': 'P',
  'D · 稽核執行': 'D',
  'C · 結果與改善': 'C',
  'A · 結案與改進': 'A',
  系統管理: 'system',
}

export const BADGE_ICONS: Record<string, IconName> = {
  高: 'alertTriangle',
  中: 'minusCircle',
  低: 'circleDot',
  開立: 'xCircle',
  矯正中: 'activity',
  結案: 'checkCircle',
  符合: 'check',
  不符: 'x',
  觀察: 'eye',
  不適用: 'minus',
  規劃中: 'calendar',
  執行中: 'playCircle',
  已回報: 'lock',
  NCR: 'xCircle',
  建議: 'lightbulb',
  待追蹤: 'eye',
  已結案: 'checkCircle',
  '已轉 NCR': 'arrowRightCircle',
  系統稽核: 'layers',
  製程稽核: 'cog',
  型態稽核: 'shapes',
}

/** Documented action → icon mapping; callers pass icon explicitly to Button. */
export const ACTION_ICONS = {
  exportExcel: 'download' as IconName,
  exportHtml: 'fileCode' as IconName,
  add: 'plus' as IconName,
  print: 'printer' as IconName,
  backup: 'save' as IconName,
  restore: 'upload' as IconName,
  preview: 'eye' as IconName,
  convertNcr: 'arrowRightCircle' as IconName,
  delete: 'trash' as IconName,
  edit: 'pencil' as IconName,
  resetDemo: 'rotateCcw' as IconName,
} satisfies Record<string, IconName>

export const DASHBOARD_KPI_ICONS = {
  score: 'barChart' as IconName,
  ncr: 'xCircle' as IconName,
  observations: 'eye' as IconName,
  suggestions: 'lightbulb' as IconName,
  plan: 'calendarDays' as IconName,
  audits: 'activity' as IconName,
  planning: 'clipboardList' as IconName,
  prep: 'shieldCheck' as IconName,
}

export const ATTENTION_FILTER_ICONS: Record<string, IconName> = {
  需關注: 'filter',
  高中風險: 'alertTriangle',
  已計分: 'barChart',
  全部: 'layers',
}

export const PDCA_SECTION_ICONS: Record<string, IconName> = {
  'P · 方案規劃': 'clipboardList',
  'D · 稽核執行': 'playCircle',
  'C · 結果與改善': 'circleAlert',
  'A · 結案與改進': 'flag',
}

export const SCHEDULE_FILTER_ICONS: Record<string, IconName> = {
  執行中: 'playCircle',
  本月: 'calendar',
  全部: 'layers',
}

export const FOLLOWUP_FILTER_ICONS: Record<string, IconName> = {
  全部: 'layers',
  NCR: 'xCircle',
  觀察: 'eye',
  建議: 'lightbulb',
}

export const CATEGORY_FILTER_ICONS: Record<string, IconName> = {
  全部類型: 'layers',
  系統稽核: 'layers',
  製程稽核: 'cog',
  型態稽核: 'shapes',
}

export const RISK_FILTER_ICONS: Record<string, IconName> = {
  全部: 'layers',
  未存檔: 'save',
  暫定: 'star',
}

export function badgeIconFor(label: string): IconName | undefined {
  if (/^\d+年$/.test(label)) return undefined
  return BADGE_ICONS[label]
}
