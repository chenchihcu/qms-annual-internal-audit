import type { ImpartialityWarning } from '../../lib/impartiality'

export function ImpartialityBanner({
  warning,
  className = 'mb-4',
}: {
  warning: ImpartialityWarning | null
  className?: string
}) {
  if (!warning) return null
  return (
    <div
      role="status"
      className={`${className} rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900`}
    >
      <span className="font-bold">公正性提醒：</span>
      {warning.message}
    </div>
  )
}
