import { useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { canRemoveCompanyFromPlanRow, COMPANY_IDS, getLegacyPlanConflicts } from '../lib/sharedPlan'
import { COMPANY_LABELS, MONTH_STATUS_LEGEND, getCompanyManagementReviewDate } from '../types'
import type { CompanyId, MonthStatus, SharedPlanRow } from '../types'
import { Badge, Button, Card, Input } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PrintDocHeader } from './ui/PrintDocHeader'

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

function statusClass(status: MonthStatus): string {
  const found = MONTH_STATUS_LEGEND.find((l) => l.status === status)
  return found?.color ?? ''
}

function resultSummary(statuses: MonthStatus[]): string {
  const values = statuses.flatMap((status, index) =>
    status && status !== '擬定' ? [`${index + 1} 月 ${status}`] : [],
  )
  return values.join('、') || '尚無結果'
}

function getPlanWindowError(start: string, end: string): string | undefined {
  return start && end && start > end ? '計畫窗口起日不可晚於迄日。' : undefined
}

export function AnnualPlan({ store }: { store: AuditStore }) {
  const { state, updateSettings, regeneratePlan, updatePlanRow, updatePlanScope, confirmSharedPlan, setSharedPlanMonth, setCompanyPlanMonthStatus } =
    store
  const { settings, sharedPlanRows } = state
  const conflicts = getLegacyPlanConflicts(state)
  const [conflictChoices, setConflictChoices] = useState<Record<string, CompanyId>>({})
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const resultPanelRef = useRef<HTMLDivElement>(null)
  const selectedResultRow = sharedPlanRows?.find((row) => row.id === expandedRowId)

  const showResultRow = (rowId: string) => {
    if (expandedRowId === rowId) {
      setExpandedRowId(null)
      return
    }
    setExpandedRowId(rowId)
    window.requestAnimationFrame(() => resultPanelRef.current?.scrollIntoView({ block: 'start' }))
  }

  const [yearDraft, setYearDraft] = useState(String(settings.auditYear))
  const [yearError, setYearError] = useState<string | null>(null)
  const [dateWindowError, setDateWindowError] = useState(() =>
    getPlanWindowError(settings.planWindowStart, settings.planWindowEnd),
  )
  const [yearDialog, setYearDialog] = useState<{ open: boolean; newYear: number }>({
    open: false,
    newYear: settings.auditYear,
  })
  const [regenConfirm, setRegenConfirm] = useState(false)

  const requestYearChange = () => {
    const raw = yearDraft.trim()
    if (!raw || !/^\d{1,4}$/.test(raw) || Number(raw) < 1) {
      setYearError('請輸入 1 至 9999 的有效年度。')
      return
    }
    const n = Number(raw)
    setYearError(null)
    if (n === settings.auditYear) return
    setYearDialog({ open: true, newYear: n })
  }

  const confirmYearKeepPrep = () => {
    updateSettings({ auditYear: yearDialog.newYear }, { resetExternalPrep: false })
    setYearDraft(String(yearDialog.newYear))
    setYearError(null)
    setYearDialog({ open: false, newYear: yearDialog.newYear })
  }

  const confirmYearResetPrep = () => {
    updateSettings({ auditYear: yearDialog.newYear }, { resetExternalPrep: true })
    setYearDraft(String(yearDialog.newYear))
    setYearError(null)
    setYearDialog({ open: false, newYear: yearDialog.newYear })
  }

  const cancelYearChange = () => {
    setYearDraft(String(settings.auditYear))
    setYearError(null)
    setYearDialog({ open: false, newYear: settings.auditYear })
  }

  if (!sharedPlanRows) {
    return (
      <div className="space-y-4">
        <Card>
          <h2 className="text-lg font-semibold text-ink">確認兩家公司舊計畫差異</h2>
          <p className="mt-2 text-sm text-muted">
            此資料原本保存兩份年度計畫。請逐列選擇這場共同稽核要採用的時程及人員；
            兩家公司原計畫會保留在 JSON 備份，既有查檢表與結果不會被覆寫。
          </p>
          {conflicts.length === 0 ? (
            <p className="mt-4 text-sm text-amber-800" role="alert">共用計畫尚未建立；請匯出 JSON 備份並確認資料結構。</p>
          ) : (
            <div className="mt-4 space-y-4">
              {conflicts.map((conflict) => (
                <section key={conflict.id} className="rounded-lg border border-line p-4" aria-label={`${conflict.qpCode} ${conflict.department} 差異`}>
                  <h3 className="font-semibold text-ink">{conflict.qpCode} · {conflict.department}</h3>
                  <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={`${conflict.qpCode} 差異表，可橫向捲動`}>
                    <p className="horizontal-scroll-hint mb-2 text-xs text-muted no-print">可橫向捲動</p>
                    <table className="w-full min-w-[600px] border-collapse text-sm">
                      <thead><tr><th className="border border-line p-2 text-left">不同欄位</th><th className="border border-line p-2 text-left">九潤精密</th><th className="border border-line p-2 text-left">正隆興精密</th></tr></thead>
                      <tbody>{conflict.fields.map((field) => (
                        <tr key={field.label}><th scope="row" className="border border-line p-2 text-left">{field.label}</th><td className="border border-line p-2">{field.jiurun}</td><td className="border border-line p-2">{field.zhenglongxing}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <label className="mt-3 block text-sm font-medium text-ink" htmlFor={`source-${conflict.id}`}>採用來源</label>
                  <select
                    id={`source-${conflict.id}`}
                    value={conflictChoices[conflict.id] ?? ''}
                    onChange={(event) => setConflictChoices((choices) => ({ ...choices, [conflict.id]: event.target.value as CompanyId }))}
                    className={`mt-1 min-h-11 w-full max-w-sm rounded-lg border border-line bg-surface px-3 ${FOCUS_RING}`}
                  >
                    <option value="">請選擇</option>
                    {COMPANY_IDS.map((id) => <option key={id} value={id}>{COMPANY_LABELS[id]}原計畫</option>)}
                  </select>
                </section>
              ))}
              <Button
                disabled={conflicts.some((conflict) => !conflictChoices[conflict.id])}
                onClick={() => confirmSharedPlan(conflictChoices)}
              >
                確認一份共用計畫
              </Button>
            </div>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <ConfirmDialog
        open={yearDialog.open}
        title="變更稽核年度"
        description={`將稽核年度改為 ${yearDialog.newYear} 年。預設會保留外部稽核準備清單的勾選與備註，僅更新年度標記。`}
        confirmLabel="保留準備清單"
        secondaryLabel="改為空白新年清單"
        onConfirm={confirmYearKeepPrep}
        onSecondary={confirmYearResetPrep}
        onCancel={cancelYearChange}
      />
      <ConfirmDialog
        open={regenConfirm}
        title="自動排程年度計畫"
        description="依風險與計畫窗口重算未手動調整的月格；已手動調整的列會保留。"
        confirmLabel="重新編排"
        onConfirm={() => {
          regeneratePlan()
          setRegenConfirm(false)
        }}
        onCancel={() => setRegenConfirm(false)}
      />

      <Card>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 no-print">
          <h2 className="text-lg font-semibold text-ink">年度稽核計畫（QR-28-01）</h2>
          <Button onClick={() => setRegenConfirm(true)}>自動排程</Button>
        </div>
        <p className="mb-4 text-sm text-muted no-print">兩家公司共用時程、文件與稽核人員；勾選月份排程。新建查檢表帶入資料，既有表單維持快照；各公司判定與結果分開保存。</p>

        <details className="mb-6 rounded-lg border border-line p-3 no-print">
          <summary className="cursor-pointer font-medium text-ink">計畫設定</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="稽核年度"
            type="number"
            min={1}
            max={9999}
            step="1"
            value={yearDraft}
            onChange={setYearDraft}
            onBlur={requestYearChange}
            error={yearError ?? undefined}
          />
          <Input
            label="主任稽核員"
            value={settings.leadAuditor}
            onChange={(v) => updateSettings({ leadAuditor: v })}
          />
          <Input
            label="年度起始"
            type="date"
            value={settings.yearStart}
            onChange={(v) => updateSettings({ yearStart: v })}
          />
          <Input
            label="計畫窗口起"
            type="date"
            value={settings.planWindowStart}
            onChange={(v) => {
              updateSettings({ planWindowStart: v })
              setDateWindowError(getPlanWindowError(v, settings.planWindowEnd))
            }}
            onBlur={(start) => setDateWindowError(getPlanWindowError(start, settings.planWindowEnd))}
          />
          <Input
            label="計畫窗口迄"
            type="date"
            value={settings.planWindowEnd}
            onChange={(v) => {
              updateSettings({ planWindowEnd: v })
              setDateWindowError(getPlanWindowError(settings.planWindowStart, v))
            }}
            onBlur={(end) => setDateWindowError(getPlanWindowError(settings.planWindowStart, end))}
            error={dateWindowError}
          />
          <Input
            label="外部稽核日期"
            type="date"
            value={settings.externalAuditDate ?? ''}
            onChange={(v) => updateSettings({ externalAuditDate: v })}
          />
          {COMPANY_IDS.map((companyId) => (
            <Input
              key={companyId}
              label={`管理審查日期（${COMPANY_LABELS[companyId]}）`}
              type="date"
              value={getCompanyManagementReviewDate(settings, companyId)}
              onChange={(value) => updateSettings({
                managementReviewDates: { ...settings.managementReviewDates, [companyId]: value },
              })}
            />
          ))}
          </div>
        </details>

        <PrintDocHeader
          companyName="九潤精密／正隆興精密"
          auditYear={settings.auditYear}
          formTitle="年度內部稽核計畫 QR-28-01"
          subtitle={`主任稽核員：${settings.leadAuditor}`}
        />

        <p className="print-only mb-2 text-center text-xs">共用時程／人員；結果分列。</p>

        {selectedResultRow && (
          <div id="plan-result-panel" ref={resultPanelRef} className="no-print mb-5 rounded-lg border border-line bg-page p-4" role="region" aria-label={`${selectedResultRow.qpCode} 公司別結果`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-ink">{selectedResultRow.qpCode} · {selectedResultRow.department} · 公司別結果</h3>
              <Button variant="secondary" onClick={() => setExpandedRowId(null)}>關閉</Button>
            </div>
            <div className="my-3 flex flex-wrap gap-2 text-xs">
              {MONTH_STATUS_LEGEND.map((legend) => <span key={legend.label} className={`rounded px-2 py-1 ${legend.color}`}>{legend.label}</span>)}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {COMPANY_IDS.filter((id) => selectedResultRow.applicableCompanies.includes(id)).map((companyId) => {
                const statuses = state.companies[companyId].planRows.find((plan) => plan.id === selectedResultRow.id)?.months ?? []
                const months = MONTHS.map((_, index) => index).filter((index) => Boolean(selectedResultRow.months[index] || statuses[index]))
                return <section key={companyId} className="rounded-lg border border-line bg-surface p-3">
                  <h4 className="font-medium text-ink">{COMPANY_LABELS[companyId]}</h4>
                  {months.length === 0 ? <p className="mt-2 text-sm text-muted">尚未排程或記錄結果。</p> : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {months.map((index) => (
                        <label key={index} className="text-sm text-ink">
                          {index + 1} 月結果
                          <select
                            className={`mt-1 min-h-11 w-full rounded border border-line bg-surface px-2 ${FOCUS_RING}`}
                            value={statuses[index] ?? ''}
                            aria-label={`${selectedResultRow.qpCode} ${COMPANY_LABELS[companyId]} ${index + 1} 月結果`}
                            onChange={(event) => setCompanyPlanMonthStatus(companyId, selectedResultRow.id, index, (event.target.value || null) as MonthStatus)}
                          >
                            <option value="">未記錄</option>
                            {MONTH_STATUS_LEGEND.filter((legend) => legend.status).map((legend) => <option key={legend.label} value={legend.status!}>{legend.label}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </section>
              })}
            </div>
          </div>
        )}

        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="年度計畫表格，可橫向捲動">
          <p className="table-scroll-hint mb-2 text-xs text-muted no-print">可橫向捲動</p>
          <table className="qr-plan-table stacked-table w-full min-w-[1450px] border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border border-line p-2">項次</th>
                <th className="border border-line p-2">風險</th>
                <th className="border border-line p-2">QP</th>
                <th className="border border-line p-2">適用公司</th>
                <th className="border border-line p-2">被稽核部門</th>
                <th className="border border-line p-2">程序／受稽文件</th>
                <th className="border border-line p-2">受稽負責人</th>
                <th className="border border-line p-2">類型</th>
                <th className="border border-line p-2">稽核員</th>
                <th className="border border-line p-2 no-print">結果</th>
                {MONTHS.map((m) => (
                  <th key={m} className="plan-month-cell border border-line p-1 text-center w-11">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sharedPlanRows.length === 0 && (
                <tr><td colSpan={22} className="border border-line p-4 text-center text-muted">尚無計畫列；請先建立部門與程序。</td></tr>
              )}
              {sharedPlanRows.map((row: SharedPlanRow) => (
                <tr key={row.id} className={row.manualOverride ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                  <td data-label="項次" className="border border-line p-2">{row.sequence}</td>
                  <td data-label="風險" className="border border-line p-2"><Badge label={row.riskLevel} /></td>
                  <td data-label="QP" className="border border-line p-2 font-medium">{row.qpCode}</td>
                  <td data-label="適用公司" className="border border-line p-2">
                    <div className="space-y-1 no-print">
                      {COMPANY_IDS.map((companyId) => {
                        const checked = row.applicableCompanies.includes(companyId)
                        const disabled = checked && (row.applicableCompanies.length === 1 || !canRemoveCompanyFromPlanRow(state, row.id, companyId))
                        return (
                          <label key={companyId} className="flex min-h-11 items-center gap-1 text-xs" title={disabled ? '已有記錄，無法取消' : undefined}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(event) => updatePlanScope(row.id,
                                COMPANY_IDS.filter((id) => id === companyId ? event.target.checked : row.applicableCompanies.includes(id)),
                              )}
                              aria-label={`${row.qpCode} ${row.department} 適用${COMPANY_LABELS[companyId]}`}
                              className={FOCUS_RING}
                            />
                            {COMPANY_LABELS[companyId]}
                          </label>
                        )
                      })}
                    </div>
                    <span className="print-only">{row.applicableCompanies.map((id) => COMPANY_LABELS[id]).join('、')}</span>
                  </td>
                  <td data-label="被稽核部門" className="border border-line p-2">{row.department}</td>
                  <td data-label="程序／受稽文件" className="border border-line p-2">
                    <div>{row.process}</div>
                    <textarea
                      rows={2}
                      className={`mt-1 min-h-11 w-full min-w-40 rounded border border-line bg-surface px-2 py-1 text-sm no-print ${FOCUS_RING}`}
                      value={row.documents}
                      aria-label={`${row.qpCode} ${row.department} 受稽文件`}
                      onChange={(event) => updatePlanRow(row.id, { documents: event.target.value })}
                    />
                    <span className="print-only">{row.documents}</span>
                  </td>
                  <td data-label="受稽負責人" className="border border-line p-2">
                    <input
                      className={`min-h-11 w-full rounded border border-line bg-surface px-2 text-sm no-print ${FOCUS_RING}`}
                      value={row.owner}
                      aria-label={`${row.qpCode} ${row.department} 受稽負責人`}
                      onChange={(event) => updatePlanRow(row.id, { owner: event.target.value })}
                    />
                    <span className="print-only">{row.owner}</span>
                  </td>
                  <td data-label="類型" className="border border-line p-2 text-xs">{row.auditCategory}</td>
                  <td data-label="稽核員" className="border border-line p-2">
                    <input
                      className={`min-h-11 w-full rounded border border-line bg-surface px-2 text-sm no-print ${FOCUS_RING}`}
                      value={row.auditors}
                      aria-label={`${row.qpCode} ${row.department} 稽核員`}
                      onChange={(e) => updatePlanRow(row.id, { auditors: e.target.value })}
                    />
                    <span className="print-only">{row.auditors}</span>
                  </td>
                  <td data-label="結果" className="border border-line p-2 no-print">
                    <button type="button" className={`no-print min-h-11 whitespace-nowrap text-link hover:underline ${FOCUS_RING}`} aria-expanded={expandedRowId === row.id} aria-controls="plan-result-panel" onClick={() => showResultRow(row.id)}>
                      {expandedRowId === row.id ? '收合' : '查看'}
                    </button>
                  </td>
                  {MONTHS.map((month, i) => {
                    const planned = Boolean(row.months[i])
                    return (
                    <td key={i} data-label={`${month} 月排程`} className="plan-month-cell border border-line p-0.5 text-center">
                      <button
                        type="button"
                        aria-pressed={planned}
                        aria-label={`${row.qpCode} ${row.department} ${i + 1} 月共同排程：${planned ? '已排' : '未排'}`}
                        className={`no-print h-11 w-11 rounded text-xs font-medium ${FOCUS_RING} ${planned ? statusClass('擬定') : 'text-muted'}`}
                        onClick={() => setSharedPlanMonth(row.id, i, !planned)}
                      >
                        {planned ? '排' : '—'}
                      </button>
                      <span className="print-only">{planned ? '擬定' : ''}</span>
                    </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="print-only mt-4">
          {[0, 6].map((start) => (
            <section key={start} className="mb-5">
              <h3 className="mb-2 font-bold">共用月份排程（{start + 1}–{start + 6} 月）</h3>
              <table className="qr-plan-print-schedule w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left">程序／部門</th>
                    <th className="text-left">適用公司</th>
                    {MONTHS.slice(start, start + 6).map((month) => <th key={month}>{month} 月</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sharedPlanRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.qpCode} · {row.department}</td>
                      <td>{row.applicableCompanies.map((id) => id === 'jiurun' ? '九潤' : '正隆興').join('、')}</td>
                      {MONTHS.slice(start, start + 6).map((month, offset) => (
                        <td key={month} className="text-center">{row.months[start + offset] ? '擬定' : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
        <div className="print-only mt-4">
          <h3 className="mb-2 font-bold">公司別結果</h3>
          <table className="w-full border-collapse text-xs">
            <thead><tr><th className="border border-line p-2 text-left">程序／部門</th><th className="border border-line p-2 text-left">公司</th><th className="border border-line p-2 text-left">月格結果</th></tr></thead>
            <tbody>
              {sharedPlanRows.flatMap((row) => COMPANY_IDS.filter((id) => row.applicableCompanies.includes(id)).map((id) => (
                <tr key={`${row.id}-${id}`}>
                  <td className="border border-line p-2">{row.qpCode} · {row.department}</td>
                  <td className="border border-line p-2">{COMPANY_LABELS[id]}</td>
                  <td className="border border-line p-2">{resultSummary(state.companies[id].planRows.find((plan) => plan.id === row.id)?.months ?? [])}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
