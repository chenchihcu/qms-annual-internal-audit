import type { ImpartialityWarning } from '../../lib/impartiality'

export function ImpartialityBanner({ warning }: { warning: ImpartialityWarning | null }) {
  if (!warning) return null
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <span className="font-medium">公正性提醒：</span>
      {warning.message}
    </div>
  )
}
