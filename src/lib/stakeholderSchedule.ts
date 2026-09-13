import type { PlanRow, StakeholderTag } from '../types'
import { STAKEHOLDER_WEIGHTS } from './planner'

const EARLY_TAGS: StakeholderTag[] = ['客戶', '法規/認證']
const PRIORITY_TAGS: StakeholderTag[] = ['經營層']
const STANDARD_TAGS: StakeholderTag[] = ['員工', '供應商']

/** 依已選標籤產生排程效果說明（不含原始權重數字） */
export function describeStakeholderScheduleEffect(stakeholders: StakeholderTag[]): string {
  if (stakeholders.length === 0) {
    return '尚未設定標籤 → 僅依風險與計畫窗口編排'
  }

  const parts: string[] = []
  const early = stakeholders.filter((t) => EARLY_TAGS.includes(t))
  const priority = stakeholders.filter((t) => PRIORITY_TAGS.includes(t))
  const standard = stakeholders.filter((t) => STANDARD_TAGS.includes(t))

  if (early.length > 0) {
    parts.push(`${early.join('、')} → 優先排在計畫窗口前段`)
  }
  if (priority.length > 0) {
    parts.push(`${priority.join('、')} → 提高排程優先序`)
  }
  if (standard.length > 0 && early.length === 0 && priority.length === 0) {
    parts.push(`${standard.join('、')} → 依風險與負載均衡編排`)
  } else if (standard.length > 0) {
    parts.push(`${standard.join('、')} → 均衡編排`)
  }

  return parts.join('；')
}

export function stakeholderTagHint(tag: StakeholderTag): string {
  const weight = STAKEHOLDER_WEIGHTS[tag]
  if (EARLY_TAGS.includes(tag)) {
    return `權重 ${weight} · 計畫窗口前段優先`
  }
  if (PRIORITY_TAGS.includes(tag)) {
    return `權重 ${weight} · 提高排程優先序`
  }
  return `權重 ${weight} · 均衡編排`
}

export function departmentHasStakeholderTag(
  departmentId: string,
  tag: StakeholderTag,
  departments: Array<{ id: string; stakeholders: StakeholderTag[] }>,
): boolean {
  const dept = departments.find((d) => d.id === departmentId)
  return dept?.stakeholders.includes(tag) ?? false
}

export function filterPlanRowsByStakeholder(
  rows: PlanRow[],
  tag: StakeholderTag | null,
  departments: Array<{ id: string; stakeholders: StakeholderTag[] }>,
): PlanRow[] {
  if (!tag) return rows
  return rows.filter((row) => departmentHasStakeholderTag(row.departmentId, tag, departments))
}
