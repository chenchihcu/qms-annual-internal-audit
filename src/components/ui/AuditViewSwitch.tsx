import { FOCUS_RING } from '../../lib/focusRing'

export type AuditView = 'audit' | 'prep'

const VIEWS: Array<{ value: AuditView; label: string }> = [
  { value: 'audit', label: '查檢' },
  { value: 'prep', label: '外稽準備' },
]

/** 查檢表單一入口：查檢與外稽準備兩種檢視，資料各自保存、互不覆寫。 */
export function AuditViewSwitch({
  current,
  onChange,
  prepProgress,
}: {
  current: AuditView
  onChange: (view: AuditView) => void
  prepProgress?: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 no-print" role="group" aria-label="查檢表檢視">
      {VIEWS.map((view) => {
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
            {view.value === 'prep' && prepProgress ? ` ${prepProgress}` : ''}
          </button>
        )
      })}
    </div>
  )
}
