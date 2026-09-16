import { useRef } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { backupFilename, describeBackup, parseBackupJson } from '../lib/backup'
import { downloadBlob } from '../lib/download'
import { exportAllAuditsExcel, exportAllFormsExcel, exportStandardExcel } from '../lib/formExport'
import { buildAppHash, getTabWorkflow, PROCEDURE_LIFECYCLE_STEPS } from '../lib/navigation'
import { CHECKLIST_SEED, getSeedStats, isSeedFinalized, seedImportProgress } from '../data/checklistLoader'
import { Button, Card, Input, Select } from './ui/Badge'
import type { CompanyId } from '../types'

export type SettingsSection = 'standard' | 'procedure' | 'system'

export function SettingsPanel({ store, section }: { store: AuditStore; section: SettingsSection }) {
  const { state, updateSettings, updateCompanyAuditProfile, exportJSON, importJSON, resetToDemo, clearAll } = store
  const fileRef = useRef<HTMLInputElement>(null)

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = reader.result as string
        const preview = parseBackupJson(json)
        const msg = `確定還原備份？\n\n${describeBackup(preview)}\n\n目前資料將被覆寫（localStorage v6）。`
        if (!confirm(msg)) return
        importJSON(json)
        alert('還原成功')
      } catch (err) {
        alert(err instanceof Error ? err.message : '還原失敗：備份格式錯誤')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleBackup = () => {
    const json = exportJSON()
    downloadBlob(new Blob([json], { type: 'application/json' }), backupFilename(state))
  }

  const handleExportAllExcel = (companyId: CompanyId) => {
    exportAllFormsExcel(state, companyId)
  }

  const seedStats = getSeedStats()
  const profile = state.companyAuditProfiles[state.activeCompanyId]
  const activeCompany = state.companies[state.activeCompanyId]
  const archivedYears = Object.keys(state.yearArchives).sort((a, b) => Number(a) - Number(b))
  const startedAudits = activeCompany.audits.filter((audit) => audit.status && audit.status !== '規劃中')
  const sourceSnapshottedAudits = startedAudits.filter((audit) => Boolean(
    audit.procedureCodeSnapshot
      && audit.procedureVersion
      && audit.formalRecordLocationSnapshot
      && audit.standardSnapshot?.length,
  ))
  const linkedNcrs = activeCompany.ncrs.filter((ncr) => Boolean(ncr.sourceAuditId || ncr.checklistItemId)).length
  const linkedObservations = activeCompany.observations.filter((item) => Boolean(item.sourceAuditId || item.sourceChecklistItemId)).length
  const procedureSourceReady = Boolean(
    profile.auditProcedureCode.trim()
      && profile.auditProcedureVersion.trim()
      && profile.auditProcedureVersion !== '待確認'
      && profile.formalRecordLocation.trim(),
  )
  const checklistReady = isSeedFinalized()

  return (
    <div className="space-y-6">
      {section === 'standard' && <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">標準適用性與公司／廠區</h2>
            <p className="mt-1 text-sm text-slate-600">目前公司：{state.company.name}。標準適用性須以證書、客戶要求或公司正式決議確認。</p>
          </div>
          <Button variant="secondary" className="no-print" onClick={() => exportStandardExcel(state, state.activeCompanyId)}>匯出 Excel</Button>
        </div>
        <div className="space-y-3">{state.companyAuditProfiles[state.activeCompanyId].applicableStandards.map((standard, index) => <div key={standard.name} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4"><label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">標準</span><span className="flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{standard.name}</span></label><Input label="版本" value={standard.version} onChange={(value) => { const standards = [...state.companyAuditProfiles[state.activeCompanyId].applicableStandards]; standards[index] = { ...standard, version: value }; updateCompanyAuditProfile(state.activeCompanyId, { applicableStandards: standards }) }} /><Select label="適用性" value={standard.confirmationStatus} onChange={(value) => { const standards = [...state.companyAuditProfiles[state.activeCompanyId].applicableStandards]; standards[index] = { ...standard, confirmationStatus: value as 'pending' | 'confirmed' }; updateCompanyAuditProfile(state.activeCompanyId, { applicableStandards: standards }) }} options={[{ value: 'pending', label: '待確認' }, { value: 'confirmed', label: '已確認' }]} /><Input label="依據引用（證書／決議）" value={standard.evidenceReference} onChange={(value) => { const standards = [...state.companyAuditProfiles[state.activeCompanyId].applicableStandards]; standards[index] = { ...standard, evidenceReference: value }; updateCompanyAuditProfile(state.activeCompanyId, { applicableStandards: standards }) }} /></div>)}</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Input label="證書範圍" value={state.companyAuditProfiles[state.activeCompanyId].certificateScope} onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { certificateScope: value })} /><Input label="證書／依據編號" value={state.companyAuditProfiles[state.activeCompanyId].certificateReference} onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { certificateReference: value })} /></div>
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <h3 className="font-bold">ISO 9001／AS9100 稽核程序解讀</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>年度、月份與風險分數是公司政策及規劃工具；標準沒有規定所有程序固定每年一次或使用特定分數公式。</li>
            <li>同單位任職會觸發客觀性警示，仍須依實際職責、控制措施與稽核證據判斷，不以職稱或部門自動判定符合／不符合。</li>
            <li>系統檢查資格範圍、日期與任命引用，但正式能力準則及核准仍由公司或外部機構的受控紀錄決定。</li>
            <li>ISO 9001 版本狀態正在轉換；確認適用版本前，請核對有效證書、合約／法規及驗證機構通知。</li>
          </ul>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a className="font-bold underline" href="https://www.iso.org/standard/62085.html" target="_blank" rel="noreferrer">ISO 9001:2015 官方狀態</a>
            <a className="font-bold underline" href="https://iaqg.org/wp-content/uploads/2023/04/9100-2016-Series-Clarification-Table-2024-02-12.pdf" target="_blank" rel="noreferrer">IAQG 9100:2016 官方澄清</a>
          </p>
        </div>
      </Card>}

      {section === 'procedure' && <div className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">程序與正式紀錄來源</h2>
              <p className="mt-1 text-sm text-slate-600">本頁不是另一份稽核結果表，而是確認「依哪一份程序、哪個版本、在哪裡保存正式紀錄」的受控來源表單。</p>
            </div>
            <span className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${procedureSourceReady ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`} role="status">
              {procedureSourceReady ? '程序來源已具備' : '程序來源待確認'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="稽核程序代碼" value={profile.auditProcedureCode} onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { auditProcedureCode: value })} />
            <Input label="程序版本" value={profile.auditProcedureVersion} onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { auditProcedureVersion: value })} />
            <Input label="正式紀錄保存位置" value={profile.formalRecordLocation} onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { formalRecordLocation: value })} />
          </div>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
            <h3 className="font-semibold">為什麼需要這一頁？</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>避免稽核人員使用錯誤的程序版本或未受控的查檢表。</li>
              <li>讓每一筆查檢結果都能回溯到程序代碼、版本與正式紀錄位置。</li>
              <li>「程序版本」會在開始稽核前列入檢查；保存位置是追溯控制資訊，不會把現有資料自動搬到其他頁面。</li>
            </ul>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">查檢表來源與覆蓋範圍</h2>
              <p className="text-sm text-slate-500">這些是稽核執行表單會使用的受控種子資料；本頁只呈現來源與完整性，不重複編輯查檢內容。</p>
            </div>
            <span className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${checklistReady ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`} role="status">
              {checklistReady ? '查檢表來源已封存' : seedImportProgress() ?? '查檢表來源待完成'}
            </span>
          </div>
          <div className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-3">
            <span>資料版本：{CHECKLIST_SEED.version}</span>
            <span>種子年度：{CHECKLIST_SEED.year}</span>
            <span>稽核重點：{seedStats.focusRows} 列</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead><tr className="bg-slate-50 text-left"><th className="border p-2">正式表單</th><th className="border p-2">用途</th><th className="border p-2">目前來源數量</th><th className="border p-2">使用入口</th></tr></thead>
              <tbody>
                <tr><td className="border p-2 font-medium">QR-28-01 年度稽核計畫</td><td className="border p-2">年度方案與月格排程</td><td className="border p-2">{seedStats.procedureEntries} 程序列／{seedStats.qpCoverage} 個 QP</td><td className="border p-2"><a className="font-medium text-blue-700 underline" href="#tab=plan">年度稽核計畫</a></td></tr>
                <tr><td className="border p-2 font-medium">QR-28-02 程序查檢表</td><td className="border p-2">稽核執行、判定與客觀證據</td><td className="border p-2">{seedStats.systemItems} 項系統稽核</td><td className="border p-2"><a className="font-medium text-blue-700 underline" href="#tab=audit">稽核執行與證據</a></td></tr>
                <tr><td className="border p-2 font-medium">QR-28-03 不符合</td><td className="border p-2">不符合、矯正措施與效果確認</td><td className="border p-2">由稽核判定自動產生</td><td className="border p-2"><a className="font-medium text-blue-700 underline" href="#tab=ncr">不符合與矯正措施</a></td></tr>
                <tr><td className="border p-2 font-medium">QR-28-04／05</td><td className="border p-2">製程／型態稽核查檢</td><td className="border p-2">{seedStats.processItems}／{seedStats.configItems} 項</td><td className="border p-2"><a className="font-medium text-blue-700 underline" href="#tab=audit">稽核執行與證據</a></td></tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">流程銜接</h2>
            <Button variant="secondary" className="no-print" onClick={() => exportAllAuditsExcel(state, state.activeCompanyId)}>匯出全部 QR-28-02</Button>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PROCEDURE_LIFECYCLE_STEPS.map((step) => {
              const label = getTabWorkflow(step.tab)?.label ?? step.tab
              const isCurrent = step.tab === 'procedure'
              return (
                <li key={step.step} className={`rounded-lg border p-3 ${isCurrent ? 'border-blue-200 bg-blue-50' : 'border-slate-200'}`}>
                  <span className={`block text-xs font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-500'}`}>{step.step}</span>
                  {isCurrent ? (
                    <span className="font-medium text-blue-900">{label}</span>
                  ) : (
                    <a className="font-medium text-blue-700 underline" href={buildAppHash(step.tab)}>{label}</a>
                  )}
                  <p className={`mt-1 text-xs ${isCurrent ? 'text-blue-800' : 'text-slate-500'}`}>{step.note}</p>
                </li>
              )
            })}
          </ol>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">年度資料生命週期與追溯</h2>
            <p className="mt-1 text-sm text-slate-600">系統把「受控來源」、「本年度工作資料」與「已發生的稽核紀錄」分開管理；年度切換只切換年度資料集，不會覆蓋其他年度。</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-500">01 · 受控來源主檔</p>
              <h3 className="mt-1 font-semibold">標準／程序／查檢表種子</h3>
              <p className="mt-2 text-sm text-slate-600">可依正式文件改版；在稽核開始前確認適用版本，不能用新主檔回寫已完成事件。</p>
              <a className="mt-3 inline-block text-sm font-medium text-blue-700 underline" href="#tab=standard">前往標準</a>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-700">02 · 年度工作資料</p>
              <h3 className="mt-1 font-semibold text-blue-950">{state.settings.auditYear} 年／{activeCompany.name}</h3>
              <p className="mt-2 text-sm text-blue-900">計畫 {activeCompany.planRows.length} 列 · 稽核事件 {activeCompany.audits.length} 件 · 不符合 {activeCompany.ncrs.length} 件 · 觀察 {activeCompany.observations.length} 件。</p>
              <a className="mt-3 inline-block text-sm font-medium text-blue-700 underline" href="#tab=plan">前往年度稽核計畫</a>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-500">03 · 歷史紀錄</p>
              <h3 className="mt-1 font-semibold">事件快照與改善鏈</h3>
              <p className="mt-2 text-sm text-slate-600">已開始事件來源快照 {sourceSnapshottedAudits.length}/{startedAudits.length}；有來源連結的不符合 {linkedNcrs} 件、觀察 {linkedObservations} 件。</p>
              <a className="mt-3 inline-block text-sm font-medium text-blue-700 underline" href="#tab=audit">前往稽核執行與證據</a>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <ul className="list-disc space-y-1 pl-5">
              <li>年度維護：目前年度資料會在切換年度時封存；已存在年度可返回續編，新年度建立自己的計畫、事件與準備資料。已保存年度：{archivedYears.length ? archivedYears.join('、') : '尚無其他年度'}。</li>
              <li>資料變動：年度計畫、稽核日期、查檢判定與證據可依實際工作更新；不符合與觀察事項由來源事件／查檢項目連結，後續矯正與追蹤在結果表單完成。</li>
              <li>紀錄追溯：開始稽核時固定適用標準、程序代碼／版本、正式紀錄位置與團隊快照；回報後查檢內容鎖定，避免後來改版的主檔改寫歷史。</li>
            </ul>
          </div>
        </Card>
      </div>}

      {section === 'system' && <>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">內部評分</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="符合得分"
            type="number"
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
        <h2 className="mb-4 text-lg font-semibold">資料備份與還原</h2>
        <p className="mb-4 text-sm text-slate-500">
          完整備份含雙公司資料、設定、外部稽核前準備與版本號。儲存於 localStorage key
          <code className="mx-1 rounded bg-slate-100 px-1">qms-annual-internal-audit-v6</code>。
          還原前會確認覆寫；舊版 v5/v4/v1 備份會自動遷移。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleBackup}>備份</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            還原
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">QR-28 表單匯出（Excel）</h2>
        <p className="mb-4 text-sm text-slate-500">
          一次匯出 QR-28-01 年度計畫、全部 QR-28-02 程序查檢表、QR-28-03 不符合、建議追蹤與稽核前準備（多工作表）。
          各 tab 亦可單獨匯出。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => handleExportAllExcel('jiurun')}>
            匯出九潤全部表單
          </Button>
          <Button variant="secondary" onClick={() => handleExportAllExcel('zhenglongxing')}>
            匯出正隆興全部表單
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">資料檢查與危險操作</h2>
        <p className="mb-4 text-sm text-slate-600">目前資料版本 v{state.version}；{state.people.length} 名人員、{Object.keys(state.yearArchives).length + 1} 個年度資料集。執行前請先下載完整備份。</p>
        <div className="mb-5 flex flex-wrap gap-3"><Button variant="secondary" onClick={() => { if (confirm('確定還原為示範資料？')) resetToDemo() }}>還原示範資料</Button><Button variant="danger" onClick={() => { if (confirm('確定清除所有資料？此操作無法復原。')) clearAll() }}>清除全部資料</Button></div>
        <h3 className="mb-2 font-semibold">關於</h3>
        <p className="text-sm text-slate-600">
          QMS 年度內部稽核系統 v6 — 程序導向（QP 查檢表）、雙公司切換、
          對應 QR-28-01/02/03/04/05 及 QR-02-01 風險矩陣。
          目前公司：{state.company.name}
        </p>
      </Card>
      </>}
    </div>
  )
}
