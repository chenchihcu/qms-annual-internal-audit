import { FOCUS_RING } from '../../lib/focusRing'

export interface ViewOption<V extends string> {
  value: V
  label: string
}

/** 同一側欄入口下的檢視切換（例：查檢｜外稽準備、程序風險｜利害關係人）。 */
export function ViewSwitch<V extends string>({
  current,
  views,
  onChange,
  ariaLabel,
}: {
  current: V
  views: Array<ViewOption<V>>
  onChange: (view: V) => void
  ariaLabel: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 no-print" role="group" aria-label={ariaLabel}>
      {views.map((view) => {
        const active = current === view.value
        return (
          <button
            key={view.value}
            type="button"
            aria-pressed={active}
            className={`min-h-11 rounded-lg border px-4 text-sm ${FOCUS_RING} ${active
              ? 'border-primary bg-tone-info-bg font-bold text-tone-info-fg'
              : 'border-line bg-surface text-ink hover:bg-page'}`}
            onClick={() => onChange(view.value)}
          >
            {view.label}
          </button>
        )
      })}
    </div>
  )
}
