import { useMemo, useState } from 'react'
import type { Person } from '../../types'
import { personNameSelectOptions } from '../../lib/personPicker'
import { FOCUS_RING } from '../../lib/focusRing'
import { Input, Select } from './Badge'

const CUSTOM_VALUE = '__custom__'

export interface PersonNameSelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  candidates: Person[]
  ariaLabel?: string
  className?: string
  selectClassName?: string
  disabled?: boolean
}

export function PersonNameSelect({
  label,
  value,
  onChange,
  candidates,
  ariaLabel,
  className = '',
  selectClassName = '',
  disabled = false,
}: PersonNameSelectProps) {
  const candidateNames = useMemo(() => new Set(candidates.map((person) => person.name)), [candidates])
  const [customMode, setCustomMode] = useState(false)

  const options = personNameSelectOptions(candidates, value)

  if (customMode) {
    return (
      <div className={className}>
        <Input
          label={label}
          value={value}
          onChange={onChange}
          ariaLabel={ariaLabel}
          disabled={disabled}
        />
        {!disabled && (
          <button
            type="button"
            className={`mt-1 text-xs text-link hover:underline ${FOCUS_RING}`}
            onClick={() => setCustomMode(false)}
          >
            從名單選擇
          </button>
        )}
      </div>
    )
  }

  const selectValue = candidateNames.has(value.trim()) || options.some((option) => option.value === value.trim())
    ? value
    : ''

  return (
    <Select
      label={label}
      value={selectValue}
      onChange={(next) => {
        if (next === CUSTOM_VALUE) {
          setCustomMode(true)
          if (candidateNames.has(value.trim())) onChange('')
          return
        }
        onChange(next)
      }}
      options={options}
      ariaLabel={ariaLabel}
      disabled={disabled}
      className={selectClassName}
    />
  )
}
