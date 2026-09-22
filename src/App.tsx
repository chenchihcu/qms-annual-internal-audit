import { Component, type ReactNode, useCallback, useEffect, useState } from 'react'
import { useAuditStore } from './hooks/useAuditStore'
import type { TabId } from './types'
import { AppShell } from './components/AppShell'
import { Dashboard } from './components/Dashboard'
import { AnnualPlan } from './components/AnnualPlan'
import { ProcedureAuditPanel } from './components/ProcedureAuditPanel'
import { NCRList } from './components/NCRList'
import { Observations } from './components/Observations'
import { Suggestions } from './components/Suggestions'
import { PreAuditPrep } from './components/PreAuditPrep'
import { RiskAssessment } from './components/RiskAssessment'
import { SettingsPanel } from './components/SettingsPanel'
import {
  type NavigateOptions,
  type ObservationSection,
  parseAppHash,
  syncHash,
} from './lib/navigation'
import { FOCUS_RING } from './lib/focusRing'
import { getStoredTheme, toggleTheme } from './lib/theme'

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
  const [observationSection, setObservationSection] = useState<ObservationSection | undefined>(
    initialHash.section ?? (initialHash.tab === 'observations' ? 'current' : undefined),
  )
  const [isDark, setIsDark] = useState(() => getStoredTheme() === 'dark')
  const { settings, company } = store.state

  const hashOptions: NavigateOptions = {
    auditKey: tab === 'audit' ? auditKey : undefined,
    section: tab === 'observations' ? (observationSection ?? 'current') : undefined,
  }

  useEffect(() => {
    syncHash(tab, hashOptions)
  }, [tab, auditKey, observationSection])

  useEffect(() => {
    const onHash = () => {
      const parsed = parseAppHash(window.location.hash)
      setTab(parsed.tab)
      setAuditKey(parsed.auditKey)
      setObservationSection(
        parsed.section ?? (parsed.tab === 'observations' ? 'current' : undefined),
      )
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((nextTab: TabId, options?: NavigateOptions) => {
    setTab(nextTab)
    if (nextTab === 'audit') {
      setAuditKey(options?.auditKey)
    } else {
      setAuditKey(undefined)
    }
    if (nextTab === 'observations') {
      setObservationSection(options?.section ?? 'current')
    } else {
      setObservationSection(undefined)
    }
  }, [])

  const handleAuditKeyChange = useCallback((key: string) => {
    setAuditKey(key)
  }, [])

  const savedLabel = store.lastSavedAt
    ? store.lastSavedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <AppShell
      tab={tab}
      onNavigate={navigate}
      companyName={company.name}
      auditYear={settings.auditYear}
      leadAuditor={settings.leadAuditor}
      savedLabel={savedLabel}
      loadWarning={store.loadWarning ?? null}
      saveError={store.saveError}
      isDark={isDark}
      onToggleTheme={() => setIsDark(toggleTheme() === 'dark')}
      onPrint={() => window.print()}
    >
      {tab === 'dashboard' && (
        <TabErrorBoundary>
          <Dashboard state={store.state} onNavigate={navigate} />
        </TabErrorBoundary>
      )}
      {tab === 'plan' && (
        <TabErrorBoundary>
          <AnnualPlan store={store} />
        </TabErrorBoundary>
      )}
      {tab === 'audit' && (
        <TabErrorBoundary>
          <ProcedureAuditPanel
            store={store}
            selectedKey={auditKey}
            onSelectedKeyChange={handleAuditKeyChange}
            onNavigate={navigate}
          />
        </TabErrorBoundary>
      )}
      {tab === 'ncr' && (
        <TabErrorBoundary>
          <NCRList store={store} />
        </TabErrorBoundary>
      )}
      {tab === 'observations' && (
        <TabErrorBoundary>
          <Observations
            store={store}
            section={observationSection ?? 'current'}
            onNavigate={navigate}
          />
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
    </AppShell>
  )
}

export default App
