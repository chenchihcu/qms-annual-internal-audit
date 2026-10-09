import { useId } from 'react'

import { FOCUS_RING } from '../lib/focusRing'
import {
  ARRANGEMENT_IMPACT_RULES,
  OCCURRENCE_BAND_GUIDE,
  OS_BAND_LABELS,
  scaleToOsBand,
  SEVERITY_BAND_GUIDE,
} from '../lib/planner'
import { describeStakeholderScheduleEffect } from '../lib/stakeholderSchedule'
import type { DepartmentProfile, StakeholderTag } from '../types'
import { STAKEHOLDER_TAGS } from '../types'

export interface DepartmentStakeholderFieldProps {
  dept: DepartmentProfile
  /** 本部門在年度計畫中的列數（標籤為部門層資料，套用於全部列） */
  rowCount: number
  onChange: (stakeholders: StakeholderTag[]) => void
}

/** 部門利害關係人標籤（部門層）＋部門 O／S 唯讀參考；排程只在按「自動編排」時生效。 */
export function DepartmentStakeholderField({ dept, rowCount, onChange }: DepartmentStakeholderFieldProps) {
  const statusId = useId()
  const selected = dept.stakeholders
  const occurrence = OS_BAND_LABELS[scaleToOsBand(dept.riskOccurrence)]
  const severity = OS_BAND_LABELS[scaleToOsBand(dept.riskSeverity)]
  const osTitle = [
    `發生度 ${occurrence}：${OCCURRENCE_BAND_GUIDE[scaleToOsBand(dept.riskOccurrence)]}`,
    `嚴重度 ${severity}：${SEVERITY_BAND_GUIDE[scaleToOsBand(dept.riskSeverity)]}`,
    '僅供參考，不在此編輯。',
  ].join('\n')

  const toggle = (tag: StakeholderTag) => {
    onChange(selected.includes(tag) ? selected.filter((s) => s !== tag) : [...selected, tag])
  }

  return (
    <fieldset className="no-print min-w-0" aria-describedby={statusId} data-stakeholder-dept={dept.id}>
      <legend className="mb-1 block text-sm">利害關係人（部門）</legend>
      <div className="flex flex-wrap gap-1.5">
        {STAKEHOLDER_TAGS.map((tag) => {
          const active = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs ${FOCUS_RING} ${
                active
                  ? 'border-primary bg-row-selected text-tone-info-fg'
                  : 'border-line text-muted hover:border-primary'
              }`}
              onClick={() => toggle(tag)}
            >
              {active && <span aria-hidden="true">✓</span>}
              {tag}
            </button>
          )
        })}
      </div>
      <p
        id={statusId}
        role="status"
        className={`mt-1 text-xs ${selected.length === 0 ? 'text-tone-warning-fg' : 'text-muted'}`}
        title={ARRANGEMENT_IMPACT_RULES.trigger}
      >
        {selected.length === 0
          ? `待標註：至少選 1 項 · 套用於本部門 ${rowCount} 列`
          : `已選 ${selected.length} 項 · 套用於本部門 ${rowCount} 列`}
      </p>
      <p className="mt-0.5 break-words text-xs text-muted">{describeStakeholderScheduleEffect(selected)}</p>
      <p className="mt-0.5 text-xs text-muted" title={osTitle}>
        部門 O／S（參考）：O {occurrence} · S {severity}
      </p>
    </fieldset>
  )
}
