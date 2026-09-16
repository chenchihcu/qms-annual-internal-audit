import { forwardRef, type ReactNode } from 'react'

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
}

export function Badge({ label, className = '' }: { label: string; className?: string }) {
  const color = colors[label] ?? 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color} ${className}`}>
      {label}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
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
}>(({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled,
}, ref) => {
  const variants = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 ${variants[variant]} ${className}`}
    >
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
}: {
  label?: string
  value: string | number
  onChange: (v: string) => void
  type?: string
  step?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
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
        aria-label={ariaLabel}
        className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-600"
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
        className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-600"
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
