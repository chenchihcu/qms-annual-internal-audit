import { useState, type ReactNode } from 'react'
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
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)_auto]">
      <a href="#main-content" className="skip-link no-print">
        跳到主要內容
      </a>

      <header className="no-print border-b border-line bg-surface px-4 py-3 md:col-start-2 md:px-6 md:py-4">
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              className={`shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page md:hidden ${FOCUS_RING}`}
              aria-expanded={navOpen}
              aria-controls="app-nav"
              onClick={() => setNavOpen((open) => !open)}
            >
              {navOpen ? '關閉選單' : '開啟選單'}
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-ink">QMS 年度內部稽核系統</h1>
              <p className="text-sm text-muted">
                {companyName} · {auditYear} 年 · 主任稽核員：{leadAuditor || '—'}
                {savedLabel && <span className="ml-2 text-xs">· 已儲存 {savedLabel}</span>}
              </p>
            </div>
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

      <aside
        id="app-nav"
        className={`no-print w-full flex-col border-b border-line bg-surface md:col-start-1 md:row-span-3 md:row-start-1 md:w-max md:shrink-0 md:border-r md:border-b-0 ${
          navOpen ? 'flex' : 'hidden md:flex'
        }`}
      >
        <nav className="flex flex-col gap-0.5 px-2 py-3" aria-label="主要分頁">
          {NAV_TABS.map((t) => {
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onNavigate(t.id)
                  setNavOpen(false)
                }}
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

      <main id="main-content" className="min-w-0 px-4 py-4 md:col-start-2 md:px-6 md:py-6">
        {children}
      </main>

      <footer className="border-t border-line py-4 text-center text-xs text-muted no-print md:col-start-2">
        ISO 9001 / AS9100D 內部稽核 · 對應 QR-28-01/02/03/04/05 · 資料儲存於本機
      </footer>
    </div>
  )
}
