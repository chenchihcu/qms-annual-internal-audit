import { forwardRef, type ReactNode } from 'react'
import type { IconName } from '../../lib/uiIcons'
import { badgeIconFor } from '../../lib/uiIcons'
import { Icon } from './Icon'

const colors: Record<string, string> = {
  高: 'bg-red-100 text-red-800 border-red-200',
  中: 'bg-amber-100 text-amber-800 border-amber-200',
  低: 'bg-green-100 text-green-800 border-green-200',
  開立: 'bg-red-100 text-red-800',
  矯正中: 'bg-amber-100 text-amber-800',
  結案: 'bg-green-100 text-green-800',
  符合: 'bg-green-100 text-green-800',
  不符: 'bg-red-100 text-red-800',
  觀察: 'bg-amber-100 text-amber-800',
  不適用: 'bg-slate-100 text-slate-600',
  規劃中: 'bg-slate-100 text-slate-700 border-slate-200',
  執行中: 'bg-blue-100 text-blue-800 border-blue-200',
  已回報: 'bg-green-100 text-green-800 border-green-200',
  NCR: 'bg-red-100 text-red-800 border-red-200',
  建議: 'bg-violet-100 text-violet-800 border-violet-200',
  待追蹤: 'bg-amber-100 text-amber-800 border-amber-200',
  已結案: 'bg-green-100 text-green-800 border-green-200',
  '已轉 NCR': 'bg-red-100 text-red-800 border-red-200',
  系統稽核: 'bg-slate-100 text-slate-700 border-slate-200',
  製程稽核: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  型態稽核: 'bg-purple-100 text-purple-800 border-purple-200',
}

export function Badge({ label, className = '' }: { label: string; className?: string }) {
  const color = colors[label] ?? 'bg-slate-100 text-slate-700'
  const icon = badgeIconFor(label)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${color} ${className}`}>
      {icon && <Icon name={icon} size="sm" />}
      {label}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export const Button = forwardRef<HTMLButtonElement, {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  icon?: IconName
  'aria-describedby'?: string
}>(({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled,
  icon,
  'aria-describedby': ariaDescribedBy,
}, ref) => {
  const variants = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800',
    secondary: 'bg-surface text-slate-700 border border-line hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-describedby={ariaDescribedBy}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
})
Button.displayName = 'Button'

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  step,
  disabled = false,
  className = '',
  ariaLabel,
  onBlur,
}: {
  label?: string
  value: string | number
  onChange: (v: string) => void
  type?: string
  step?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  onBlur?: () => void
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <input
        type={type}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={ariaLabel}
        className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-600"
      />
    </label>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
  ariaLabel,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-600"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
