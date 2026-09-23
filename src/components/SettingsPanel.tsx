import { useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { getSeedStats } from '../data/checklistLoader'
import { getProcedureTitle, getSeedChecklistQuestions } from '../data/checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { SharedChecklistQuestion } from '../types'
import { summarizeImportState, parseImportJSON } from '../lib/importSummary'
import { Button, Card, Input } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

function SharedTemplateEditor({ store }: { store: AuditStore }) {
  const options = PROCEDURE_PLAN_TEMPLATE.map((row) => ({
    key: `${row.qpCode}|${row.departmentId}`,
    qpCode: row.qpCode,
    departmentId: row.departmentId,
    department: row.departmentName,
    label: `${row.qpCode} ${getProcedureTitle(row.qpCode, row.departmentName)} · ${row.departmentName}`,
  }))
  const getQuestions = (key: string): SharedChecklistQuestion[] => {
    const option = options.find((candidate) => candidate.key === key)
    if (!option) return []
    return store.state.sharedChecklistTemplates?.[key]
      ?? getSeedChecklistQuestions(option.qpCode, option.department)
  }
  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? '')
  const [drafts, setDrafts] = useState<SharedChecklistQuestion[]>(() => getQuestions(options[0]?.key ?? ''))
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState(false)
  const selected = options.find((option) => option.key === selectedKey)
  const stored = getQuestions(selectedKey)
  const dirty = JSON.stringify(drafts) !== JSON.stringify(stored)

  const selectProcedure = (key: string) => {
    if (dirty) {
      setPendingKey(key)
      return
    }
    setSelectedKey(key)
    setDrafts(getQuestions(key))
    setError(null)
    setSavedMessage(false)
  }

  const save = () => {
    if (!selected || drafts.length === 0) {
      setError('此程序沒有可編輯題目；請檢查題目種子。')
      return
    }
    if (drafts.some((question) => !question.content.trim())) {
      setError('題目不可空白；請填寫後儲存。')
      return
    }
    const normalized = drafts.map((question) => ({ ...question, content: question.content.trim() }))
    store.updateSharedChecklistTemplate(selected.qpCode, selected.departmentId, normalized)
    setDrafts(normalized)
    setError(null)
    setSavedMessage(true)
  }

  return (
    <Card>
      <ConfirmDialog
        open={pendingKey !== null}
        title="捨棄未儲存修改"
        description="切換程序會捨棄未儲存修改。"
        confirmLabel="捨棄並切換"
        variant="danger"
        onConfirm={() => {
          const key = pendingKey ?? selectedKey
          setSelectedKey(key)
          setDrafts(getQuestions(key))
          setPendingKey(null)
          setError(null)
          setSavedMessage(false)
        }}
        onCancel={() => setPendingKey(null)}
      />
      <h2 className="mb-2 text-lg font-semibold text-ink">共用題目基準</h2>
      <p className="mb-4 text-sm text-muted">新建查檢表套用；既有表單維持快照。</p>
      <label htmlFor="shared-template-procedure" className="block text-sm font-medium text-ink">程序／部門</label>
      <select
        id="shared-template-procedure"
        className={`mt-1 min-h-11 w-full max-w-2xl rounded-lg border border-line bg-surface px-3 ${FOCUS_RING}`}
        value={selectedKey}
        onChange={(event) => selectProcedure(event.target.value)}
      >
        {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
      {drafts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">此程序尚無題目基準。</p>
      ) : (
        <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-2" role="group" aria-label="共用題目列表">
          {drafts.map((question, index) => (
            <label key={`${question.category}-${question.no}-${index}`} className="block text-sm text-ink">
              {question.category} · 第 {question.no} 項
              <textarea
                rows={2}
                className={`mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 ${FOCUS_RING}`}
                value={question.content}
                aria-invalid={!question.content.trim()}
                onChange={(event) => {
                  setDrafts((current) => current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, content: event.target.value } : item,
                  ))
                  setSavedMessage(false)
                }}
              />
            </label>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {savedMessage && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-300">已儲存；既有表單維持快照。</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={!dirty || drafts.length === 0}>儲存題目</Button>
        {dirty && <span className="text-xs text-amber-800 dark:text-amber-200">尚未儲存</span>}
      </div>
    </Card>
  )
}

export function SettingsPanel({ store }: { store: AuditStore }) {
  const { state, updateSettings, exportJSON, importJSON, resetToDemo } = store
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof summarizeImportState> | null>(
    null,
  )
  const [pendingJson, setPendingJson] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)

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
            ? `將覆蓋共用設定、年度計畫、題目基準與兩家公司結果。版本 ${pendingImport.version} · ${pendingImport.auditYear} 年 · 公司：${pendingImport.companies.join('、')} · NCR ${pendingImport.ncrCount} · 觀察 ${pendingImport.observationCount} · 建議 ${pendingImport.suggestionCount}。${pendingImport.planConflictCount > 0 ? `舊兩公司計畫有 ${pendingImport.planConflictCount} 列差異；請在年度計畫逐列確認，確認前不能建立新查檢表。` : `共用計畫 ${pendingImport.sharedPlanCount} 列；新查檢表會由此帶入。`}`
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
        description="示範資料會覆蓋目前資料；請先匯出 JSON 備份。"
        variant="danger"
        confirmLabel="還原"
        onConfirm={() => {
          resetToDemo()
          setResetConfirm(false)
        }}
        onCancel={() => setResetConfirm(false)}
      />
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">查檢表基準（民國 114 年度）</h2>
        <p className="text-sm text-muted">
          程序 {seedStats.procedureEntries} · QP {seedStats.qpCoverage}/{seedStats.qpTotal} ·
          系統 {seedStats.systemItems} 題 · 製程 {seedStats.processItems} 題 · 型態 {seedStats.configItems} 題 ·
          重點 {seedStats.focusRows} 列
        </p>
      </Card>

      <SharedTemplateEditor store={store} />

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">標準適用性</h2>
        <p className="text-sm text-muted">
          ISO 9001／AS9100 均待確認；請依證書、合約、法規與受控程序判定。
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">評分規則設定</h2>
        <p className="mb-4 text-sm text-muted">兩家公司共用；修改後立即重算。範圍 0–1。</p>
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
          JSON 備份含共用設定、年度計畫、題目與兩家公司結果；匯入會覆蓋目前資料。請先匯出備份。
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
          <input ref={fileRef} type="file" accept=".json" aria-label="匯入 JSON 備份檔" className="hidden" onChange={handleFileSelect} />
          <Button variant="secondary" onClick={() => setResetConfirm(true)}>
            還原示範資料
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">關於</h2>
        <p className="text-sm text-muted">
          版本 2.0 · 對應 QR-28-01/02/03/04/05、QR-02-01。
        </p>
      </Card>
    </div>
  )
}
