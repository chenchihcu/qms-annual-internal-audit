import { useEffect, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { carryPlanDatesToAudit } from '../lib/auditDates'
import { countPendingItems, isProcedureComplete } from '../lib/auditComplete'
import { countMissingEvidenceItems } from '../lib/checklistEvidence'
import { isSeedChecklistItem } from '../lib/checklistItem'
import { checkAuditImpartiality } from '../lib/impartiality'
import { findNcrForChecklistItem } from '../lib/ncr'
import { formatScoreDisplay, scoreProcedureAudit } from '../lib/scoring'
import type { Judgment } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { FormPrintButton } from './ui/FormPrintButton'
import { ImpartialityBanner } from './ui/ImpartialityBanner'
import { PrintDocHeader } from './ui/PrintDocHeader'

const JUDGMENTS: Judgment[] = ['符合', '不符', '觀察', '不適用']

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

interface ProcedureAuditPanelProps {
  store: AuditStore
  selectedKey?: string
  onSelectedKeyChange?: (key: string) => void
}

export function ProcedureAuditPanel({
  store,
  selectedKey: selectedKeyProp,
  onSelectedKeyChange,
}: ProcedureAuditPanelProps) {
  const {
    state,
    getOrCreateAudit,
    updateAudit,
    updateChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    markChecklistItemNA,
    setRemainingUnjudgedToConform,
    markAuditAsNotified,
    convertChecklistObservationToNcr,
    getProcedureTitle,
  } = store

  const { company, settings } = state
  const auditOptions = useMemo(
    () =>
      company.planRows.map((row) => ({
        value: `${row.qpCode}|${row.departmentId}`,
        label: `${row.qpCode} ${getProcedureTitle(row.qpCode, row.department)} · ${row.department}`,
      })),
    [company.planRows, getProcedureTitle],
  )

  const [internalKey, setInternalKey] = useState(auditOptions[0]?.value ?? '')
  const selectedKey = selectedKeyProp ?? internalKey
  const setSelectedKey = (key: string) => {
    setInternalKey(key)
    onSelectedKeyChange?.(key)
  }

  const [deleteTarget, setDeleteTarget] = useState<{ itemId: string; isNonConform: boolean } | null>(
    null,
  )
  const [expandedDesc, setExpandedDesc] = useState<Set<string>>(new Set())

  const [qpCode, departmentId] = selectedKey.split('|')
  const persistedAudit =
    qpCode && departmentId
      ? company.audits.find((a) => a.qpCode === qpCode && a.departmentId === departmentId)
      : undefined

  const planRow = company.planRows.find(
    (row) => row.qpCode === qpCode && row.departmentId === departmentId,
  )

  useEffect(() => {
    if (!qpCode || !departmentId) return
    if (!persistedAudit) {
      updateAudit(getOrCreateAudit(qpCode, departmentId))
      return
    }
    if (!planRow) return
    const carried = carryPlanDatesToAudit(planRow, persistedAudit, settings.auditYear)
    if (
      carried.notifyDate !== persistedAudit.notifyDate ||
      carried.auditDate !== persistedAudit.auditDate ||
      carried.plannedMonth !== persistedAudit.plannedMonth
    ) {
      updateAudit(carried)
    }
  }, [
    qpCode,
    departmentId,
    persistedAudit,
    planRow,
    settings.auditYear,
    getOrCreateAudit,
    updateAudit,
  ])

  if (!qpCode || !departmentId) {
    return <p className="text-muted">請先於年度計畫建立程序稽核項目</p>
  }

  const audit = persistedAudit ?? getOrCreateAudit(qpCode, departmentId)

  const score = scoreProcedureAudit(audit, settings.scoringRules)
  const complete = isProcedureComplete(audit)
  const pendingCount = countPendingItems(audit.items)
  const missingEvidenceCount = countMissingEvidenceItems(audit.items)
  const categories = [...new Set(audit.items.map((i) => i.category))]
  const impartialityWarning = checkAuditImpartiality(audit, company.departments)

  const handleHeaderChange = (field: string, value: string) => {
    updateAudit({ ...audit, [field]: value })
  }

  const toggleDesc = (id: string) => {
    setExpandedDesc((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRemove = (itemId: string, isNonConform: boolean) => {
    setDeleteTarget({ itemId, isNonConform })
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="刪除稽核項目"
        description={
          deleteTarget?.isNonConform
            ? '此項目判定為「不符」，對應 NCR 仍會保留。確定刪除此查檢項？'
            : '確定刪除此自訂／追蹤查檢項？此操作無法復原。'
        }
        variant="danger"
        confirmLabel="刪除"
        onConfirm={() => {
          if (deleteTarget) removeChecklistItem(audit.id, deleteTarget.itemId)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 no-print">
          <h2 className="text-lg font-semibold text-ink">內部稽核查檢表（QR-28-02）</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="查檢表"
              value={selectedKey}
              onChange={setSelectedKey}
              options={auditOptions}
            />
            <FormPrintButton />
          </div>
        </div>

        <ImpartialityBanner warning={impartialityWarning} />

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="內部稽核查檢表 QR-28-02"
          subtitle={`${audit.qpCode} ${getProcedureTitle(audit.qpCode, audit.department)} · ${audit.auditCategory}${
            company.keyCustomerName?.trim() ? ` · 主要客戶：${company.keyCustomerName}` : ''
          }`}
        />

        <div className="overflow-x-auto">
          <table className="qr-header-table mb-6 w-full min-w-[640px] border-collapse text-sm">
            <tbody>
              <tr>
                <td className="qr-label border border-line p-2">被稽核部門</td>
                <td className="border border-line p-2">{audit.department}</td>
                <td className="qr-label border border-line p-2">稽核流程 (QP)</td>
                <td className="border border-line p-2">{audit.qpCode} {audit.process}</td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">對應文件</td>
                <td className="border border-line p-2">{audit.documents}</td>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-notify-date">通知日期</label>
                </td>
                <td className="border border-line p-2">
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    <Input
                      id="audit-notify-date"
                      type="date"
                      value={audit.notifyDate}
                      onChange={(v) => handleHeaderChange('notifyDate', v)}
                    />
                    {!audit.notifySent ? (
                      <Button variant="secondary" onClick={() => markAuditAsNotified(audit.id)}>
                        標記已通知
                      </Button>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
                        已通知
                      </span>
                    )}
                  </div>
                  <span className="print-only">
                    {audit.notifyDate}
                    {audit.notifySent ? '（已通知）' : ''}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-date">實施日期</label>
                </td>
                <td className="border border-line p-2">
                  <Input
                    id="audit-date"
                    type="date"
                    value={audit.auditDate}
                    onChange={(v) => handleHeaderChange('auditDate', v)}
                    className="no-print"
                  />
                  <span className="print-only">{audit.auditDate}</span>
                </td>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-manager">被稽核部門主管</label>
                </td>
                <td className="border border-line p-2">
                  <Input
                    id="audit-manager"
                    value={audit.departmentManager}
                    onChange={(v) => handleHeaderChange('departmentManager', v)}
                    className="no-print"
                  />
                  <span className="print-only">{audit.departmentManager}</span>
                </td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-auditors">稽核人員</label>
                </td>
                <td className="border border-line p-2" colSpan={3}>
                  <Input
                    id="audit-auditors"
                    value={audit.auditors}
                    onChange={(v) => handleHeaderChange('auditors', v)}
                    className="no-print"
                  />
                  <span className="print-only">{audit.auditors}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p className="text-muted">
              程序得分：<span className="text-lg font-bold text-primary">{formatScoreDisplay(score)}</span>
            </p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                complete
                  ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
              }`}
            >
              {complete
                ? '查檢已完成'
                : pendingCount > 0
                  ? `查檢未完成（尚餘 ${pendingCount} 項未判定）`
                  : `查檢未完成（尚餘 ${missingEvidenceCount} 項缺客觀證據）`}
            </span>
            {audit.plannedMonth && (
              <span className="text-xs text-muted">計畫月份：{audit.plannedMonth} 月</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            {pendingCount > 0 && (
              <Button
                variant="secondary"
                onClick={() => setRemainingUnjudgedToConform(audit.id)}
              >
                其餘未判定改符合
              </Button>
            )}
            <Button variant="secondary" onClick={() => addChecklistItem(audit.id)}>
              新增稽核項目
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <p className="mb-2 text-xs text-muted no-print">表格可左右滑動</p>
          <table className="qr-checklist w-full border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border border-line p-2 w-24">項目</th>
                <th className="border border-line p-2 w-12">NO</th>
                <th className="border border-line p-2">稽核內容</th>
                <th className="border border-line p-2 w-28">判定</th>
                <th className="border border-line p-2 w-24">抽樣</th>
                <th className="border border-line p-2 w-32">客觀證據</th>
                <th className="border border-line p-2 w-24">AS9100</th>
                <th className="border border-line p-2">內容說明</th>
                <th className="border border-line p-2 w-24 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const catItems = audit.items.filter((i) => i.category === cat)
                return catItems.map((item, idx) => (
                  <tr key={item.id} className={item.sourceYear ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    {idx === 0 && (
                      <td className="border border-line p-2 align-top font-medium" rowSpan={catItems.length}>
                        {cat}
                      </td>
                    )}
                    <td className="border border-line p-2 align-top text-center">{item.no}</td>
                    <td className="audit-content-cell border border-line p-2 align-top">
                      <textarea
                        className={`w-full min-h-[4.5rem] resize-y rounded border border-line bg-surface px-2 py-1 text-sm leading-relaxed no-print ${FOCUS_RING}`}
                        rows={Math.min(6, Math.max(2, Math.ceil(item.content.length / 40)))}
                        value={item.content}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, { content: e.target.value })
                        }
                      />
                      <span className="print-only whitespace-pre-wrap">{item.content}</span>
                      {item.sourceYear && (
                        <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">來源：{item.sourceYear} 年追蹤</span>
                      )}
                    </td>
                    <td className="border border-line p-2 align-top">
                      <select
                        className={`w-full rounded border border-line bg-surface px-1 py-1 no-print ${FOCUS_RING}`}
                        value={item.judgment ?? ''}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, {
                            judgment: (e.target.value || null) as Judgment | null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {JUDGMENTS.map((j) => (
                          <option key={j} value={j}>{j}</option>
                        ))}
                      </select>
                      <span className="print-only">{item.judgment && <Badge label={item.judgment} />}</span>
                      {item.judgment === '觀察' && (
                        <div className="mt-1 no-print">
                          {findNcrForChecklistItem(company.ncrs, item.id) ? (
                            <span className="text-xs text-primary">已轉 NCR</span>
                          ) : (
                            <button
                              type="button"
                              className={`text-xs text-primary hover:underline ${FOCUS_RING}`}
                              onClick={() => convertChecklistObservationToNcr(audit.id, item.id)}
                            >
                              轉成 NCR
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="border border-line p-2 align-top">
                      <input
                        className={`w-full rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        placeholder="例：3 件"
                        value={item.sampleSize ?? ''}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, { sampleSize: e.target.value })
                        }
                      />
                      <span className="print-only">{item.sampleSize}</span>
                    </td>
                    <td className="border border-line p-2 align-top">
                      <input
                        className={`w-full rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        placeholder="例：QR-05-01"
                        value={item.objectiveEvidence ?? ''}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, {
                            objectiveEvidence: e.target.value,
                          })
                        }
                      />
                      <span className="print-only">{item.objectiveEvidence}</span>
                    </td>
                    <td className="border border-line p-2 align-top">
                      <input
                        className={`w-full rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        placeholder="例：7.1.5"
                        value={item.as9100Clause ?? ''}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, { as9100Clause: e.target.value })
                        }
                      />
                      <span className="print-only">{item.as9100Clause}</span>
                    </td>
                    <td className="border border-line p-2 align-top">
                      {expandedDesc.has(item.id) ? (
                        <textarea
                          className={`w-full rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                          rows={2}
                          value={item.description}
                          onChange={(e) =>
                            updateChecklistItem(audit.id, item.id, { description: e.target.value })
                          }
                        />
                      ) : (
                        <input
                          className={`w-full rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                          placeholder="說明（點展開多行）"
                          value={item.description}
                          onChange={(e) =>
                            updateChecklistItem(audit.id, item.id, { description: e.target.value })
                          }
                        />
                      )}
                      <button
                        type="button"
                        className={`mt-1 text-xs text-primary no-print hover:underline ${FOCUS_RING}`}
                        onClick={() => toggleDesc(item.id)}
                      >
                        {expandedDesc.has(item.id) ? '收合' : '展開'}
                      </button>
                      <span className="print-only">{item.description}</span>
                    </td>
                    <td className="border border-line p-2 align-top no-print">
                      {isSeedChecklistItem(item) ? (
                        <button
                          type="button"
                          className={`text-xs text-muted hover:underline ${FOCUS_RING}`}
                          onClick={() => markChecklistItemNA(audit.id, item.id)}
                        >
                          標不適用
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`text-xs text-red-600 hover:underline ${FOCUS_RING}`}
                          onClick={() => handleRemove(item.id, item.judgment === '不符')}
                        >
                          刪除
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
