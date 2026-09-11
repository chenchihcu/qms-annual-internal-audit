import { useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { getSeedStats } from '../data/checklistLoader'
import { summarizeImportState, parseImportJSON } from '../lib/importSummary'
import { Button, Card, Input } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'

export function SettingsPanel({ store }: { store: AuditStore }) {
  const { state, updateSettings, exportJSON, importJSON, resetToDemo, clearAll } = store
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof summarizeImportState> | null>(
    null,
  )
  const [pendingJson, setPendingJson] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = reader.result as string
        const parsed = parseImportJSON(json)
        setPendingJson(json)
        setPendingImport(summarizeImportState(parsed))
        setImportError(null)
      } catch {
        setImportError('匯入失敗：JSON 格式錯誤或版本不支援')
        setPendingImport(null)
        setPendingJson(null)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const confirmImport = () => {
    if (pendingJson) {
      try {
        importJSON(pendingJson)
        setImportError(null)
      } catch {
        setImportError('匯入失敗：寫入資料時發生錯誤')
      }
    }
    setPendingImport(null)
    setPendingJson(null)
  }

  const handleExport = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qms-audit-${state.settings.auditYear}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const seedStats = getSeedStats()

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={pendingImport !== null}
        title="確認匯入 JSON"
        description={
          pendingImport
            ? `將覆蓋本機資料。版本 ${pendingImport.version} · ${pendingImport.auditYear} 年 · 公司：${pendingImport.companies.join('、')} · NCR ${pendingImport.ncrCount} · 觀察 ${pendingImport.observationCount} · 建議 ${pendingImport.suggestionCount}`
            : ''
        }
        variant="danger"
        confirmLabel="覆蓋匯入"
        onConfirm={confirmImport}
        onCancel={() => {
          setPendingImport(null)
          setPendingJson(null)
        }}
      />
      <ConfirmDialog
        open={resetConfirm}
        title="還原示範資料"
        description="將以示範資料覆蓋目前所有公司資料。"
        variant="danger"
        confirmLabel="還原"
        onConfirm={() => {
          resetToDemo()
          setResetConfirm(false)
        }}
        onCancel={() => setResetConfirm(false)}
      />
      <ConfirmDialog
        open={clearConfirm}
        title="清除全部資料"
        description="此操作無法復原，確定清除？"
        variant="danger"
        confirmLabel="清除"
        onConfirm={() => {
          clearAll()
          setClearConfirm(false)
        }}
        onCancel={() => setClearConfirm(false)}
      />

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">查檢表種子（114 年度）</h2>
        <p className="text-sm text-muted">
          程序列 {seedStats.procedureEntries} · 唯一 QP {seedStats.qpCoverage}/{seedStats.qpTotal} ·
          系統稽核 {seedStats.systemItems} 項 · 製程 {seedStats.processItems} 項 · 型態 {seedStats.configItems} 項 ·
          稽核重點 {seedStats.focusRows} 列
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">評分規則設定</h2>
        <p className="mb-4 text-sm text-muted">變更後將立即重算儀表板與程序得分（建議範圍：0–1）。</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="符合得分"
            type="number"
            min={0}
            max={1}
            step="0.1"
            value={state.settings.scoringRules.conform}
            onChange={(v) =>
              updateSettings({
                scoringRules: { ...state.settings.scoringRules, conform: Number(v) },
              })
            }
          />
          <Input
            label="不符得分"
            type="number"
            min={0}
            max={1}
            step="0.1"
            value={state.settings.scoringRules.nonConform}
            onChange={(v) =>
              updateSettings({
                scoringRules: { ...state.settings.scoringRules, nonConform: Number(v) },
              })
            }
          />
          <Input
            label="觀察得分（部分）"
            type="number"
            min={0}
            max={1}
            step="0.1"
            value={state.settings.scoringRules.observation}
            onChange={(v) =>
              updateSettings({
                scoringRules: { ...state.settings.scoringRules, observation: Number(v) },
              })
            }
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">資料備份與還原</h2>
        <p className="mb-4 text-sm text-muted">
          所有資料儲存於瀏覽器 localStorage。建議定期匯出 JSON 備份。
        </p>
        {importError && (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
            {importError}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleExport}>匯出 JSON</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            匯入 JSON
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
          <Button variant="secondary" onClick={() => setResetConfirm(true)}>
            還原示範資料
          </Button>
          <Button variant="danger" onClick={() => setClearConfirm(true)}>
            清除全部資料
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">關於</h2>
        <p className="text-sm text-muted">
          QMS 年度內部稽核系統 v2.0 — 程序導向（QP 查檢表）、雙公司切換、
          對應 QR-28-01/02/03/04/05 及 QR-02-01 風險矩陣。
          目前公司：{state.company.name}
        </p>
      </Card>
    </div>
  )
}
