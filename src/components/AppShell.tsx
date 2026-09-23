import type { ReactNode } from 'react'
import type { TabId } from '../types'
import { type NavigateOptions, NAV_TABS } from '../lib/navigation'
import { FOCUS_RING } from '../lib/focusRing'

export interface AppShellProps {
  tab: TabId
  onNavigate: (tab: TabId, options?: NavigateOptions) => void
  companyName: string
  auditYear: number
  leadAuditor: string
  savedLabel: string | null
  loadWarning: string | null
  saveError: string | null
  actionError: string | null
  isDark: boolean
  onToggleTheme: () => void
  onPrint: () => void
  children: ReactNode
}

export function AppShell({
  tab,
  onNavigate,
  companyName,
  auditYear,
  leadAuditor,
  savedLabel,
  loadWarning,
  saveError,
  actionError,
  isDark,
  onToggleTheme,
  onPrint,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh">
      <a href="#main-content" className="skip-link no-print">
        跳到主要內容
      </a>

      <aside className="no-print flex w-max shrink-0 flex-col border-r border-line bg-surface">
        <nav className="flex flex-col gap-0.5 px-2 py-3" aria-label="主要分頁">
          {NAV_TABS.map((t) => {
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(t.id)}
                className={`w-full whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm font-semibold transition ${FOCUS_RING} ${
                  isActive ? t.activeClass : `${t.inactiveClass} hover:bg-page`
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print border-b border-line bg-surface px-6 py-4">
          {[loadWarning, saveError, actionError].filter(Boolean).length > 0 && (
            <div
              role="alert"
              className="mb-3 space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
            >
              {[loadWarning, saveError, actionError]
                .filter((msg): msg is string => Boolean(msg))
                .map((msg) => (
                  <p key={msg}>{msg}</p>
                ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-ink">QMS 年度內部稽核系統</h1>
              <p className="text-sm text-muted">
                {companyName} · {auditYear} 年 · 主任稽核員：{leadAuditor || '—'}
                {savedLabel && <span className="ml-2 text-xs">· 已儲存 {savedLabel}</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={`rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page ${FOCUS_RING}`}
                onClick={onToggleTheme}
                aria-pressed={isDark}
              >
                {isDark ? '淺色' : '深色'}
              </button>
              <button
                type="button"
                className={`rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page ${FOCUS_RING}`}
                onClick={onPrint}
              >
                列印目前頁面
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-6 py-6">
          {children}
        </main>

        <footer className="border-t border-line py-4 text-center text-xs text-muted no-print">
          ISO 9001 / AS9100D 內部稽核 · 對應 QR-28-01/02/03/04/05 · 資料儲存於本機
        </footer>
      </div>
    </div>
  )
}
