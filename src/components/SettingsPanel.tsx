import { useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { backupFilename, describeBackup, parseBackupJson } from '../lib/backup'
import { downloadBlob } from '../lib/download'
import { exportAllFormsExcel } from '../lib/formExport'
import {
  PROFILE_SNAPSHOT_READY_MESSAGE,
  procedureFieldErrors,
  standardFieldErrors,
} from '../lib/auditProfileValidation'
import { procedureSourceReady, standardReady } from '../lib/workflowStatus'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Button, Input, Select } from './ui/Badge'
import { PageToolbar } from './ui/PageToolbar'
import { ConfirmDialog } from './ui/ConfirmDialog'
import type { ScoringRules, TabId } from '../types'
import { TrashPanel } from './TrashPanel'
import { WorkspaceMigrationReview } from './WorkspaceMigrationReview'

type SettingsSection = 'audit' | 'data' | 'trash'
type ScoringField = keyof ScoringRules

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'audit', label: '稽核資料' },
  { id: 'data', label: '備份與匯出' },
  { id: 'trash', label: '回收區' },
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
      hint="0 或更高"
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
  const [pendingRestore, setPendingRestore] = useState<{ json: string; summary: string } | null>(null)
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [scoringSavedMessage, setScoringSavedMessage] = useState(false)
  const [backedUpState, setBackedUpState] = useState<typeof state | null>(null)
  const profile = state.companyAuditProfiles[state.activeCompanyId]
  const trashCount = state.trash?.length ?? 0

  const profileReady =
    standardReady(state, state.activeCompanyId)
    && procedureSourceReady(state, state.activeCompanyId)

  const procedureErrors = procedureFieldErrors(profile)
  const standardErrors = standardFieldErrors(profile)

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = reader.result as string
        const preview = parseBackupJson(json)
        setPendingRestore({ json, summary: describeBackup(preview) })
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
    exportAllFormsExcel(state, state.activeCompanyId)
  }

  return (
    <div className="space-y-5">
      <PageToolbar title="系統設定" />
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
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="mb-2 text-base font-semibold text-slate-900">稽核基本資料</h2>
            <p className="mb-5 text-sm text-slate-600">稽核開始時會保存適用依據快照。欄位變更即時儲存於目前瀏覽器。</p>
            <section aria-labelledby="audit-standards-heading">
              <h3 id="audit-standards-heading" className="mb-3 text-sm font-semibold">適用標準</h3>
              <p className="mb-3 text-xs text-slate-600">版本與適用性分別確認；證書資料只登錄一次。</p>
              <div className="space-y-3">
                {profile.applicableStandards.map((standard, index) => (
                  <div key={standard.name} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">標準</span>
                      <span className="flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{standard.name}</span>
                    </label>
                    <div className="space-y-2">
                      <Input
                        label={`版本 — ${standard.name}`}
                        value={standard.version}
                        onChange={(value) => {
                          const standards = [...state.companyAuditProfiles[state.activeCompanyId].applicableStandards]
                          standards[index] = { ...standard, version: value }
                          updateCompanyAuditProfile(state.activeCompanyId, { applicableStandards: standards })
                        }}
                      />
                      {standard.name === 'ISO 9001' && !standard.version.includes('2026') && (
                        <p className="text-xs text-amber-700">
                          ISO 9001:2026 已發布；請依有效證書與認證機構轉版安排確認本年度適用版本。
                        </p>
                      )}
                    </div>
                    <Select
                      label={`適用性 — ${standard.name}`}
                      value={standard.confirmationStatus}
                      onChange={(value) => {
                        const standards = [...state.companyAuditProfiles[state.activeCompanyId].applicableStandards]
                        standards[index] = { ...standard, confirmationStatus: value as 'pending' | 'confirmed' }
                        updateCompanyAuditProfile(state.activeCompanyId, { applicableStandards: standards })
                      }}
                      options={[{ value: 'pending', label: '待確認' }, { value: 'confirmed', label: '已確認' }]}
                    />
                  </div>
                ))}
                {standardErrors?.confirmation && (
                    <p className="text-xs text-amber-700 dark:text-amber-300" role="status">{standardErrors.confirmation}</p>
                )}
              </div>
              <h4 className="mt-4 text-sm font-semibold">管理系統認證證書</h4>
              <p className="mt-1 text-xs text-slate-600">AS9100 證書同時涵蓋 ISO 9001；證書範圍與引用共用一次。各標準版本及適用性仍分別確認。</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input
                  label="證書範圍"
                  value={profile.certificateScope}
                    hint={standardErrors?.certificateScope}
                  onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { certificateScope: value })}
                />
                <Input
                  label="證書編號／引用"
                  value={profile.certificateReference}
                    hint={standardErrors?.certificateReference}
                  onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { certificateReference: value })}
                />
              </div>
            </section>

            <section aria-labelledby="audit-source-heading" className="mt-6 border-t border-slate-200 pt-5">
              <h3 id="audit-source-heading" className="mb-3 text-sm font-semibold">稽核程序與正式紀錄位置</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="稽核程序代碼"
                  value={profile.auditProcedureCode}
                    hint={procedureErrors?.auditProcedureCode}
                  onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { auditProcedureCode: value })}
                />
                <Input
                  label="程序版本"
                  value={profile.auditProcedureVersion}
                    hint={procedureErrors?.auditProcedureVersion}
                  onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { auditProcedureVersion: value })}
                />
                <Input
                  label="正式紀錄保存位置"
                  value={profile.formalRecordLocation}
                    hint={procedureErrors?.formalRecordLocation}
                  onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { formalRecordLocation: value })}
                />
              </div>
            </section>
            {profileReady && (
              <p className="mt-3 text-sm text-green-700" role="status">{PROFILE_SNAPSHOT_READY_MESSAGE}</p>
            )}
          </div>

          <details className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">進階評分設定</summary>
            <p className="mt-3 text-sm text-slate-600">只調整後續稽核的計分；已回報紀錄不會回寫。未經核准的評分規則請維持預設值。</p>
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
          </details>
        </div>
      )}

      {activeSection === 'data' && (
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="backup-heading">
            <h2 id="backup-heading" className="mb-2 text-base font-semibold text-slate-900">備份與還原</h2>
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
            <h2 id="export-heading" className="mb-2 text-base font-semibold text-slate-900">匯出工作表</h2>
            <p className="mb-4 text-sm text-slate-600">匯出目前年度資料供整理、列印或另存正式紀錄；本系統的本機資料不取代受控紀錄。</p>
            <div className="flex flex-wrap gap-3">
              <Button icon={ACTION_ICONS.exportExcel} onClick={handleExportAllExcel}>匯出全部稽核表單</Button>
            </div>
          </section>
        </div>
      )}

      {activeSection === 'trash' && <TrashPanel store={store} />}

      {pendingRestore && (
        <ConfirmDialog
          open
          title="確定還原備份？"
          description={`${pendingRestore.summary}\n\n目前資料將被覆寫。`}
          confirmLabel="確認還原"
          variant="danger"
          onConfirm={confirmRestore}
          onCancel={() => setPendingRestore(null)}
        />
      )}
    </div>
  )
}
