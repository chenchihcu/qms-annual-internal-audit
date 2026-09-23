import { useEffect, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { isSeedChecklistItem } from '../lib/checklistItem'
import { formatScoreDisplay, scoreProcedureAudit } from '../lib/scoring'
import type { ChecklistItem, Judgment, ProcedureAudit } from '../types'
import { COMPANY_LABELS } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PrintDocHeader } from './ui/PrintDocHeader'

const JUDGMENTS: Judgment[] = ['符合', '不符', '觀察', '不適用']

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

interface ProcedureAuditPanelProps {
  store: AuditStore
  selectedKey?: string
  onSelectedKeyChange?: (key: string) => void
}

function CounterpartEvidence({
  audit,
  item,
  companyName,
  onApply,
}: {
  audit?: ProcedureAudit
  item: ChecklistItem
  companyName: string
  onApply: (reference: string) => void
}) {
  if (!audit) return <p className="mt-1 text-xs text-muted no-print">尚未建立{companyName}查檢表；請在該公司表單確認佐證。</p>
  const matches = audit.items.filter((candidate) => candidate.category === item.category && candidate.no === item.no)
  if (matches.length !== 1 || matches[0].content !== item.content) {
    return <p className="mt-1 text-xs text-amber-800 dark:text-amber-200 no-print">兩家公司題目快照不同或無法對應；請切換公司核對佐證。</p>
  }
  const reference = matches[0].evidenceReference?.trim()
  return <div className="mt-1 text-xs text-muted no-print">
    <p className="break-all">{companyName}同題目：{reference ? `已填 ${reference}` : '尚未填佐證'}。</p>
    {reference && !item.evidenceReference?.trim() && (
      <button
        type="button"
        className={`min-h-11 px-2 text-link hover:underline ${FOCUS_RING}`}
        onClick={() => onApply(reference)}
      >
        套用此引用（僅本公司）
      </button>
    )}
    {reference && item.evidenceReference?.trim() && (
      <p>{reference === item.evidenceReference.trim() ? '引用相同；判定分開記錄。' : '引用不同；各自保留。'}</p>
    )}
  </div>
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
    getProcedureTitle,
  } = store

  const { company, settings } = state
  const auditOptions = useMemo(
    () =>
      company.planRows.filter((row) => state.sharedPlanRows || company.audits.some((audit) =>
        audit.qpCode === row.qpCode && audit.departmentId === row.departmentId,
      )).map((row) => ({
        value: `${row.qpCode}|${row.departmentId}`,
        label: `${row.qpCode} ${getProcedureTitle(row.qpCode, row.department)} · ${row.department}`,
      })),
    [company.planRows, company.audits, state.sharedPlanRows, getProcedureTitle],
  )

  const [internalKey, setInternalKey] = useState(auditOptions[0]?.value ?? '')
  const requestedKey = selectedKeyProp ?? internalKey
  const selectedKey = auditOptions.some((option) => option.value === requestedKey)
    ? requestedKey
    : auditOptions[0]?.value ?? ''
  const setSelectedKey = (key: string) => {
    setInternalKey(key)
    onSelectedKeyChange?.(key)
  }

  useEffect(() => {
    if (selectedKeyProp && selectedKeyProp !== selectedKey && selectedKey) {
      onSelectedKeyChange?.(selectedKey)
    }
  }, [selectedKeyProp, selectedKey, onSelectedKeyChange])

  const otherCompanyId = state.activeCompanyId === 'jiurun' ? 'zhenglongxing' : 'jiurun'
  const [deleteTarget, setDeleteTarget] = useState<{ itemId: string; isNonConform: boolean } | null>(
    null,
  )

  const [qpCode, departmentId] = selectedKey.split('|')
  const persistedAudit =
    qpCode && departmentId
      ? company.audits.find((a) => a.qpCode === qpCode && a.departmentId === departmentId)
      : undefined

  useEffect(() => {
    if (!qpCode || !departmentId || persistedAudit) return
    updateAudit(getOrCreateAudit(qpCode, departmentId))
  }, [qpCode, departmentId, persistedAudit, getOrCreateAudit, updateAudit])

  if (!qpCode || !departmentId) {
    return <p role="status" className="text-muted">{state.sharedPlanRows ? '請先於年度計畫建立程序稽核項目。' : '兩家公司舊計畫有差異；請先到年度計畫確認共用安排，再建立新查檢表。既有查檢表仍可查閱。'}</p>
  }

  const audit = persistedAudit ?? getOrCreateAudit(qpCode, departmentId)
  const otherCompanyAudit = state.companies[otherCompanyId].audits.find((other) =>
    other.qpCode === qpCode && other.departmentId === departmentId,
  )
  const sharedPlanRow = state.sharedPlanRows?.find((row) =>
    row.qpCode === qpCode && row.departmentId === departmentId,
  )
  const sameActivityAudit = sharedPlanRow?.applicableCompanies.includes(otherCompanyId)
    ? otherCompanyAudit
    : undefined
  const canApplyOtherDates = Boolean(sameActivityAudit && (
    (!audit.notifyDate && sameActivityAudit.notifyDate)
    || (!audit.auditDate && sameActivityAudit.auditDate)
  ))
  const datesDiffer = Boolean(sameActivityAudit && (
    (audit.notifyDate && sameActivityAudit.notifyDate && audit.notifyDate !== sameActivityAudit.notifyDate)
    || (audit.auditDate && sameActivityAudit.auditDate && audit.auditDate !== sameActivityAudit.auditDate)
  ))

  const score = scoreProcedureAudit(audit, settings.scoringRules)
  const categories = [...new Set(audit.items.map((i) => i.category))]

  const handleHeaderChange = (field: string, value: string) => {
    updateAudit({ ...audit, [field]: value })
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
            ? '「不符」項目的 NCR 會保留。仍要刪除？'
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
          <Select
            label="程序／部門"
            value={selectedKey}
            onChange={setSelectedKey}
            options={auditOptions}
          />
        </div>

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="內部稽核查檢表 QR-28-02"
          subtitle={`${audit.qpCode} ${getProcedureTitle(audit.qpCode, audit.department)} · ${audit.auditCategory}`}
        />

        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="查檢表資料，可橫向捲動">
          <p className="horizontal-scroll-hint mb-2 text-xs text-muted no-print">可橫向捲動</p>
          <table className="qr-header-table mb-6 w-full min-w-[640px] border-collapse text-sm">
            <tbody>
              <tr>
                <td className="qr-label border border-line p-2">被稽核部門</td>
                <td className="border border-line p-2">{audit.department}</td>
                <td className="qr-label border border-line p-2">稽核流程</td>
                <td className="border border-line p-2">{audit.qpCode} {audit.process}</td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">受稽文件</td>
                <td className="border border-line p-2">
                  <div className="break-words">{audit.documents || '建立時未填'}</div>
                  {sharedPlanRow && audit.documents !== sharedPlanRow.documents && (
                    <p role="status" className="mt-1 text-xs text-amber-800 dark:text-amber-200 no-print">
                      本表保留建立時的文件；目前共用計畫為「{sharedPlanRow.documents || '尚未填寫'}」。請核對本次稽核適用的版本。
                    </p>
                  )}
                </td>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-notify-date">通知日期</label>
                </td>
                <td className="border border-line p-2">
                  <Input
                    id="audit-notify-date"
                    type="date"
                    value={audit.notifyDate}
                    onChange={(v) => handleHeaderChange('notifyDate', v)}
                    className="no-print"
                  />
                  <span className="print-only">{audit.notifyDate}</span>
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
                <td className="qr-label border border-line p-2">受稽主管（快照）</td>
                <td className="border border-line p-2">
                  <span>{audit.departmentManager || '建立時未填'}</span>
                  {sharedPlanRow && audit.departmentManager !== sharedPlanRow.owner && (
                    <p role="status" className="mt-1 text-xs text-amber-800 dark:text-amber-200 no-print">
                      目前共用計畫指派：{sharedPlanRow.owner || '尚未填寫'}；本表保留建立時人員。
                    </p>
                  )}
                </td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">稽核員（快照）</td>
                <td className="border border-line p-2" colSpan={3}>
                  <span>{audit.auditors || '建立時未填'}</span>
                  {sharedPlanRow && audit.auditors !== sharedPlanRow.auditors && (
                    <p role="status" className="mt-1 text-xs text-amber-800 dark:text-amber-200 no-print">
                      目前共用計畫指派：{sharedPlanRow.auditors || '尚未填寫'}；本表保留建立時人員。
                    </p>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {sameActivityAudit && (canApplyOtherDates || datesDiffer) && (
          <div className="mb-4 rounded-lg border border-line bg-page p-3 text-sm no-print" role="status">
            <p className="font-medium text-ink">同場稽核日期核對 · {COMPANY_LABELS[otherCompanyId]}</p>
            {datesDiffer && (
            <p className="mt-1 text-amber-800 dark:text-amber-200">兩家公司日期不同，請核對後修正；不會自動覆寫。</p>
            )}
            {canApplyOtherDates && (
              <button
                type="button"
                className={`mt-2 min-h-11 px-2 text-link hover:underline ${FOCUS_RING}`}
                onClick={() => updateAudit({
                  ...audit,
                  notifyDate: audit.notifyDate || sameActivityAudit.notifyDate,
                  auditDate: audit.auditDate || sameActivityAudit.auditDate,
                })}
              >
                套用另一家公司日期
              </button>
            )}
          </div>
        )}

        <details className="mb-4 rounded-lg border border-line p-3 no-print">
          <summary className="cursor-pointer text-sm font-medium text-ink">更正本表人員</summary>
          <p className="mt-2 text-xs text-muted">兩家公司共用的人員指派請在「年度計畫」修改；此處只用於更正{company.name}當次表單的實際記錄，不會改另一家公司或共用計畫。</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              id="audit-manager"
              label="受稽主管"
              value={audit.departmentManager}
              onChange={(value) => handleHeaderChange('departmentManager', value)}
            />
            <Input
              id="audit-auditors"
              label="稽核員"
              value={audit.auditors}
              onChange={(value) => handleHeaderChange('auditors', value)}
            />
          </div>
        </details>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            程序得分：<span className="text-lg font-bold text-link">{formatScoreDisplay(score)}</span>
          </p>
          <Button variant="secondary" className="no-print" onClick={() => addChecklistItem(audit.id)}>
            新增項目
          </Button>
        </div>

        <p className="mb-3 text-sm text-muted no-print">
          文件、人員與題目沿用建立時快照；共用題目請至設定修改。判定、說明與佐證分公司保存。
        </p>

        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="程序稽核查檢項目，可橫向捲動">
          <p className="table-scroll-hint mb-2 text-xs text-muted no-print">可橫向捲動</p>
          <table className="qr-checklist stacked-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border border-line p-2 w-24">項目</th>
                <th className="border border-line p-2 w-12">NO</th>
                <th className="border border-line p-2">稽核內容（快照）</th>
                <th className="border border-line p-2 w-28">判定</th>
                <th className="border border-line p-2">說明</th>
                <th className="border border-line p-2 w-24 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {audit.items.length === 0 && (
                <tr><td colSpan={6} className="border border-line p-4 text-center text-muted">尚無查檢項目；可使用「新增項目」建立。</td></tr>
              )}
              {categories.map((cat) => {
                const catItems = audit.items.filter((i) => i.category === cat)
                return catItems.map((item, idx) => (
                  <tr key={item.id} className={item.sourceYear ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    {idx === 0 && (
                      <td className="category-cell border border-line p-2 align-top font-medium" rowSpan={catItems.length}>
                        {cat}
                      </td>
                    )}
                    <td data-label="項次" className="border border-line p-2 align-top text-center">{item.no}</td>
                    <td data-label="稽核內容" className="border border-line p-2 align-top">
                      <span className="mobile-category">{cat}</span>
                      <textarea
                        rows={2}
                        className={`min-h-11 w-full rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        value={item.content}
                        aria-label={`${audit.qpCode} ${audit.department} 第 ${item.no} 項稽核內容`}
                        onChange={(e) => updateChecklistItem(audit.id, item.id, { content: e.target.value })}
                      />
                      <span className="print-only">{item.content}</span>
                      {item.sourceYear && (
                        <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">來源：{item.sourceYear} 年追蹤</span>
                      )}
                    </td>
                    <td data-label="判定" className="border border-line p-2 align-top">
                      <select
                        className={`min-h-11 w-full rounded border border-line bg-surface px-1 py-1 no-print ${FOCUS_RING}`}
                        value={item.judgment ?? ''}
                        aria-label={`${audit.qpCode} ${audit.department} 第 ${item.no} 項判定`}
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
                    </td>
                    <td data-label="說明" className="border border-line p-2 align-top">
                      <textarea
                        className={`min-h-11 w-full resize-y rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        rows={2}
                        value={item.description}
                        aria-label={`${audit.qpCode} ${audit.department} 第 ${item.no} 項說明`}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, { description: e.target.value })
                        }
                      />
                      <span className="print-only">{item.description}</span>
                      <label className="mt-2 block text-xs font-medium text-muted no-print" htmlFor={`evidence-${audit.id}-${item.id}`}>
                        {company.name}佐證（代碼／位置）
                      </label>
                      <input
                        id={`evidence-${audit.id}-${item.id}`}
                        className={`mt-1 min-h-11 w-full rounded border border-line bg-surface px-2 py-1 text-sm no-print ${FOCUS_RING}`}
                        value={item.evidenceReference ?? ''}
                        aria-label={`${company.name} ${audit.qpCode} ${audit.department} 第 ${item.no} 項佐證`}
                        onChange={(e) => updateChecklistItem(audit.id, item.id, { evidenceReference: e.target.value })}
                      />
                      <CounterpartEvidence
                        audit={otherCompanyAudit}
                        item={item}
                        companyName={COMPANY_LABELS[otherCompanyId]}
                        onApply={(reference) => updateChecklistItem(audit.id, item.id, { evidenceReference: reference })}
                      />
                      {item.evidenceReference && <span className="print-only break-all">{company.name}佐證：{item.evidenceReference}</span>}
                    </td>
                    <td data-label="操作" className="border border-line p-2 align-top no-print">
                      {!isSeedChecklistItem(item) ? (
                        <button
                          type="button"
                          className={`min-h-11 px-2 text-xs text-red-600 dark:text-red-400 hover:underline ${FOCUS_RING}`}
                          onClick={() => handleRemove(item.id, item.judgment === '不符')}
                        >
                          刪除
                        </button>
                      ) : <span className="text-xs text-muted">—</span>}
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
