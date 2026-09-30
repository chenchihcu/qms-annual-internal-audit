import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
import { useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { backupFilename, describeRestorePreview, parseBackupJson } from '../lib/backup'
import { downloadBlob } from '../lib/download'
import { exportAllFormsExcel } from '../lib/formExport'
import {
  PROFILE_SNAPSHOT_READY_MESSAGE,
} from '../lib/auditProfileValidation'
import { procedureSourceReady, standardReady } from '../lib/workflowStatus'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Button, Input } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import type { ScoringRules, TabId } from '../types'
import { TrashPanel } from './TrashPanel'
import { SystemFlowChart } from './SystemFlowChart'
import { WorkspaceMigrationReview } from './WorkspaceMigrationReview'
import { FormalRecordLocationDialog } from './FormalRecordLocationDialog'

type SettingsSection = 'audit' | 'data' | 'trash' | 'flow'
type AuditPane = 'procedure' | 'scoring'
type ScoringField = keyof ScoringRules

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'audit', label: '稽核資料' },
  { id: 'data', label: '備份與匯出' },
  { id: 'trash', label: '回收區' },
  { id: 'flow', label: '系統流程' },
]

const AUDIT_PANES: Array<{ id: AuditPane; label: string }> = [
  { id: 'procedure', label: '程序與紀錄' },
  { id: 'scoring', label: '進階評分設定' },
]

function ScoringRuleInput({
  field,
  label,
  value,
  onSave,
  onEdit,
}: {
  field: ScoringField
  label: string
  value: number
  onSave: (field: ScoringField, value: number) => void
  onEdit: () => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState('')

  return (
    <Input
      label={label}
      type="number"
      step="any"
      min={0}
      required
      value={draft}
      error={error}
      onChange={(next) => {
        setDraft(next)
        setError('')
        onEdit()
      }}
      onBlur={(raw) => {
        const parsed = Number(raw)
        if (!raw.trim() || !Number.isFinite(parsed) || parsed < 0) {
          setError('請輸入 0 或更高的有效數值')
          return
        }
        setError('')
        onSave(field, parsed)
      }}
    />
  )
}

export function SettingsPanel({ store, onNavigate }: { store: AuditStore; onNavigate?: (tab: TabId) => void }) {
  const { state, updateSettings, updateCompanyAuditProfile, exportJSON, importJSON } = store
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeSection, setActiveSection] = useState<SettingsSection>('audit')
  const [auditPane, setAuditPane] = useState<AuditPane>('procedure')
  const [pendingRestore, setPendingRestore] = useState<{ json: string; summary: string } | null>(null)
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [scoringSavedMessage, setScoringSavedMessage] = useState(false)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [backedUpState, setBackedUpState] = useState<typeof state | null>(null)
  const profile = state.auditProfile
  const trashCount = state.trash?.length ?? 0

  const profileReady =
    standardReady(state, WORKSPACE_COMPANY_ID)
    && procedureSourceReady(state, WORKSPACE_COMPANY_ID)

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = reader.result as string
        let sourceVersion: number | undefined
        try {
          const parsed = JSON.parse(json) as { _format?: string; state?: { version?: number }; version?: number }
          const stateRaw =
            parsed._format === 'qms-annual-internal-audit-backup' && parsed.state
              ? parsed.state
              : parsed
          if (typeof stateRaw.version === 'number') sourceVersion = stateRaw.version
        } catch {
          sourceVersion = undefined
        }
        const preview = parseBackupJson(json)
        setPendingRestore({ json, summary: describeRestorePreview(sourceVersion, preview) })
        setRestoreStatus(null)
      } catch (err) {
        setRestoreStatus({
          type: 'error',
          message: err instanceof Error ? err.message : '還原失敗：備份格式錯誤',
        })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const confirmRestore = () => {
    if (!pendingRestore) return
    try {
      importJSON(pendingRestore.json)
      setRestoreStatus({ type: 'success', message: '還原成功' })
    } catch (err) {
      setRestoreStatus({
        type: 'error',
        message: err instanceof Error ? err.message : '還原失敗：備份格式錯誤',
      })
    }
    setPendingRestore(null)
  }

  const handleBackup = () => {
    const json = exportJSON()
    downloadBlob(new Blob([json], { type: 'application/json' }), backupFilename(state))
    setBackedUpState(state)
  }

  const saveScoringRule = (field: ScoringField, value: number) => {
    updateSettings({ scoringRules: { ...state.settings.scoringRules, [field]: value } })
    setScoringSavedMessage(true)
  }

  const handleExportAllExcel = () => {
    exportAllFormsExcel(state, WORKSPACE_COMPANY_ID)
  }

  return (
    <div className="space-y-5">
      <WorkspaceMigrationReview store={store} onNavigate={(tab) => onNavigate?.(tab)} />

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="系統設定區塊">
        {SETTINGS_SECTIONS.map(({ id, label }) => {
          const selected = activeSection === id
          const text = id === 'trash' && trashCount > 0 ? `${label} · ${trashCount}` : label
          return (
            <label key={id} className="cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name="system-settings-section"
                value={id}
                checked={selected}
                onChange={() => setActiveSection(id)}
              />
              <span
                className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium transition peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2 ${selected ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {text}
              </span>
            </label>
          )
        })}
      </div>

      {activeSection === 'audit' && (
        <div className="space-y-4">
          <div
            className="flex flex-wrap gap-1 border-b border-slate-200"
            role="tablist"
            aria-label="稽核資料分頁"
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
              event.preventDefault()
              const index = AUDIT_PANES.findIndex((pane) => pane.id === auditPane)
              const step = event.key === 'ArrowRight' ? 1 : -1
              const next = AUDIT_PANES[(index + step + AUDIT_PANES.length) % AUDIT_PANES.length]
              setAuditPane(next.id)
              queueMicrotask(() => document.getElementById(`audit-tab-${next.id}`)?.focus())
            }}
          >
            {AUDIT_PANES.map(({ id, label }) => {
              const selected = auditPane === id
              return (
                <button
                  key={id}
                  id={`audit-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`audit-pane-${id}`}
                  tabIndex={selected ? 0 : -1}
                  className={`min-h-10 border-b-2 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${selected ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                  onClick={() => setAuditPane(id)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {auditPane === 'procedure' && (
            <div role="tabpanel" id="audit-pane-procedure" aria-labelledby="audit-tab-procedure" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">正式紀錄保存位置</h3>
                  <p className="text-sm text-slate-600">
                    組織受控之內部稽核查檢表與年度結案報告存檔路徑（各程序文件依現行受控版本執行稽核）。
                  </p>
                  <div className="pt-1 text-sm">
                    <span className="font-medium text-slate-700">目前設定：</span>
                    {profile.formalRecordLocation ? (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                        {profile.formalRecordLocation}
                      </span>
                    ) : (
                      <span className="font-medium text-amber-700">尚未指定保存位置</span>
                    )}
                  </div>
                </div>
                <div>
                  <Button
                    icon={ACTION_ICONS.edit}
                    onClick={() => setLocationDialogOpen(true)}
                  >
                    {profile.formalRecordLocation ? '變更保存位置' : '指定保存位置'}
                  </Button>
                </div>
              </div>
              {profileReady && (
                <p className="mt-3 text-sm text-green-700" role="status">{PROFILE_SNAPSHOT_READY_MESSAGE}</p>
              )}
            </div>
          )}

          {auditPane === 'scoring' && (
            <div role="tabpanel" id="audit-pane-scoring" aria-labelledby="audit-tab-scoring" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <p className="text-sm text-slate-600">只調整後續稽核的計分；已回報紀錄不會回寫。未經核准的評分規則請維持預設值。</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <ScoringRuleInput
                  key={`conform-${state.settings.scoringRules.conform}`}
                  field="conform"
                  label="符合得分"
                  value={state.settings.scoringRules.conform}
                  onSave={saveScoringRule}
                  onEdit={() => setScoringSavedMessage(false)}
                />
                <ScoringRuleInput
                  key={`nonConform-${state.settings.scoringRules.nonConform}`}
                  field="nonConform"
                  label="不符得分"
                  value={state.settings.scoringRules.nonConform}
                  onSave={saveScoringRule}
                  onEdit={() => setScoringSavedMessage(false)}
                />
                <ScoringRuleInput
                  key={`observation-${state.settings.scoringRules.observation}`}
                  field="observation"
                  label="觀察得分（部分）"
                  value={state.settings.scoringRules.observation}
                  onSave={saveScoringRule}
                  onEdit={() => setScoringSavedMessage(false)}
                />
              </div>
              {scoringSavedMessage && <p className="mt-3 text-sm text-green-700" role="status">評分規則已寫入</p>}
            </div>
          )}
        </div>
      )}

      {activeSection === 'data' && (
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="backup-heading">
            <h2 id="backup-heading" className="mb-2 text-sm font-semibold text-slate-900">備份與還原</h2>
            <p className="mb-4 text-sm text-slate-600">完整 JSON 備份包含工作區、年度封存、外稽準備與回收區。資料變更後須重新下載備份，才能還原並覆寫目前資料。</p>
            <div className="flex flex-wrap gap-3">
              <Button icon={ACTION_ICONS.backup} onClick={handleBackup}>下載完整備份</Button>
              <Button
                variant="secondary"
                icon={ACTION_ICONS.restore}
                disabled={backedUpState !== state}
                onClick={() => fileRef.current?.click()}
              >
                選擇備份檔還原
              </Button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} />
            </div>
            {restoreStatus && (
              <p className={`mt-3 text-sm ${restoreStatus.type === 'success' ? 'text-green-700' : 'text-red-700'}`} role="status">
                {restoreStatus.message}
              </p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="export-heading">
            <h2 id="export-heading" className="mb-2 text-sm font-semibold text-slate-900">匯出工作表</h2>
            <p className="mb-4 text-sm text-slate-600">匯出目前年度資料供整理、列印或另存正式紀錄；本系統的本機資料不取代受控紀錄。</p>
            <div className="flex flex-wrap gap-3">
              <Button icon={ACTION_ICONS.exportExcel} onClick={handleExportAllExcel}>匯出全部稽核表單</Button>
            </div>
          </section>
        </div>
      )}

      {activeSection === 'trash' && <TrashPanel store={store} />}

      {activeSection === 'flow' && <SystemFlowChart onNavigate={onNavigate} />}

      <FormalRecordLocationDialog
        open={locationDialogOpen}
        currentLocation={profile.formalRecordLocation}
        onConfirm={(nextLocation) => {
          updateCompanyAuditProfile(WORKSPACE_COMPANY_ID, { formalRecordLocation: nextLocation })
          setLocationDialogOpen(false)
        }}
        onCancel={() => setLocationDialogOpen(false)}
      />

      {pendingRestore && (
        <ConfirmDialog
          open
          title="確定還原備份？"
          description={pendingRestore.summary}
          confirmLabel="確認還原"
          variant="danger"
          onConfirm={confirmRestore}
          onCancel={() => setPendingRestore(null)}
        />
      )}
    </div>
  )
}
