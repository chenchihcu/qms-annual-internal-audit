import { useEffect, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { useDepartmentOwnerConfirm } from '../hooks/useDepartmentOwnerConfirm'
import { DepartmentOwnerField } from './DepartmentOwnerField'
import { DepartmentOwnerConfirm } from './DepartmentOwnerConfirm'
import { isSeedChecklistItem } from '../lib/checklistItem'
import { FOCUS_RING } from '../lib/focusRing'
import { findNcrsForChecklistItem, isNcrStale } from '../lib/ncr'
import type { NavigateOptions } from '../lib/navigation'
import { isAuditComplete, isChecklistItemPending } from '../lib/scoring'
import { formatScoreDisplay, scoreProcedureAudit } from '../lib/scoring'
import type { ChecklistItem, CompanyId, Judgment, TabId } from '../types'
import { COMPANY_LABELS } from '../types'
import { Badge, Button, Input, Select } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'

const JUDGMENTS: Judgment[] = ['符合', '不符', '觀察', '不適用']

interface ProcedureAuditPanelProps {
  store: AuditStore
  selectedKey?: string
  onSelectedKeyChange?: (key: string) => void
  onNavigate?: (tab: TabId, options?: NavigateOptions) => void
}

export function ProcedureAuditPanel({
  store,
  selectedKey: selectedKeyProp,
  onSelectedKeyChange,
  onNavigate,
}: ProcedureAuditPanelProps) {
  const {
    state,
    getOrCreateAudit,
    updateAudit,
    updateChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    markChecklistItemNA,
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
  const ownerConfirm = useDepartmentOwnerConfirm(store)

  const [qpCode, departmentId] = selectedKey.split('|')
  const persistedAudit =
    qpCode && departmentId
      ? company.audits.find((a) => a.qpCode === qpCode && a.departmentId === departmentId)
      : undefined

  useEffect(() => {
    if (!qpCode || !departmentId) return
    const audit = getOrCreateAudit(qpCode, departmentId)
    if (audit !== persistedAudit) updateAudit(audit)
  }, [qpCode, departmentId, persistedAudit, getOrCreateAudit, updateAudit])

  if (!qpCode || !departmentId) {
    return <p className="text-muted">請先於年度稽核計畫建立查檢項目</p>
  }

  const audit = persistedAudit ?? getOrCreateAudit(qpCode, departmentId)
  const dept = company.departments.find((d) => d.id === departmentId)

  const score = scoreProcedureAudit(audit, settings.scoringRules)
  const categories = [...new Set(audit.items.map((i) => i.category))]
  const auditFrozen = isAuditComplete(audit, settings.scoringRules)
  const managerMismatch =
    auditFrozen && dept != null && audit.departmentManager !== dept.owner

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

  const isItemNonConform = (item: (typeof audit.items)[0]) => {
    if (item.certificateScope === 'dual' && item.judgmentByCompany) {
      return (
        item.judgmentByCompany.jiurun === '不符' ||
        item.judgmentByCompany.zhenglongxing === '不符'
      )
    }
    return item.judgment === '不符'
  }

  const handleRemove = (itemId: string, isNonConform: boolean) => {
    setDeleteTarget({ itemId, isNonConform })
  }

  const renderNcrHint = (item: ChecklistItem) => {
    const linked = findNcrsForChecklistItem(company.ncrs, item.id)
    if (linked.length === 0 || !onNavigate) return null
    const stale = linked.some((n) => isNcrStale(n, company.audits))
    const numbers = linked.map((n) => n.ncrNumber).join('、')
    return (
      <div className="mt-1 text-xs no-print">
        <button
          type="button"
          className={`hover:underline ${FOCUS_RING} ${stale ? 'text-amber-700 dark:text-amber-300' : 'text-primary'}`}
          onClick={() => onNavigate('ncr')}
        >
          {stale
            ? `建議結案 NCR（${numbers}，查檢已非不符）`
            : `已建立 NCR ${numbers}，前往不符合`}
        </button>
      </div>
    )
  }

  const renderJudgmentSelect = (
    value: Judgment | null | undefined,
    onChange: (j: Judgment | null) => void,
    label?: string,
  ) => (
    <div className="space-y-0.5">
      {label && <span className="text-xs text-muted no-print">{label}</span>}
      <select
        className={`w-full min-w-[5.5rem] rounded border border-line bg-surface px-1 py-1 no-print ${FOCUS_RING}`}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as Judgment | null)}
        aria-label={label ?? '判定'}
      >
        <option value="">未判定</option>
        {JUDGMENTS.map((j) => (
          <option key={j} value={j}>{j}</option>
        ))}
      </select>
      <span className="print-only">{value ? <Badge label={value} /> : '未判定'}</span>
    </div>
  )

  return (
    <div className="space-y-6 print-area qr-form">
      <DepartmentOwnerConfirm ownerConfirm={ownerConfirm} />
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

      <div>
        <PageToolbar
          title="查檢表"
          actions={(
            <Select
              label="查檢表"
              value={selectedKey}
              onChange={setSelectedKey}
              options={auditOptions}
            />
          )}
        />

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="內部稽核查檢表 QR-28-02"
          subtitle={`${audit.qpCode} ${getProcedureTitle(audit.qpCode, audit.department)} · ${audit.auditCategory}`}
        />

        <ScrollRegion ariaLabel="查檢表表頭資訊">
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
                  <Input
                    type="date"
                    value={audit.notifyDate}
                    onChange={(v) => handleHeaderChange('notifyDate', v)}
                    className="no-print"
                    ariaLabel="通知日期"
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
                    type="date"
                    value={audit.auditDate}
                    onChange={(v) => handleHeaderChange('auditDate', v)}
                    className="no-print"
                    ariaLabel="實施日期"
                  />
                  <span className="print-only">{audit.auditDate}</span>
                </td>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-manager">被稽核部門主管</label>
                </td>
                <td className="border border-line p-2">
                  {auditFrozen ? (
                    <>
                      <span className="no-print text-ink">{audit.departmentManager}</span>
                      {managerMismatch && (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200 no-print">
                          已評分，本表凍結為「{audit.departmentManager}」；部門負責人已改為「{dept?.owner}」
                        </p>
                      )}
                    </>
                  ) : dept ? (
                    <DepartmentOwnerField
                      departmentId={departmentId}
                      savedOwner={dept.owner}
                      displayOwner={audit.departmentManager}
                      ariaLabel="被稽核部門主管"
                      onSaveRequest={ownerConfirm.requestChange}
                    />
                  ) : (
                    <Input
                      value={audit.departmentManager}
                      onChange={(v) => handleHeaderChange('departmentManager', v)}
                      className="no-print"
                      ariaLabel="被稽核部門主管"
                    />
                  )}
                  <span className="print-only">{audit.departmentManager}</span>
                </td>
              </tr>
              <tr>
                <td className="qr-label border border-line p-2">
                  <label htmlFor="audit-auditors">稽核人員</label>
                </td>
                <td className="border border-line p-2" colSpan={3}>
                  <Input
                    value={audit.auditors}
                    onChange={(v) => handleHeaderChange('auditors', v)}
                    className="no-print"
                    ariaLabel="稽核人員"
                  />
                  <span className="print-only">{audit.auditors}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </ScrollRegion>

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <ScrollRegion ariaLabel="查檢判定計數統計表" className="min-w-0 flex-1">
            <table className="stacked-table w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-page text-left text-muted">
                  <th className="p-2">程序得分</th>
                  <th className="p-2">共幾項</th>
                  <th className="p-2">符合</th>
                  <th className="p-2">不符</th>
                  <th className="p-2">觀察</th>
                  <th className="p-2">不適用</th>
                  <th className="p-2">未判定</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="程序得分" className="border border-line p-2 font-semibold text-primary">
                    {formatScoreDisplay(score)}
                  </td>
                  <td data-label="共幾項" className="border border-line p-2">{score.totalItems}</td>
                  <td data-label="符合" className="border border-line p-2">{score.breakdown.conform}</td>
                  <td data-label="不符" className="border border-line p-2">{score.breakdown.nonConform}</td>
                  <td data-label="觀察" className="border border-line p-2">{score.breakdown.observation}</td>
                  <td data-label="不適用" className="border border-line p-2">{score.breakdown.notApplicable}</td>
                  <td data-label="未判定" className="border border-line p-2">{score.breakdown.pending}</td>
                </tr>
              </tbody>
            </table>
          </ScrollRegion>
          <Button variant="secondary" className="no-print shrink-0" onClick={() => addChecklistItem(audit.id)}>
            新增稽核項目
          </Button>
        </div>

        <ScrollRegion ariaLabel="查檢表項目清單">
          <table className="qr-checklist w-full border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border border-line p-2 w-24">項目</th>
                <th className="border border-line p-2 w-12">NO</th>
                <th className="border border-line p-2">稽核內容</th>
                <th className="border border-line p-2 min-w-[9rem]">判定</th>
                <th className="border border-line p-2">內容說明</th>
                <th className="border border-line p-2 w-24 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const catItems = audit.items.filter((i) => i.category === cat)
                return catItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={
                      isChecklistItemPending(item)
                        ? 'bg-rose-50/40 dark:bg-rose-950/20'
                        : item.sourceYear
                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                          : ''
                    }
                  >
                    {idx === 0 && (
                      <td className="border border-line p-2 align-top font-medium" rowSpan={catItems.length}>
                        {cat}
                      </td>
                    )}
                    <td className="border border-line p-2 align-top text-center">{item.no}</td>
                    <td className="border border-line p-2 align-top">
                      {isChecklistItemPending(item) && (
                        <span className="mb-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-900 no-print">
                          未判定
                        </span>
                      )}
                      <input
                        className={`w-full rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        value={item.content}
                        onChange={(e) =>
                          updateChecklistItem(audit.id, item.id, { content: e.target.value })
                        }
                        aria-label={`${audit.qpCode} NO ${item.no} 稽核內容`}
                      />
                      <span className="print-only">{item.content}</span>
                      {item.as9100Clause && (
                        <span className="mt-1 block text-xs text-slate-500 no-print">
                          AS9100 {item.as9100Clause}
                        </span>
                      )}
                      {item.sourceYear && (
                        <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">來源：{item.sourceYear} 年追蹤</span>
                      )}
                    </td>
                    <td className="border border-line p-2 align-top">
                      {item.certificateScope === 'dual' ? (
                        <div className="flex flex-col gap-2">
                          {(['jiurun', 'zhenglongxing'] as CompanyId[]).map((side) =>
                            renderJudgmentSelect(
                              item.judgmentByCompany?.[side],
                              (j) =>
                                updateChecklistItem(audit.id, item.id, {
                                  judgmentByCompany: {
                                    jiurun: item.judgmentByCompany?.jiurun ?? null,
                                    zhenglongxing: item.judgmentByCompany?.zhenglongxing ?? null,
                                    [side]: j,
                                  },
                                }),
                              COMPANY_LABELS[side],
                            ),
                          )}
                          {renderNcrHint(item)}
                        </div>
                      ) : (
                        <>
                          {renderJudgmentSelect(item.judgment, (j) =>
                            updateChecklistItem(audit.id, item.id, { judgment: j }),
                          )}
                          {renderNcrHint(item)}
                        </>
                      )}
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
                          onClick={() => handleRemove(item.id, isItemNonConform(item))}
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
        </ScrollRegion>
      </div>
    </div>
  )
}
