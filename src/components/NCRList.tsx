import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { isNcrStale } from '../lib/ncr'
import type { NCRStatus } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'

const STATUSES: NCRStatus[] = ['開立', '矯正中', '結案']

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

export function NCRList({ store }: { store: AuditStore }) {
  const { state, updateNCR, addManualNCR } = store
  const { company, settings } = state

  const [newNcr, setNewNcr] = useState({
    qpCode: company.planRows[0]?.qpCode ?? 'QP-01',
    departmentId: company.planRows[0]?.departmentId ?? '',
    description: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const planRowOptions = company.planRows.map((r) => ({
    value: `${r.qpCode}|${r.departmentId}`,
    label: `${r.qpCode} · ${r.department}`,
  }))
  const selectedPlanRow = company.planRows.find(
    (row) => row.qpCode === newNcr.qpCode && row.departmentId === newNcr.departmentId,
  ) ?? company.planRows[0]

  return (
    <div className="space-y-6 print-area qr-form">
      <Card className="no-print">
        <h2 className="mb-3 text-lg font-semibold text-ink">新增 NCR</h2>
        <p className="mb-3 text-sm text-muted">查檢表「不符」會自動建立；其他發現可手動新增。</p>
        <form
          className="record-create-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedPlanRow) {
              setFormSuccess(null)
              setFormError('請先建立年度計畫列。')
              return
            }
            if (!newNcr.description.trim()) {
              setFormSuccess(null)
              setFormError('請填寫描述。')
              return
            }
            addManualNCR({ ...newNcr, qpCode: selectedPlanRow.qpCode, departmentId: selectedPlanRow.departmentId })
            setNewNcr((s) => ({ ...s, qpCode: selectedPlanRow.qpCode, departmentId: selectedPlanRow.departmentId, description: '' }))
            setFormError(null)
            setFormSuccess('已新增 NCR。')
          }}
        >
          <Select
            label="程序／部門"
            value={selectedPlanRow ? `${selectedPlanRow.qpCode}|${selectedPlanRow.departmentId}` : ''}
            onChange={(v) => {
              const [qp, dept] = v.split('|')
              setNewNcr((s) => ({ ...s, qpCode: qp, departmentId: dept }))
            }}
            options={planRowOptions}
            disabled={!planRowOptions.length}
            required
            error={formError && !selectedPlanRow ? formError : undefined}
          />
          <Input
            label="描述"
            value={newNcr.description}
            onChange={(v) => { setNewNcr((s) => ({ ...s, description: v })); setFormError(null); setFormSuccess(null) }}
            required
            error={formError && selectedPlanRow ? formError : undefined}
          />
          <div className="record-create-submit">
            <Button type="submit">
              新增 NCR
            </Button>
          </div>
          <div className="record-create-feedback" aria-live="polite">
            {formSuccess && <p role="status" className="text-sm font-medium text-green-800 dark:text-green-300">{formSuccess}</p>}
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-ink">不符合事項清單（QR-28-03）</h2>
          <p className="text-sm text-muted">矯正說明可在此編輯，不受查檢表覆寫。</p>
        </div>

        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="不符合事項清單 QR-28-03"
        />

        {company.ncrs.length === 0 ? (
          <EmptyState message="目前無不符合事項" />
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="不符合事項清單">
            <table className="qr-checklist stacked-table w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page text-left text-muted">
                  <th className="border border-line p-2">NCR#</th>
                  <th className="border border-line p-2">QP</th>
                  <th className="border border-line p-2">部門</th>
                  <th className="border border-line p-2">流程</th>
                  <th className="border border-line p-2">描述</th>
                  <th className="border border-line p-2">日期</th>
                  <th className="border border-line p-2">狀態</th>
                </tr>
              </thead>
              <tbody>
                {company.ncrs.map((ncr) => {
                  const stale = isNcrStale(ncr, company.audits)
                  return (
                    <tr key={ncr.id} className={stale ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                      <td data-label="NCR#" className="border border-line p-2 font-mono text-xs">{ncr.ncrNumber}</td>
                      <td data-label="QP" className="border border-line p-2">{ncr.qpCode}</td>
                      <td data-label="部門" className="border border-line p-2">{ncr.department}</td>
                      <td data-label="流程" className="border border-line p-2">{ncr.process}</td>
                      <td data-label="描述" className="border border-line p-2">
                        {stale && (
                          <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                            判定已改變，建議結案
                          </p>
                        )}
                        <textarea
                          className={`w-full min-w-[200px] rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                          rows={2}
                          aria-label={`${ncr.ncrNumber} 描述`}
                          value={ncr.description}
                          onChange={(e) => updateNCR(ncr.id, { description: e.target.value })}
                        />
                        <span className="print-only">{ncr.description}</span>
                      </td>
                      <td data-label="日期" className="border border-line p-2">
                        <input
                          type="date"
                          aria-label={`${ncr.ncrNumber} 日期`}
                          className={`min-h-11 rounded border border-line bg-surface px-1 no-print ${FOCUS_RING}`}
                          value={ncr.date}
                          onChange={(e) => updateNCR(ncr.id, { date: e.target.value })}
                        />
                        <span className="print-only">{ncr.date}</span>
                      </td>
                      <td data-label="狀態" className="border border-line p-2">
                        <div className="no-print">
                          <Select
                            value={ncr.status}
                            ariaLabel={`${ncr.ncrNumber} 狀態`}
                            onChange={(v) => updateNCR(ncr.id, { status: v as NCRStatus })}
                            options={STATUSES.map((s) => ({ value: s, label: s }))}
                          />
                        </div>
                        <span className="print-only"><Badge label={ncr.status} /></span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
