import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { useAuditStore } from './hooks/useAuditStore'
import type { CompanyId, TabId } from './types'
import { COMPANY_LABELS } from './types'
import { Dashboard } from './components/Dashboard'
import { ProcessForm } from './components/ui/ProcessForm'
import { WorkflowGuide } from './components/ui/WorkflowGuide'
import { ALL_TABS, TAB_GROUPS, parseAppHash, syncHash } from './lib/navigation'

const AnnualPlan = lazy(() => import('./components/AnnualPlan').then((module) => ({ default: module.AnnualPlan })))
const ProcedureAuditPanel = lazy(() => import('./components/ProcedureAuditPanel').then((module) => ({ default: module.ProcedureAuditPanel })))
const NCRList = lazy(() => import('./components/NCRList').then((module) => ({ default: module.NCRList })))
const Observations = lazy(() => import('./components/Observations').then((module) => ({ default: module.Observations })))
const Suggestions = lazy(() => import('./components/Suggestions').then((module) => ({ default: module.Suggestions })))
const PreAuditPrep = lazy(() => import('./components/PreAuditPrep').then((module) => ({ default: module.PreAuditPrep })))
const RiskAssessment = lazy(() => import('./components/RiskAssessment').then((module) => ({ default: module.RiskAssessment })))
const StakeholdersPage = lazy(() => import('./components/StakeholdersPage').then((module) => ({ default: module.StakeholdersPage })))
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then((module) => ({ default: module.SettingsPanel })))
const PersonnelPage = lazy(() => import('./components/PersonnelPage').then((module) => ({ default: module.PersonnelPage })))

class TabErrorBoundary extends Component<
  { children: ReactNode; tabLabel: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-800">{this.props.tabLabel} 無法顯示</h2>
          <p className="mt-2 text-sm text-red-700">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
            onClick={() => this.setState({ error: null })}
          >
            重試
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const store = useAuditStore()
  const [hashState, setHashState] = useState(() => parseAppHash(window.location.hash))
  const { tab, auditKey } = hashState
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { settings, activeCompanyId, company, externalAuditPrep } = store.state
  const headerScope = tab === 'prep'
    ? `外稽準備（雙公司共用 · ${externalAuditPrep.year} 年）`
    : `台帳：${company.name} · 內稽 ${settings.auditYear} 年`
  const setTab = (next: TabId, nextAuditKey?: string) => {
    setHashState({ tab: next, auditKey: nextAuditKey })
    syncHash(next, nextAuditKey)
    setMobileMenuOpen(false)
  }
  useEffect(() => {
    const update = () => setHashState(parseAppHash(window.location.hash))
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const activeEntry = ALL_TABS.find((item) => item.id === tab)
  const activeLabel = activeEntry?.label ?? '稽核總覽'
  const renderSidebar = () => (
    <div className="flex h-full flex-col">
      <button type="button" onClick={() => setTab('dashboard')} className="m-3 rounded-xl bg-blue-800 p-3 text-left text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" aria-label="回到稽核總覽">
        <span className="block text-xs font-medium text-blue-100">首頁</span>
        <span className="mt-1 block text-lg font-bold">QMS 年度內部稽核</span>
        <span className="mt-1 block text-xs leading-snug text-blue-100">{headerScope}</span>
      </button>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="依稽核流程的表單導覽">
        {TAB_GROUPS.map((group) => <div key={group.label} className="mb-4"><p className="px-3 pb-1 text-xs font-bold tracking-wide text-slate-400">{group.label}</p>{group.tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`mb-1 min-h-11 w-full whitespace-normal rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${tab === item.id ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`} aria-current={tab === item.id ? 'page' : undefined} aria-controls={item.formId}>{item.label}</button>)}</div>)}
      </nav>
      <p className="border-t border-slate-100 p-4 text-xs text-slate-400">資料儲存於本機 · v7</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white no-print lg:block">{renderSidebar()}</aside>
      <aside className={`fixed inset-y-0 left-0 z-40 w-56 border-r border-slate-200 bg-white transition-transform no-print lg:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!mobileMenuOpen} inert={!mobileMenuOpen}>{renderSidebar()}</aside>
      {mobileMenuOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-900/30 no-print lg:hidden" aria-label="關閉導覽" onClick={() => setMobileMenuOpen(false)} />}

      <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur no-print">
        <div className="px-4 py-3 sm:px-6 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold text-blue-800 lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="開啟導覽">選單</button>
              <button type="button" onClick={() => setTab('dashboard')} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold text-blue-800 lg:hidden" aria-label="回到首頁">首頁</button>
              <div className="min-h-11 px-2 text-left">
                <span className="block truncate text-lg font-bold text-slate-900">{activeLabel}</span>
                <span className="block truncate text-xs text-slate-500">{headerScope}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-slate-300 p-0.5" role="group" aria-label="切換公司">
                {(Object.keys(COMPANY_LABELS) as CompanyId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => store.switchCompany(id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      activeCompanyId === id
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {COMPANY_LABELS[id]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => window.print()}
              >
                列印目前頁面
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-6">
        {store.storageWarning && (
          <div role="alert" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong className="block">資料保護模式</strong>
            <span>{store.storageWarning}</span>
          </div>
        )}
        <Suspense fallback={<div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">正在載入頁面…</div>}>
        <WorkflowGuide tab={tab} state={store.state} auditKey={auditKey} position="top" />
        {activeEntry?.formId ? (
          <ProcessForm formId={activeEntry.formId} label={`${activeEntry.label}表單`}>
            {tab === 'plan' && (
              <TabErrorBoundary tabLabel="年度稽核計畫">
                <AnnualPlan store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'audit' && (
              <TabErrorBoundary tabLabel="稽核執行與證據">
                <ProcedureAuditPanel store={store} auditKey={auditKey} onAuditKeyChange={(id) => setTab('audit', id)} />
              </TabErrorBoundary>
            )}
            {tab === 'ncr' && (
              <TabErrorBoundary tabLabel="不符合與矯正措施">
                <NCRList store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'observations' && (
              <TabErrorBoundary tabLabel="觀察事項與追蹤">
                <Observations store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'suggestions' && (
              <TabErrorBoundary tabLabel="改善機會與建議">
                <Suggestions store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'prep' && (
              <TabErrorBoundary tabLabel="外部稽核前準備與序位">
                <PreAuditPrep store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'stakeholders' && (
              <TabErrorBoundary tabLabel="利害關係人">
                <StakeholdersPage store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'risk' && (
              <TabErrorBoundary tabLabel="方案風險與優先順序">
                <RiskAssessment store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'personnel' && (
              <TabErrorBoundary tabLabel="稽核員能力與任命">
                <PersonnelPage store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'standard' && (
              <TabErrorBoundary tabLabel="標準">
                <SettingsPanel store={store} section="standard" />
              </TabErrorBoundary>
            )}
            {tab === 'procedure' && (
              <TabErrorBoundary tabLabel="程序">
                <SettingsPanel store={store} section="procedure" />
              </TabErrorBoundary>
            )}
            {tab === 'system-settings' && (
              <TabErrorBoundary tabLabel="系統設定">
                <SettingsPanel store={store} section="system" />
              </TabErrorBoundary>
            )}
          </ProcessForm>
        ) : (
          <TabErrorBoundary tabLabel="稽核總覽">
            <Dashboard state={store.state} onNavigate={setTab} />
          </TabErrorBoundary>
        )}
        <WorkflowGuide tab={tab} state={store.state} auditKey={auditKey} position="bottom" />
        </Suspense>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400 no-print">
        ISO 9001 / AS9100D 內部稽核 · 對應 QR-28-01/02/03/04/05 · 資料儲存於本機
      </footer>
      </div>
    </div>
  )
}

export default App
