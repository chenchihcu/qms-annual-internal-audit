import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { FOCUS_RING } from '../../lib/focusRing'

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
    <div className={`rounded-xl border border-line bg-surface p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled,
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
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${FOCUS_RING} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Input({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  step,
  className = '',
  id,
  min,
  max,
  readOnly,
  error,
}: {
  label?: string
  value: string | number
  onChange: (v: string) => void
  onBlur?: () => void
  type?: string
  step?: string
  className?: string
  id?: string
  min?: number
  max?: number
  readOnly?: boolean
  error?: string
}) {
  const inputId = id ?? (label ? `input-${label.replace(/\s/g, '-')}` : undefined)
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <label className={`block ${className}`} htmlFor={inputId}>
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <input
        id={inputId}
        type={type}
        step={step}
        min={min}
        max={max}
        value={value}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink ${FOCUS_RING} ${
          error ? 'border-red-400 dark:border-red-600' : 'border-line'
        }`}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </label>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  id,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  id?: string
}) {
  const selectId = id ?? (label ? `select-${label.replace(/\s/g, '-')}` : undefined)
  return (
    <label className="block" htmlFor={selectId}>
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink ${FOCUS_RING}`}
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
