import { useEffect, useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { canTransitionNcrStatus, isNcrStale, validateNcrClose } from '../lib/ncr'
import type { NCRClassification, NCRStatus } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import {
  buildFormExportFilename,
  exportNcrExcel,
  exportNcrPdf,
} from '../lib/formExport'
import { FormExportButtons } from './ui/FormExportButtons'
import { FormPrintButton } from './ui/FormPrintButton'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { AttachmentField } from './ui/AttachmentField'
import { normalizeAttachments } from '../lib/attachments'
import {
  canAddManualNcr,
  canCloseNcr,
  canEditNcrFields,
  isReadOnlyRole,
} from '../lib/userRole'

const STATUSES: NCRStatus[] = ['開立', '矯正中', '結案']
const CLASSIFICATIONS: NCRClassification[] = ['重大', '輕微']

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

function NcrField({
  label,
  value,
  onChange,
  rows = 2,
  printValue,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  printValue?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <textarea
        className={`w-full rounded border border-line bg-surface px-2 py-1.5 text-sm no-print ${FOCUS_RING}`}
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="print-only whitespace-pre-wrap text-sm">{printValue ?? value}</p>
    </div>
  )
}

export function NCRList({
  store,
  selectedNcrId,
}: {
  store: AuditStore
  selectedNcrId?: string
}) {
  const { state, updateNCR, addManualNCR } = store
  const { company, settings } = state

  const [newNcr, setNewNcr] = useState({
    qpCode: company.planRows[0]?.qpCode ?? 'QP-01',
    departmentId: company.planRows[0]?.departmentId ?? '',
    description: '',
  })
  const [closeErrors, setCloseErrors] = useState<Record<string, string>>({})
  const selectedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (selectedNcrId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedNcrId])

  const readOnly = isReadOnlyRole(settings.viewRole)
  const canEdit = canEditNcrFields(settings.viewRole)
  const canClose = canCloseNcr(settings.viewRole)
  const canAdd = canAddManualNcr(settings.viewRole)
  const exportFilenameBase = buildFormExportFilename(company.name, 'QR-28-03')
  const exportContext = {
    settings,
    company,
    ncrs: company.ncrs,
  }
  const statusOptions = STATUSES.filter((s) => s !== '結案' || canClose).map((s) => ({
    value: s,
    label: s,
  }))

  const planRowOptions = company.planRows.map((r) => ({
    value: `${r.qpCode}|${r.departmentId}`,
    label: `${r.qpCode} · ${r.department}`,
  }))

  const handleStatusChange = (ncrId: string, nextStatus: NCRStatus) => {
    const ncr = company.ncrs.find((n) => n.id === ncrId)
    if (!ncr) return

    const gate = canTransitionNcrStatus(ncr, nextStatus)
    if (!gate.ok) {
      setCloseErrors((prev) => ({
        ...prev,
        [ncrId]: `無法結案：尚缺 ${gate.missing.join('、')}`,
      }))
      return
    }

    setCloseErrors((prev) => {
      const next = { ...prev }
      delete next[ncrId]
      return next
    })
    updateNCR(ncrId, { status: nextStatus })
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <Card className="no-print">
        <h2 className="mb-2 text-lg font-semibold text-ink">手動新增 NCR</h2>
        {!canAdd && (
          <p className="mb-2 text-xs text-muted">目前角色無法手動新增 NCR。</p>
        )}
        <p className="mb-3 text-sm text-muted">主要仍由查檢表判定「不符」自動產生；此處可登錄會議或現場發現。</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="程序／部門"
            value={`${newNcr.qpCode}|${newNcr.departmentId}`}
            onChange={(v) => {
              const [qp, dept] = v.split('|')
              setNewNcr((s) => ({ ...s, qpCode: qp, departmentId: dept }))
            }}
            options={planRowOptions}
          />
          <Input
            label="描述"
            value={newNcr.description}
            onChange={(v) => setNewNcr((s) => ({ ...s, description: v }))}
          />
          <div className="flex items-end">
            <Button
              disabled={!canAdd}
              onClick={() => {
                if (!newNcr.description.trim()) return
                addManualNCR(newNcr)
                setNewNcr((s) => ({ ...s, description: '' }))
              }}
            >
              新增 NCR
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">不符合事項清單（QR-28-03）</h2>
            <p className="text-sm text-muted">
              查檢表判定「不符」時自動匯入；請填寫根本原因、矯正措施與驗證佐證後結案。結案後年度計畫月格將自動更新為矯正圓滿。
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <FormExportButtons
              formId="QR-28-03"
              filenameBase={exportFilenameBase}
              onExportExcel={() => exportNcrExcel(exportContext)}
              onExportPdf={() => exportNcrPdf(exportContext)}
            />
            <FormPrintButton />
          </div>
        </div>

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="不符合事項清單 QR-28-03"
          subtitle={
            company.keyCustomerName?.trim() ? `主要客戶：${company.keyCustomerName}` : undefined
          }
        />

        {company.ncrs.length === 0 ? (
          <EmptyState message="目前無不符合事項" />
        ) : (
          <div className="space-y-4">
            {company.ncrs.map((ncr) => {
              const stale = isNcrStale(ncr, company.audits)
              const closeHint = closeErrors[ncr.id]
              const gate = validateNcrClose(ncr)

              return (
                <article
                  key={ncr.id}
                  ref={ncr.id === selectedNcrId ? selectedRef : undefined}
                  className={`rounded-xl border border-line p-4 ${
                    ncr.id === selectedNcrId
                      ? 'ring-2 ring-primary bg-primary/5'
                      : stale
                        ? 'bg-amber-50/50 dark:bg-amber-950/20'
                        : 'bg-page/40'
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-ink">{ncr.ncrNumber}</p>
                      <p className="mt-1 text-sm text-muted">
                        {ncr.qpCode} · {ncr.department} · {ncr.process}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="no-print min-w-[140px]">
                        <Select
                          label="狀態"
                          value={ncr.status}
                          onChange={(v) => handleStatusChange(ncr.id, v as NCRStatus)}
                          options={statusOptions}
                        />
                        {!canClose && ncr.status !== '結案' && (
                          <p className="mt-1 text-xs text-muted">受稽部門無法將 NCR 結案</p>
                        )}
                      </div>
                      <span className="print-only"><Badge label={ncr.status} /></span>
                    </div>
                  </div>

                  {stale && (
                    <p className="mb-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                      查檢已非不符，建議結案
                    </p>
                  )}

                  {closeHint && (
                    <p role="alert" className="mb-3 text-sm text-red-700 dark:text-red-300">
                      {closeHint}
                    </p>
                  )}

                  {ncr.status !== '結案' && !gate.ok && (
                    <p className="mb-3 text-xs text-muted">
                      結案前須填：{gate.missing.join('、')}
                    </p>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <NcrField
                      label="不符合描述"
                      value={ncr.description}
                      disabled={readOnly || !canEdit}
                      onChange={(v) => updateNCR(ncr.id, { description: v })}
                      rows={3}
                    />
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">發現日期</label>
                      <input
                        type="date"
                        className={`w-full rounded border border-line bg-surface px-2 py-1.5 text-sm no-print ${FOCUS_RING}`}
                        value={ncr.date}
                        disabled={readOnly || !canEdit}
                        onChange={(e) => updateNCR(ncr.id, { date: e.target.value })}
                      />
                      <p className="print-only text-sm">{ncr.date}</p>
                    </div>
                    <Select
                      label="重大／輕微"
                      value={ncr.classification ?? ''}
                      onChange={(v) =>
                        updateNCR(ncr.id, { classification: (v || undefined) as NCRClassification })
                      }
                      options={[
                        { value: '', label: '—' },
                        ...CLASSIFICATIONS.map((c) => ({ value: c, label: c })),
                      ]}
                    />
                    <Input
                      label="責任者"
                      value={ncr.responsiblePerson ?? ''}
                      onChange={(v) => updateNCR(ncr.id, { responsiblePerson: v })}
                    />
                    <Input
                      label="期限"
                      type="date"
                      value={ncr.dueDate ?? ''}
                      onChange={(v) => updateNCR(ncr.id, { dueDate: v })}
                    />
                    <div className="md:col-span-2">
                      <NcrField
                        label="遏制／圍堵措施"
                        value={ncr.containment ?? ''}
                        onChange={(v) => updateNCR(ncr.id, { containment: v })}
                      />
                    </div>
                    <NcrField
                      label="根本原因"
                      value={ncr.rootCause}
                      onChange={(v) => updateNCR(ncr.id, { rootCause: v })}
                    />
                    <NcrField
                      label="矯正措施"
                      value={ncr.correctiveAction}
                      onChange={(v) => updateNCR(ncr.id, { correctiveAction: v })}
                    />
                    <div className="md:col-span-2">
                      <NcrField
                        label="驗證／結案佐證"
                        value={ncr.verificationEvidence}
                        disabled={readOnly || !canEdit}
                        onChange={(v) => updateNCR(ncr.id, { verificationEvidence: v })}
                        rows={3}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <AttachmentField
                        label="NCR 佐證附件"
                        attachments={normalizeAttachments(ncr.attachments)}
                        disabled={readOnly || !canEdit}
                        onChange={(attachments) => updateNCR(ncr.id, { attachments })}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
