import { Component, type ReactNode, useCallback, useEffect, useState } from 'react'
import { useAuditStore } from './hooks/useAuditStore'
import type { CompanyId, TabId } from './types'
import { COMPANY_LABELS } from './types'
import { Dashboard } from './components/Dashboard'
import { AnnualPlan } from './components/AnnualPlan'
import { ProcedureAuditPanel } from './components/ProcedureAuditPanel'
import { NCRList } from './components/NCRList'
import { Observations } from './components/Observations'
import { Suggestions } from './components/Suggestions'
import { PreAuditPrep } from './components/PreAuditPrep'
import { RiskAssessment } from './components/RiskAssessment'
import { SettingsPanel } from './components/SettingsPanel'
import { TAB_GROUPS, parseAppHash, syncHash } from './lib/navigation'
import { getStoredTheme, toggleTheme } from './lib/theme'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page'

const TAB_ICON_PATHS: Record<TabId, string> = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4',
  risk: 'M12 3 22 20H2L12 3z M12 9v5 M12 17h.01',
  plan: 'M7 2v4 M17 2v4 M3 9h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z M7 13h3 M7 17h3',
  audit: 'M9 11 12 14 22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  ncr: 'M12 3 22 20H2L12 3z M12 9v5 M12 17h.01',
  observations: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z',
  suggestions: 'M9 18h6 M10 22h4 M8 14c-1.2-.9-2-2.3-2-4a6 6 0 1 1 12 0c0 1.7-.8 3.1-2 4-.7.6-1 1.2-1 2h-6c0-.8-.3-1.4-1-2z',
  prep: 'M9 3h6l1 2h4v16H4V5h4l1-2z M8 11h8 M8 15h8 M8 19h5',
}

function TabIcon({ id }: { id: TabId }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d={TAB_ICON_PATHS[id]} />
    </svg>
  )
}

class TabErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { error: string | null }
> {
  state: { error: string | null } = { error: null }

  static getDerivedStateFromError(err: Error) {
    return { error: err.message || String(err) }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
        >
          頁面載入失敗：{this.state.error}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={`min-h-11 rounded-lg border border-rose-300 px-3 py-1.5 text-sm ${FOCUS_RING}`}
              onClick={() => this.setState({ error: null })}
            >
              重試
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const store = useAuditStore()
  const initialHash = parseAppHash(window.location.hash)
  const [tab, setTab] = useState<TabId>(initialHash.tab)
  const [auditKey, setAuditKey] = useState<string | undefined>(initialHash.auditKey)
  const [isDark, setIsDark] = useState(() => getStoredTheme() === 'dark')
  const { settings, activeCompanyId, company } = store.state
  const isSharedTab = tab === 'prep' || tab === 'settings' || tab === 'plan'

  useEffect(() => {
    syncHash(tab, auditKey)
  }, [tab, auditKey])

  useEffect(() => {
    const onHash = () => {
      const parsed = parseAppHash(window.location.hash)
      setTab(parsed.tab)
      setAuditKey(parsed.auditKey)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((nextTab: TabId, nextAuditKey?: string) => {
    setTab(nextTab)
    if (nextAuditKey !== undefined) setAuditKey(nextAuditKey)
  }, [])

  const handleAuditKeyChange = useCallback((key: string) => {
    setAuditKey(key)
  }, [])

  const savedLabel = store.lastSavedAt
    ? store.lastSavedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link no-print">
        跳到主要內容
      </a>

      <header className="border-b border-line bg-surface no-print">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
          {(store.loadWarning || store.saveError) && (
            <div
              role="alert"
              className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
            >
              {store.loadWarning ?? store.saveError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-ink">QMS 年度內部稽核</h1>
              <p className="text-sm leading-5 text-muted">
                {isSharedTab ? '雙公司' : company.name} · {settings.auditYear} 年
                {' · '}稽核員：{settings.leadAuditor || '—'}
                {savedLabel && <span className="text-xs"> · 已儲存 {savedLabel}</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isSharedTab && (
                <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="編輯公司">
                {(Object.keys(COMPANY_LABELS) as CompanyId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activeCompanyId === id}
                    onClick={() => {
                      if (id !== activeCompanyId) {
                        store.switchCompany(id)
                        setAuditKey(undefined)
                      }
                    }}
                    className={`min-h-11 rounded-md px-3 py-1.5 text-sm font-medium transition ${FOCUS_RING} ${
                      activeCompanyId === id
                        ? 'bg-primary text-white'
                        : 'text-muted hover:bg-page'
                    }`}
                  >
                    {COMPANY_LABELS[id]}
                  </button>
                ))}
                </div>
              )}
              <button
                type="button"
                className={`min-h-11 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page ${FOCUS_RING}`}
                onClick={() => setIsDark(toggleTheme() === 'dark')}
                aria-pressed={isDark}
              >
                {isDark ? '淺色' : '深色'}
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page ${FOCUS_RING}`}
                onClick={() => window.print()}
              >
                列印
              </button>
            </div>
          </div>

          <div className="mt-3 lg:hidden">
            <label className="block text-xs font-medium text-muted" htmlFor="mobile-tab">
              頁面
            </label>
            <select
              id="mobile-tab"
              value={tab}
              onChange={(e) => navigate(e.target.value as TabId)}
              className={`mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm ${FOCUS_RING}`}
            >
              {TAB_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.tabs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-2xl items-start lg:px-0">
        <aside className="no-print hidden w-40 shrink-0 self-stretch border-r border-line bg-surface lg:block">
          <nav aria-label="主要導覽" className="sticky top-0 space-y-1 px-3 py-4">
            {TAB_GROUPS.map((group, groupIndex) => (
              <div key={group.label} className={groupIndex ? 'border-t border-line pt-2' : ''}>
                {group.tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={tab === t.id ? 'page' : undefined}
                    onClick={() => navigate(t.id)}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium whitespace-nowrap transition ${FOCUS_RING} ${
                      tab === t.id ? 'bg-primary text-white' : 'text-ink hover:bg-page'
                    }`}
                  >
                    <TabIcon id={t.id} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {tab === 'dashboard' && (
          <TabErrorBoundary key={activeCompanyId}>
            <Dashboard state={store.state} onNavigate={navigate} />
          </TabErrorBoundary>
        )}
        {tab === 'plan' && (
          <TabErrorBoundary>
            <AnnualPlan store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'audit' && (
          <TabErrorBoundary key={activeCompanyId}>
            <ProcedureAuditPanel
              store={store}
              selectedKey={auditKey}
              onSelectedKeyChange={handleAuditKeyChange}
            />
          </TabErrorBoundary>
        )}
        {tab === 'ncr' && (
          <TabErrorBoundary key={activeCompanyId}>
            <NCRList store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'observations' && (
          <TabErrorBoundary key={activeCompanyId}>
            <Observations store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'suggestions' && (
          <TabErrorBoundary key={activeCompanyId}>
            <Suggestions store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'prep' && (
          <TabErrorBoundary>
            <PreAuditPrep store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'risk' && (
          <TabErrorBoundary key={activeCompanyId}>
            <RiskAssessment store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'settings' && (
          <TabErrorBoundary>
            <SettingsPanel store={store} />
          </TabErrorBoundary>
        )}
      </main>
      </div>

      <footer className="border-t border-line py-4 text-center text-xs text-muted no-print">
        ISO 9001／AS9100 適用性待確認 · 本機資料為輔助工具；正式紀錄請存受控文件系統
      </footer>
    </div>
  )
}

export default App
