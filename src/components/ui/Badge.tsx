import { useId, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react'
import type { IconName } from '../../lib/uiIcons'
import { Icon } from './Icon'

export type BadgeTone = 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'pending'

const TONE_CLASSES: Record<BadgeTone, string> = {
  danger: 'bg-tone-danger-bg text-tone-danger-fg border-tone-danger-line',
  warning: 'bg-tone-warning-bg text-tone-warning-fg border-tone-warning-line',
  success: 'bg-tone-success-bg text-tone-success-fg border-tone-success-line',
  info: 'bg-tone-info-bg text-tone-info-fg border-tone-info-line',
  neutral: 'bg-tone-neutral-bg text-tone-neutral-fg border-tone-neutral-line',
  pending: 'bg-tone-pending-bg text-tone-pending-fg border-tone-pending-line',
}

/** 既有標籤文字 → 色調；新呼叫端優先傳 `tone`，不依文案決定顏色。 */
const LABEL_TONES: Record<string, BadgeTone> = {
  高: 'danger',
  中: 'warning',
  低: 'success',
  開立: 'danger',
  矯正中: 'warning',
  結案: 'success',
  符合: 'success',
  不符: 'danger',
  觀察: 'warning',
  不適用: 'neutral',
  未判定: 'pending',
  待追蹤: 'warning',
  已結案: 'success',
  '已轉 NCR': 'danger',
  有效: 'success',
  暫停: 'warning',
  失效: 'neutral',
}

function badgeTone(label: string): BadgeTone {
  return LABEL_TONES[label] ?? (/^\d{4}年$/.test(label) ? 'info' : 'neutral')
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page'

export function Badge({ label, tone, className = '' }: { label: string; tone?: BadgeTone; className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-normal ${TONE_CLASSES[tone ?? badgeTone(label)]} ${className}`}>
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
  children?: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost' | 'dangerGhost'
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
    primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-pressed',
    secondary: 'bg-surface text-ink border border-line hover:bg-page active:bg-line',
    danger: 'bg-danger-solid text-white hover:bg-danger-solid-hover',
    ghost: 'text-muted hover:bg-page hover:text-ink active:bg-line',
    dangerOutline: 'bg-surface text-danger border border-tone-danger-line hover:bg-tone-danger-bg active:bg-tone-danger-line',
    dangerGhost: 'text-danger hover:bg-tone-danger-bg active:bg-tone-danger-line',
  }
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${variants[variant]} ${className}`}
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
      {label && <label className="mb-1 block text-sm font-bold text-ink" htmlFor={inputId}>{label}{required && <><span aria-hidden="true" className="ml-0.5 text-danger">*</span><span className="sr-only">必填</span></>}</label>}
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
        className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'border-danger' : ''} ${FOCUS_RING}`}
      />
      {hint && <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs font-bold text-danger">{error}</p>}
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
  className = '',
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
  className?: string
}) {
  const generatedId = useId()
  const selectId = id ?? `select-${generatedId}`
  const hintId = `${selectId}-hint`
  const errorId = `${selectId}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      {label && <label className="mb-1 block text-sm font-bold text-ink" htmlFor={selectId}>{label}{required && <><span aria-hidden="true" className="ml-0.5 text-danger">*</span><span className="sr-only">必填</span></>}</label>}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        required={required}
        disabled={disabled}
        className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'border-danger' : ''} ${FOCUS_RING} ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs font-bold text-danger">{error}</p>}
    </div>
  )
}
