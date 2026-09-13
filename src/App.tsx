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
import { shouldShowDemoBanner } from './lib/demoMode'
import { getStoredTheme, toggleTheme } from './lib/theme'
import { DemoBanner } from './components/DemoBanner'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page'

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
          此分頁發生錯誤：{this.state.error}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={`rounded-lg border border-rose-300 px-3 py-1.5 text-sm ${FOCUS_RING}`}
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
  const [ncrId, setNcrId] = useState<string | undefined>(initialHash.ncrId)
  const [isDark, setIsDark] = useState(() => getStoredTheme() === 'dark')
  const { settings, activeCompanyId, company } = store.state

  useEffect(() => {
    syncHash(tab, auditKey, ncrId)
  }, [tab, auditKey, ncrId])

  useEffect(() => {
    const onHash = () => {
      const parsed = parseAppHash(window.location.hash)
      setTab(parsed.tab)
      setAuditKey(parsed.auditKey)
      setNcrId(parsed.ncrId)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((nextTab: TabId, nextAuditKey?: string, nextNcrId?: string) => {
    setTab(nextTab)
    if (nextAuditKey !== undefined) setAuditKey(nextAuditKey)
    if (nextNcrId !== undefined) setNcrId(nextNcrId)
  }, [])

  const handleAuditKeyChange = useCallback((key: string) => {
    setAuditKey(key)
  }, [])

  const savedLabel = store.lastSavedAt
    ? store.lastSavedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    : null

  const showDemoBanner = shouldShowDemoBanner(store.state)

  return (
    <div className="min-h-screen pb-16">
      <a href="#main-content" className="skip-link no-print">
        跳到主要內容
      </a>

      <header className="border-b border-line bg-surface no-print">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          {showDemoBanner && (
            <DemoBanner onDismiss={store.dismissDemoBanner} />
          )}
          {(store.loadWarning || store.saveError) && (
            <div
              role="alert"
              className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
            >
              {store.loadWarning ?? store.saveError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-ink">QMS 年度內部稽核系統</h1>
              <p className="text-sm text-muted">
                {company.name} · {settings.auditYear} 年 · 主任稽核員：{settings.leadAuditor || '—'}
                {savedLabel && <span className="ml-2 text-xs">· 已儲存 {savedLabel}</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="切換公司">
                {(Object.keys(COMPANY_LABELS) as CompanyId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activeCompanyId === id}
                    onClick={() => store.switchCompany(id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${FOCUS_RING} ${
                      activeCompanyId === id
                        ? 'bg-primary text-white'
                        : 'text-muted hover:bg-page'
                    }`}
                  >
                    {COMPANY_LABELS[id]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page ${FOCUS_RING}`}
                onClick={() => setIsDark(toggleTheme() === 'dark')}
                aria-pressed={isDark}
              >
                {isDark ? '淺色' : '深色'}
              </button>
              <button
                type="button"
                className={`rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page ${FOCUS_RING}`}
                onClick={() => window.print()}
              >
                列印目前頁面
              </button>
            </div>
          </div>

          <nav className="mt-4 hidden gap-1 overflow-x-auto md:flex" aria-label="主要分頁">
            {TAB_GROUPS.map((group) => (
              <div key={group.label} className="flex shrink-0 items-center gap-1 pr-2">
                <span className="px-1 text-xs font-semibold text-muted">{group.label}</span>
                {group.tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={tab === t.id ? 'page' : undefined}
                    onClick={() => navigate(t.id)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${FOCUS_RING} ${
                      tab === t.id ? 'bg-primary text-white' : 'text-muted hover:bg-page'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-4 md:hidden">
            <label className="block text-xs font-medium text-muted" htmlFor="mobile-tab">
              目前分頁
            </label>
            <select
              id="mobile-tab"
              value={tab}
              onChange={(e) => navigate(e.target.value as TabId)}
              className={`mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm ${FOCUS_RING}`}
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

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === 'dashboard' && (
          <TabErrorBoundary>
            <Dashboard state={store.state} onNavigate={navigate} />
          </TabErrorBoundary>
        )}
        {tab === 'plan' && (
          <TabErrorBoundary>
            <AnnualPlan store={store} onNavigate={navigate} />
          </TabErrorBoundary>
        )}
        {tab === 'audit' && (
          <TabErrorBoundary>
            <ProcedureAuditPanel
              store={store}
              selectedKey={auditKey}
              onSelectedKeyChange={handleAuditKeyChange}
            />
          </TabErrorBoundary>
        )}
        {tab === 'ncr' && (
          <TabErrorBoundary>
            <NCRList store={store} selectedNcrId={ncrId} />
          </TabErrorBoundary>
        )}
        {tab === 'observations' && (
          <TabErrorBoundary>
            <Observations store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'suggestions' && (
          <TabErrorBoundary>
            <Suggestions store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'prep' && (
          <TabErrorBoundary>
            <PreAuditPrep store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'risk' && (
          <TabErrorBoundary>
            <RiskAssessment store={store} />
          </TabErrorBoundary>
        )}
        {tab === 'settings' && (
          <TabErrorBoundary>
            <SettingsPanel store={store} />
          </TabErrorBoundary>
        )}
      </main>

      <footer className="border-t border-line py-4 text-center text-xs text-muted no-print">
        ISO 9001 / AS9100D 內部稽核 · 對應 QR-28-01/02/03/04/05 · 資料儲存於本機
      </footer>
    </div>
  )
}

export default App
