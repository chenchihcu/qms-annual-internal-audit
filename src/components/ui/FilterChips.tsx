import type { IconName } from '../../lib/uiIcons'
import { Icon } from './Icon'

export interface FilterChipOption<T extends string> {
  id: T
  label: string
  icon?: IconName
}

interface FilterChipsProps<T extends string> {
  options: FilterChipOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  tone?: 'primary' | 'slate'
  className?: string
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  tone = 'primary',
  className = '',
}: FilterChipsProps<T>) {
  const activePrimary = 'border-blue-700 bg-blue-700 text-white'
  const inactivePrimary = 'border-slate-300 bg-white text-slate-700 hover:border-blue-300'
  const activeSlate = 'border-slate-700 bg-slate-700 text-white'
  const inactiveSlate = 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'

  return (
    <div className={`mb-4 flex flex-wrap gap-2 ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value === option.id
        const activeClass = tone === 'slate' ? activeSlate : activePrimary
        const inactiveClass = tone === 'slate' ? inactiveSlate : inactivePrimary
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
              active ? activeClass : inactiveClass
            }`}
            onClick={() => onChange(option.id)}
          >
            {option.icon && <Icon name={option.icon} size="sm" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
