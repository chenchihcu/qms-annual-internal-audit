import type { ReactNode } from 'react'

export interface CheckboxListOption {
  value: string
  label: string
}

interface CheckboxListProps {
  label?: string
  options: CheckboxListOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  ariaLabel?: string
  allLabel?: string
  allSelected?: boolean
  onToggleAll?: (checked: boolean) => void
  footer?: ReactNode
  className?: string
  disabled?: boolean
}

export function CheckboxList({
  label,
  options,
  selected,
  onChange,
  ariaLabel,
  allLabel,
  allSelected,
  onToggleAll,
  footer,
  className = '',
  disabled = false,
}: CheckboxListProps) {
  const toggle = (value: string, checked: boolean) => {
    if (checked) onChange([...selected, value])
    else onChange(selected.filter((item) => item !== value))
  }

  return (
    <div className={className}>
      {label && <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>}
      <div
        className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
        aria-label={ariaLabel ?? label}
      >
        {allLabel && onToggleAll && (
          <label className="flex min-h-8 items-center gap-2 border-b border-slate-100 pb-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => onToggleAll(event.target.checked)}
            />
            {allLabel}
          </label>
        )}
        {options.map((option) => (
          <label key={option.value} className="flex min-h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {footer}
    </div>
  )
}
