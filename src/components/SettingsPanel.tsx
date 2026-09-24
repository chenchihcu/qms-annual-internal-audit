import { useEffect, useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { backupFilename, describeBackup, parseBackupJson } from '../lib/backup'
import { downloadBlob } from '../lib/download'
import { exportAllAuditsExcel, exportAllFormsExcel, exportAnnualPlanHtml, exportAuditHtml, exportStandardExcel } from '../lib/formExport'
import { buildAppHash, tabLabel } from '../lib/navigation'
import {
  PROFILE_SNAPSHOT_READY_MESSAGE,
  procedureFieldErrors,
  standardFieldErrors,
} from '../lib/auditProfileValidation'
import { procedureSourceReady, standardReady } from '../lib/workflowStatus'
import { CHECKLIST_SEED, getSeedStats, isSeedFinalized, seedImportProgress } from '../data/checklistLoader'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { PageToolbar } from './ui/PageToolbar'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'
import type { CompanyId } from '../types'

export type SettingsSection = 'standard' | 'procedure' | 'system'

export function SettingsPanel({ store, section }: { store: AuditStore; section: SettingsSection }) {
  const { state, updateSettings, updateCompanyAuditProfile, exportJSON, importJSON, resetToDemo, clearAll } = store
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingRestore, setPendingRestore] = useState<{ json: string; summary: string } | null>(null)
  const [showDemoDialog, setShowDemoDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [scoringSavedMessage, setScoringSavedMessage] = useState(false)
  const [profileReadyMessage, setProfileReadyMessage] = useState(false)
  const prevProfileReadyRef = useRef<boolean | null>(null)
  const profile = state.companyAuditProfiles[state.activeCompanyId]

  const profileReady =
    section === 'standard'
      ? standardReady(state, state.activeCompanyId)
      : section === 'procedure'
        ? procedureSourceReady(state, state.activeCompanyId)
        : null

  useEffect(() => {
    if (profileReady === null) return
    if (prevProfileReadyRef.current === false && profileReady) {
      setProfileReadyMessage(true)
    }
    if (!profileReady) {
      setProfileReadyMessage(false)
    }
    prevProfileReadyRef.current = profileReady
  }, [profileReady])

  const procedureErrors = section === 'procedure' ? procedureFieldErrors(profile) : null
  const standardErrors = section === 'standard' ? standardFieldErrors(profile) : null

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
  }

  const handleExportAllExcel = (companyId: CompanyId) => {
    exportAllFormsExcel(state, companyId)
  }

  const seedStats = getSeedStats()
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
  const checklistReady = isSeedFinalized()

  return (
    <div className="space-y-6">
      {section === 'standard' && <Card className="print-area qr-form">
        <PrintDocHeader
          companyName={state.company.name}
          auditYear={state.settings.auditYear}
          formTitle="適用標準與證書範圍"
        />
        <PageToolbar
          title="標準"
          actions={<Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportStandardExcel(state, state.activeCompanyId)}>匯出 Excel</Button>}
        />
        <div className="space-y-3">
          {profile.applicableStandards.map((standard, index) => (
            <div key={standard.name} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">標準</span>
                <span className="flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{standard.name}</span>
              </label>
              <Input
                label="版本"
                value={standard.version}
                onChange={(value) => {
                  const standards = [...state.companyAuditProfiles[state.activeCompanyId].applicableStandards]
                  standards[index] = { ...standard, version: value }
                  updateCompanyAuditProfile(state.activeCompanyId, { applicableStandards: standards })
                }}
              />
              <Select
                label="適用性"
                value={standard.confirmationStatus}
                onChange={(value) => {
                  const standards = [...state.companyAuditProfiles[state.activeCompanyId].applicableStandards]
                  standards[index] = { ...standard, confirmationStatus: value as 'pending' | 'confirmed' }
                  updateCompanyAuditProfile(state.activeCompanyId, { applicableStandards: standards })
                }}
                options={[{ value: 'pending', label: '待確認' }, { value: 'confirmed', label: '已確認' }]}
              />
              <Input
                label="依據引用（證書／決議）"
                value={standard.evidenceReference}
                error={standardErrors?.evidenceByIndex[index]}
                onChange={(value) => {
                  const standards = [...state.companyAuditProfiles[state.activeCompanyId].applicableStandards]
                  standards[index] = { ...standard, evidenceReference: value }
                  updateCompanyAuditProfile(state.activeCompanyId, { applicableStandards: standards })
                }}
              />
            </div>
          ))}
          {standardErrors?.confirmation && (
            <p className="text-xs font-medium text-red-700" role="alert">{standardErrors.confirmation}</p>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            label="證書範圍"
            value={state.companyAuditProfiles[state.activeCompanyId].certificateScope}
            error={standardErrors?.certificateScope}
            onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { certificateScope: value })}
          />
          <Input
            label="證書／依據編號"
            value={state.companyAuditProfiles[state.activeCompanyId].certificateReference}
            error={standardErrors?.certificateReference}
            onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { certificateReference: value })}
          />
        </div>
        {profileReadyMessage && profileReady && (
          <p className="mt-3 text-sm text-green-700" role="status">{PROFILE_SNAPSHOT_READY_MESSAGE}</p>
        )}
      </Card>}

      {section === 'procedure' && <Card>
        <PageToolbar title="程序" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="稽核程序代碼"
            value={profile.auditProcedureCode}
            error={procedureErrors?.auditProcedureCode}
            onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { auditProcedureCode: value })}
          />
          <Input
            label="程序版本"
            value={profile.auditProcedureVersion}
            error={procedureErrors?.auditProcedureVersion}
            onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { auditProcedureVersion: value })}
          />
          <Input
            label="正式紀錄保存位置"
            value={profile.formalRecordLocation}
            error={procedureErrors?.formalRecordLocation}
            onChange={(value) => updateCompanyAuditProfile(state.activeCompanyId, { formalRecordLocation: value })}
          />
        </div>
        {profileReadyMessage && profileReady && (
          <p className="mt-3 text-sm text-green-700" role="status">{PROFILE_SNAPSHOT_READY_MESSAGE}</p>
        )}
      </Card>}

      {section === 'system' && <>
      <Card>
        <h2 className="mb-4 text-sm font-semibold">評分與備份</h2>
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
            onBlur={() => setScoringSavedMessage(true)}
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
            onBlur={() => setScoringSavedMessage(true)}
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
            onBlur={() => setScoringSavedMessage(true)}
          />
        </div>
        {scoringSavedMessage && (
          <p className="mt-3 text-sm text-green-700" role="status">評分規則已寫入</p>
        )}
        <p className="mt-4 text-sm text-slate-500">
          完整備份含雙公司資料、設定、外部稽核前準備與版本號（本機備份 v7）。
          還原前會確認覆寫；舊版 v5/v4/v1 備份會自動遷移。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button icon={ACTION_ICONS.backup} onClick={handleBackup}>備份</Button>
          <Button variant="secondary" icon={ACTION_ICONS.restore} onClick={() => fileRef.current?.click()}>
            還原
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} />
        </div>
        {restoreStatus && (
          <p
            className={`mt-3 text-sm ${restoreStatus.type === 'success' ? 'text-green-700' : 'text-red-700'}`}
            role="status"
          >
            {restoreStatus.message}
          </p>
        )}
        {pendingRestore && (
          <ConfirmDialog
            open
            title="確定還原備份？"
            description={`${pendingRestore.summary}\n\n目前資料將被覆寫（本機備份 v7）。`}
            confirmLabel="確認還原"
            variant="danger"
            onConfirm={confirmRestore}
            onCancel={() => setPendingRestore(null)}
          />
        )}
      </Card>

      <Card>
        <PageToolbar title="全部表單匯出" />
        <p className="mb-4 text-sm text-slate-500">
          一次匯出目前公司全部工作表；各頁亦可單獨匯出。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => handleExportAllExcel('jiurun')}>
            匯出九潤全部表單
          </Button>
          <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => handleExportAllExcel('zhenglongxing')}>
            匯出正隆興全部表單
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          <Button variant="ghost" icon={ACTION_ICONS.exportHtml} onClick={() => exportAnnualPlanHtml(state, state.activeCompanyId)}>
            年度計畫 HTML
          </Button>
          {activeCompany.audits[0] && (
            <Button variant="ghost" icon={ACTION_ICONS.exportHtml} onClick={() => exportAuditHtml(state, state.activeCompanyId, activeCompany.audits[0])}>
              首筆查檢表 HTML
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <details>
          <summary className="mb-4 cursor-pointer text-sm font-semibold">ISO 9001／AS9100 稽核程序解讀</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>年度、月份與風險分數是公司政策及規劃工具；標準沒有規定所有程序固定每年一次或使用特定分數公式。</li>
            <li>同單位任職會觸發客觀性警示，仍須依實際職責、控制措施與稽核證據判斷，不以職稱或部門自動判定符合／不符合。</li>
            <li>系統檢查資格範圍、日期與任命引用，但正式能力準則及核准仍由公司或外部機構的受控紀錄決定。</li>
            <li>ISO 9001 版本狀態正在轉換；確認適用版本前，請核對有效證書、合約／法規及驗證機構通知。</li>
          </ul>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a className="font-bold text-blue-700 underline" href="https://www.iso.org/standard/62085.html" target="_blank" rel="noreferrer">
              ISO 9001:2015 官方狀態<span className="sr-only">（另開新視窗）</span>
            </a>
            <a className="font-bold text-blue-700 underline" href="https://iaqg.org/wp-content/uploads/2023/04/9100-2016-Series-Clarification-Table-2024-02-12.pdf" target="_blank" rel="noreferrer">
              IAQG 9100:2016 官方澄清<span className="sr-only">（另開新視窗）</span>
            </a>
          </p>
        </details>
      </Card>

      <Card>
        <details>
          <summary className="mb-4 cursor-pointer text-sm font-semibold">查檢表來源與覆蓋範圍</summary>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <Badge label={checklistReady ? '查檢表來源已封存' : (seedImportProgress() ?? '查檢表來源待完成')} />
            <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportAllAuditsExcel(state, state.activeCompanyId)}>匯出全部 QR-28-02</Button>
          </div>
          <div className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-3">
            <span>資料版本：{CHECKLIST_SEED.version}</span>
            <span>種子年度：{CHECKLIST_SEED.year}</span>
            <span>稽核重點：{seedStats.focusRows} 列</span>
          </div>
          <ScrollRegion ariaLabel="查檢表來源與覆蓋範圍">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead><tr className="bg-slate-50 text-left"><th className="border p-2">正式表單</th><th className="border p-2">用途</th><th className="border p-2">目前來源數量</th><th className="border p-2">使用入口</th></tr></thead>
              <tbody>
                <tr><td className="border p-2 font-medium">QR-28-01 年度稽核計畫</td><td className="border p-2">年度方案與月格排程</td><td className="border p-2">{seedStats.procedureEntries} 程序列／{seedStats.qpCoverage} 個 QP</td><td className="border p-2"><a className="font-medium text-blue-700 underline" href={buildAppHash('plan')}>{tabLabel('plan')}</a></td></tr>
                <tr><td className="border p-2 font-medium">QR-28-02 程序查檢表</td><td className="border p-2">稽核執行、判定與客觀證據</td><td className="border p-2">{seedStats.systemItems} 項系統稽核</td><td className="border p-2"><a className="font-medium text-blue-700 underline" href={buildAppHash('audit')}>{tabLabel('audit')}</a></td></tr>
                <tr><td className="border p-2 font-medium">QR-28-03 不符合</td><td className="border p-2">不符合、矯正措施與效果確認</td><td className="border p-2">由稽核判定自動產生</td><td className="border p-2"><a className="font-medium text-blue-700 underline" href={buildAppHash('ncr')}>{tabLabel('ncr')}</a></td></tr>
                <tr><td className="border p-2 font-medium">QR-28-04／05</td><td className="border p-2">製程／型態稽核查檢</td><td className="border p-2">{seedStats.processItems}／{seedStats.configItems} 項</td><td className="border p-2"><a className="font-medium text-blue-700 underline" href={buildAppHash('audit')}>{tabLabel('audit')}</a></td></tr>
              </tbody>
            </table>
          </ScrollRegion>
        </details>
      </Card>

      <Card>
        <details>
          <summary className="mb-4 cursor-pointer text-sm font-semibold">年度資料生命週期與追溯</summary>
          <p className="mb-4 text-sm text-slate-600">系統把「受控來源」、「本年度工作資料」與「已發生的稽核紀錄」分開管理；年度切換只切換年度資料集，不會覆蓋其他年度。</p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>
              <strong>受控來源主檔</strong>：標準／程序／查檢表種子可依正式文件改版；在稽核開始前確認適用版本，不能用新主檔回寫已完成事件。
              {' '}
              <a className="font-medium text-blue-700 underline" href={buildAppHash('standard')}>{tabLabel('standard')}</a>
            </li>
            <li>
              <strong>{state.settings.auditYear} 年／{activeCompany.name} 工作資料</strong>
              <ScrollRegion ariaLabel="本年度工作資料統計表">
                <table className="mt-2 w-full min-w-[360px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="border p-2">項目</th>
                      <th className="border p-2 w-24">數量</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2">計畫列</td>
                      <td className="border p-2">{activeCompany.planRows.length}</td>
                    </tr>
                    <tr>
                      <td className="border p-2">稽核事件</td>
                      <td className="border p-2">{activeCompany.audits.length}</td>
                    </tr>
                    <tr>
                      <td className="border p-2">不符合</td>
                      <td className="border p-2">{activeCompany.ncrs.length}</td>
                    </tr>
                    <tr>
                      <td className="border p-2">觀察</td>
                      <td className="border p-2">{activeCompany.observations.length}</td>
                    </tr>
                  </tbody>
                </table>
              </ScrollRegion>
              {' '}
              <a className="font-medium text-blue-700 underline" href={buildAppHash('plan')}>{tabLabel('plan')}</a>
            </li>
            <li>
              <strong>歷史紀錄</strong>
              <ScrollRegion ariaLabel="追溯統計表">
                <table className="mt-2 w-full min-w-[360px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="border p-2">項目</th>
                      <th className="border p-2 w-24">數量</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2">已開始事件來源快照</td>
                      <td className="border p-2">{sourceSnapshottedAudits.length}/{startedAudits.length}</td>
                    </tr>
                    <tr>
                      <td className="border p-2">有來源連結的不符合</td>
                      <td className="border p-2">{linkedNcrs}</td>
                    </tr>
                    <tr>
                      <td className="border p-2">有來源連結的觀察</td>
                      <td className="border p-2">{linkedObservations}</td>
                    </tr>
                  </tbody>
                </table>
              </ScrollRegion>
              {' '}
              <a className="font-medium text-blue-700 underline" href={buildAppHash('audit')}>{tabLabel('audit')}</a>
            </li>
            <li>年度維護：目前年度資料會在切換年度時封存；已存在年度可返回續編，新年度建立自己的計畫、事件與準備資料。已保存年度：{archivedYears.length ? archivedYears.join('、') : '尚無其他年度'}。</li>
            <li>資料變動：年度計畫、稽核日期、查檢判定與證據可依實際工作更新；不符合與觀察事項由來源事件／查檢項目連結，後續矯正與追蹤在結果表單完成。</li>
            <li>紀錄追溯：開始稽核時固定適用標準、程序代碼／版本、正式紀錄位置與團隊快照；回報後查檢內容鎖定，避免後來改版的主檔改寫歷史。</li>
          </ul>
        </details>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold">資料檢查與危險操作</h2>
        <p className="mb-4 text-sm text-slate-600">目前資料版本 v{state.version}；{state.people.length} 名人員、{Object.keys(state.yearArchives).length + 1} 個年度資料集。執行前請先下載完整備份。</p>
        <div className="mb-5 flex flex-wrap gap-3">
          <Button variant="secondary" icon={ACTION_ICONS.resetDemo} onClick={() => setShowDemoDialog(true)}>還原示範資料</Button>
          <Button variant="danger" icon={ACTION_ICONS.delete} onClick={() => setShowClearDialog(true)}>清除全部資料</Button>
        </div>
        {showDemoDialog && (
          <ConfirmDialog
            open
            title="還原為示範資料？"
            description="目前所有工作資料將被示範資料取代。建議先下載完整備份。"
            confirmLabel="確認還原"
            variant="danger"
            onConfirm={() => {
              resetToDemo()
              setShowDemoDialog(false)
            }}
            onCancel={() => setShowDemoDialog(false)}
          />
        )}
        {showClearDialog && (
          <ConfirmDialog
            open
            title="清除全部資料？"
            description="此操作無法復原，將清除本機所有年度與公司資料。執行前請先下載完整備份。"
            confirmLabel="確認清除"
            variant="danger"
            onConfirm={() => {
              clearAll()
              setShowClearDialog(false)
            }}
            onCancel={() => setShowClearDialog(false)}
          />
        )}
      </Card>
      </>}
    </div>
  )
}
