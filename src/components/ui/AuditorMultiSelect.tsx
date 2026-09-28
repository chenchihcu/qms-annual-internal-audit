import { useMemo } from 'react'
import type { Person } from '../../types'
import {
  joinAuditorNames,
  personIdsFromAuditorNames,
  personNameMatches,
  splitAuditorNames,
} from '../../lib/personPicker'
import { FOCUS_RING } from '../../lib/focusRing'
import { CheckboxList } from './CheckboxList'

export interface AuditorMultiSelectProps {
  label?: string
  value: string
  onChange: (auditors: string, personIds?: string[]) => void
  candidates: Person[]
  people: Person[]
  compact?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
  excludePersonId?: string
}

export function AuditorMultiSelect({
  label,
  value,
  onChange,
  candidates,
  people,
  compact = false,
  disabled = false,
  ariaLabel,
  className = '',
  excludePersonId,
}: AuditorMultiSelectProps) {
  const options = useMemo(
    () => candidates.map((person) => ({ value: person.id, label: person.name })),
    [candidates],
  )

  const checkboxSelected = useMemo(() => {
    const ids = personIdsFromAuditorNames(people, value)
    if (excludePersonId) return ids.filter((id) => id !== excludePersonId)
    return ids
  }, [excludePersonId, people, value])

  const handleChange = (nextIds: string[]) => {
    const realIds = excludePersonId
      ? nextIds.filter((id) => id !== excludePersonId)
      : nextIds
    const selectedNames = realIds
      .map((id) => people.find((person) => person.id === id)?.name ?? '')
      .filter(Boolean)
    const legacyNames = splitAuditorNames(value).filter(
      (name) => !people.some((person) => personNameMatches(person.name, name)),
    )
    onChange(joinAuditorNames([...selectedNames, ...legacyNames]), realIds)
  }

  const summary = value.trim() || '未指派'
  const candidatePicker = options.length === 0 ? (
    <div
      role="group"
      aria-label={ariaLabel ?? label ?? '稽核人員'}
      className="space-y-2 rounded-md border border-line bg-page p-3 text-sm"
    >
      <p className="text-muted" role="status">
        目前沒有符合此次稽核範圍與日期的可指派人員。
      </p>
      <p className="text-xs text-muted">請確認人員資格、適用範圍與有效期間。</p>
      <a
        href="#tab=personnel"
        className={`inline-block text-primary underline underline-offset-2 ${FOCUS_RING}`}
      >
        前往人員合格名單
      </a>
    </div>
  ) : (
    <CheckboxList
      label={label}
      options={options}
      selected={checkboxSelected}
      onChange={handleChange}
      ariaLabel={ariaLabel ?? label ?? '稽核人員'}
    />
  )

  if (disabled) {
    return (
      <div className={className}>
        {label && <span className="mb-1 block text-xs text-muted">{label}</span>}
        <span className="text-sm text-ink">{summary}</span>
      </div>
    )
  }

  if (compact) {
    return (
      <details className={`no-print ${className}`}>
        <summary className={`cursor-pointer text-sm ${FOCUS_RING}`}>
          {summary}
        </summary>
        <div className="mt-2 min-w-[12rem]">
          {candidatePicker}
        </div>
        <span className="print-only">{summary}</span>
      </details>
    )
  }

  return (
    <div className={`no-print ${className}`}>
      {candidatePicker}
      {options.length === 0 && value.trim() && (
        <p className="mt-1 text-xs text-muted">目前記錄：{summary}</p>
      )}
      <span className="print-only">{summary}</span>
    </div>
  )
}
