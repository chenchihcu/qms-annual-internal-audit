import { useId, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react'
import type { IconName } from '../../lib/uiIcons'
import { Icon } from './Icon'

const colors: Record<string, string> = {
  高: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
  中: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  低: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800',
  開立: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  矯正中: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  結案: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  符合: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  不符: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  觀察: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  不適用: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  待追蹤: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  已結案: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  '已轉 NCR': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page'

export function Badge({ label, className = '' }: { label: string; className?: string }) {
  const yearMatch = /^(\d{4})年$/.exec(label)
  const color = colors[label] ?? (yearMatch ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color} ${className}`}>
      {label}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      {children}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  icon?: IconName
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled,
  icon,
  ref,
  ...rest
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary text-white hover:opacity-90',
    secondary: 'bg-surface text-ink border border-line hover:bg-page',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-muted hover:bg-page hover:text-ink',
  }
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  )
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  step,
  className = '',
  id,
  min,
  max,
  onBlur,
  ariaLabel,
  hint,
  error,
  required,
  disabled,
}: {
  label?: string
  value: string | number
  onChange: (v: string) => void
  type?: string
  step?: string
  className?: string
  id?: string
  min?: number
  max?: number
  onBlur?: (value: string) => void
  ariaLabel?: string
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
}) {
  const generatedId = useId()
  const inputId = id ?? `input-${generatedId}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      {label && <label className="mb-1 block text-sm font-medium text-ink" htmlFor={inputId}>{label}{required && <><span aria-hidden="true">*</span><span className="sr-only">必填</span></>}</label>}
      <input
        id={inputId}
        type={type}
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        required={required}
        disabled={disabled}
        className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'border-red-600 dark:border-red-400' : ''} ${FOCUS_RING}`}
      />
      {hint && <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{error}</p>}
    </div>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  id,
  ariaLabel,
  hint,
  error,
  required,
  disabled,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  id?: string
  ariaLabel?: string
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
}) {
  const generatedId = useId()
  const selectId = id ?? `select-${generatedId}`
  const hintId = `${selectId}-hint`
  const errorId = `${selectId}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-ink" htmlFor={selectId}>{label}{required && <><span aria-hidden="true">*</span><span className="sr-only">必填</span></>}</label>}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        required={required}
        disabled={disabled}
        className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'border-red-600 dark:border-red-400' : ''} ${FOCUS_RING}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{error}</p>}
    </div>
  )
}
