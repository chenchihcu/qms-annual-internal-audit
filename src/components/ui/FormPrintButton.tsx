import { triggerFormPrint } from '../../lib/printForm'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

interface FormPrintButtonProps {
  label?: string
  className?: string
}

export function FormPrintButton({ label = '列印本表', className = '' }: FormPrintButtonProps) {
  return (
    <button
      type="button"
      className={`no-print rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page ${FOCUS_RING} ${className}`}
      onClick={() => triggerFormPrint()}
    >
      {label}
    </button>
  )
}
