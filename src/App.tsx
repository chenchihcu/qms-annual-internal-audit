import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuditStore } from './hooks/useAuditStore'
import type { TabId } from './types'
import { AuditYearSwitcher } from './components/AuditYearSwitcher'
import { Dashboard } from './components/Dashboard'
import { ProcessForm } from './components/ui/ProcessForm'
import { WorkflowGuide } from './components/ui/WorkflowGuide'
import { ALL_TABS, parseAppHash, syncHash, type NavigateOptions } from './lib/navigation'
import { Icon } from './components/ui/Icon'
import { MigrationGate } from './components/MigrationGate'

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
const FollowupsPage = lazy(() => import('./components/FollowupsPage').then((module) => ({ default: module.FollowupsPage })))

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
          <h2 className="text-sm font-semibold text-red-800">{this.props.tabLabel} 無法顯示</h2>
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
  const { tab, auditKey, section, recordId } = hashState
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarNavRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const { settings, externalAuditPrep } = store.state
  const headerScope = tab === 'prep'
    ? `外稽準備 · ${externalAuditPrep.year} 年`
    : `年度稽核 · ${settings.auditYear} 年`
  const setTab = (next: TabId, options?: NavigateOptions | string) => {
    const resolved: NavigateOptions | undefined =
      typeof options === 'string' ? { auditKey: options } : options
    setHashState({
      tab: next,
      auditKey: next === 'audit' ? resolved?.auditKey : undefined,
      section: next === 'observations' ? resolved?.section : undefined,
      recordId: resolved?.recordId,
    })
    syncHash(next, options)
    setMobileMenuOpen(false)
  }
  useEffect(() => {
    const update = () => setHashState(parseAppHash(window.location.hash))
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    const activeEntry = ALL_TABS.find((item) => item.id === tab)
    document.title = activeEntry
      ? `${activeEntry.label} · QMS 年度內部稽核`
      : 'QMS 年度內部稽核系統'
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [tab])
  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const firstNav = sidebarNavRef.current?.querySelector('button') as HTMLButtonElement | null
    firstNav?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileMenuOpen])
  const activeEntry = ALL_TABS.find((item) => item.id === tab)
  const renderSidebar = () => (
    <div className="flex h-full flex-col">
      <div className="m-3 rounded-xl bg-blue-800 p-3 text-white">
        <span className="block text-sm font-bold leading-snug">QMS 年度內部稽核</span>
      </div>
      <nav ref={sidebarNavRef} className="flex-1 overflow-y-auto px-3 pb-4" aria-label="依稽核流程的表單導覽">
        {ALL_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`mb-1 flex min-h-11 w-full items-start gap-2 whitespace-normal rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${tab === item.id ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            aria-current={tab === item.id ? 'page' : undefined}
            aria-controls={item.formId}
          >
            <Icon name={item.icon} className="mt-0.5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <p className="border-t border-line p-4 text-xs text-muted">資料儲存於本機 · v14</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-page lg:flex">
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
      >
        跳至主要內容
      </a>
      <aside className="hidden w-max max-w-xs shrink-0 border-r border-line bg-surface no-print lg:block">{renderSidebar()}</aside>
      <aside id="mobile-sidebar" className={`fixed inset-y-0 left-0 z-40 w-max max-w-xs border-r border-line bg-surface transition-transform no-print lg:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!mobileMenuOpen} inert={!mobileMenuOpen}>{renderSidebar()}</aside>
      {mobileMenuOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-900/30 no-print lg:hidden" aria-label="點擊背景關閉導覽" onClick={() => { setMobileMenuOpen(false); menuButtonRef.current?.focus() }} />}

      <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 border-b border-line bg-surface no-print">
        <div className="px-4 py-3 sm:px-6 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button ref={menuButtonRef} type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-bold text-brand lg:hidden" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? '關閉導覽' : '開啟導覽'} aria-expanded={mobileMenuOpen} aria-controls="mobile-sidebar">
                <Icon name="menu" />
                選單
              </button>
              <div className="min-h-11 px-2 text-left">
                <span className="block truncate text-sm font-medium text-ink" title={headerScope}>{headerScope}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AuditYearSwitcher store={store} compact />
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => window.print()}
              >
                <Icon name="printer" />
                列印目前頁面
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-6 outline-none">
        {store.migrationRequired ? (
          <MigrationGate
            downloadRequested={store.migrationBackupRequested}
            backupConfirmed={store.migrationBackupConfirmed}
            warning={store.storageWarning}
            onDownload={store.downloadMigrationBackup}
            onVerifyBackup={store.verifyMigrationBackup}
            onContinue={store.completeMigration}
          />
        ) : <>
        {store.storageWarning && (
          <div role="alert" className="mb-5 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <Icon name="warning" className="mt-0.5 text-amber-700" />
            <div>
              <strong className="block">資料保護模式</strong>
              <span>{store.storageWarning}</span>
            </div>
          </div>
        )}
        {(store.state.workspaceMigrationConflicts?.length ?? 0) > 0 && (
          <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>有 {store.state.workspaceMigrationConflicts?.length} 項資料待覆核；判定衝突不會計分。</span>
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setTab('system-settings')}>查看待覆核資料</button>
          </div>
        )}
        <Suspense fallback={<div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">正在載入頁面…</div>}>
        <WorkflowGuide tab={tab} state={store.state} onNavigate={setTab} />
        {activeEntry?.formId ? (
          <ProcessForm formId={activeEntry.formId} label={`${activeEntry.label}表單`}>
            {tab === 'plan' && (
              <TabErrorBoundary tabLabel="年度稽核計畫">
                <AnnualPlan store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'audit' && (
              <TabErrorBoundary tabLabel="查檢表">
                <ProcedureAuditPanel
                  store={store}
                  selectedKey={auditKey}
                  onSelectedKeyChange={(id) => setTab('audit', id)}
                  onNavigate={setTab}
                />
              </TabErrorBoundary>
            )}
            {tab === 'followups' && (
              <TabErrorBoundary tabLabel="待改善追蹤">
                <FollowupsPage store={store} onNavigate={setTab} />
              </TabErrorBoundary>
            )}
            {tab === 'ncr' && (
              <TabErrorBoundary tabLabel="不符合">
                <NCRList store={store} highlightRecordId={recordId} />
              </TabErrorBoundary>
            )}
            {tab === 'observations' && (
              <TabErrorBoundary tabLabel="觀察事項">
                <Observations store={store} section={section} highlightRecordId={recordId} />
              </TabErrorBoundary>
            )}
            {tab === 'suggestions' && (
              <TabErrorBoundary tabLabel="第三方建議">
                <Suggestions store={store} highlightRecordId={recordId} />
              </TabErrorBoundary>
            )}
            {tab === 'prep' && (
              <TabErrorBoundary tabLabel="外稽準備">
                <PreAuditPrep store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'stakeholders' && (
              <TabErrorBoundary tabLabel="利害關係人">
                <StakeholdersPage store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'risk' && (
              <TabErrorBoundary tabLabel="方案風險">
                <RiskAssessment store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'personnel' && (
              <TabErrorBoundary tabLabel="人員合格名單">
                <PersonnelPage store={store} />
              </TabErrorBoundary>
            )}
            {tab === 'system-settings' && (
              <TabErrorBoundary tabLabel="系統設定">
                <SettingsPanel store={store} onNavigate={setTab} />
              </TabErrorBoundary>
            )}
          </ProcessForm>
        ) : (
          <TabErrorBoundary tabLabel="稽核總覽">
            <Dashboard
              state={store.state}
              onNavigate={setTab}
            />
          </TabErrorBoundary>
        )}
        </Suspense>
        </>}
      </main>
      </div>
    </div>
  )
}

export default App
