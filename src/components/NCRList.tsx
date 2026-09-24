import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { FOCUS_RING } from '../lib/focusRing'
import { isNcrStale } from '../lib/ncr'
import { planRowSelectOptions } from '../lib/planRowOptions'
import { ACTION_ICONS } from '../lib/uiIcons'
import type { NCRStatus, NcrCompanyScope } from '../types'
import { NCR_COMPANY_SCOPE_LABELS } from '../types'
import { Badge, Button, Input, Select } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'

const STATUSES: NCRStatus[] = ['開立', '矯正中', '結案']
const COMPANY_SCOPES: NcrCompanyScope[] = ['jiurun', 'zhenglongxing', 'both']

export function NCRList({ store }: { store: AuditStore }) {
  const { state, updateNCR, addManualNCR } = store
  const { company, settings } = state

  const [showForm, setShowForm] = useState(false)
  const [newNcr, setNewNcr] = useState({
    qpCode: company.planRows[0]?.qpCode ?? 'QP-01',
    departmentId: company.planRows[0]?.departmentId ?? '',
    description: '',
    companyScope: 'both' as NcrCompanyScope,
  })
  const [descriptionError, setDescriptionError] = useState<string | undefined>()

  const planRowOptions = planRowSelectOptions(company.planRows)

  const handleAddNcr = () => {
    if (!newNcr.description.trim()) {
      setDescriptionError('請填寫描述')
      return
    }
    setDescriptionError(undefined)
    addManualNCR(newNcr)
    setNewNcr((s) => ({ ...s, description: '' }))
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <div>
        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="不符合事項清單 QR-28-03"
        />

        <PageToolbar
          title="不符合"
          actions={(
            <Button
              icon={showForm ? undefined : ACTION_ICONS.add}
              onClick={() => setShowForm((value) => !value)}
            >
              {showForm ? '收起登錄' : '手動新增 NCR'}
            </Button>
          )}
        />

        {showForm && (
          <div className="mb-6 no-print">
            <p className="mb-3 text-sm text-muted">查檢表判定「不符」時自動匯入，描述為矯正說明且不會被查檢表覆寫；此處可登錄會議或現場發現。</p>
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
              <Select
                label="證書"
                value={newNcr.companyScope}
                onChange={(v) => setNewNcr((s) => ({ ...s, companyScope: v as NcrCompanyScope }))}
                options={COMPANY_SCOPES.map((s) => ({
                  value: s,
                  label: NCR_COMPANY_SCOPE_LABELS[s],
                }))}
              />
              <div>
                <Input
                  label="描述"
                  value={newNcr.description}
                  onChange={(v) => {
                    setNewNcr((s) => ({ ...s, description: v }))
                    if (descriptionError && v.trim()) setDescriptionError(undefined)
                  }}
                />
                {descriptionError && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{descriptionError}</p>
                )}
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddNcr} disabled={!newNcr.description.trim()}>
                  新增 NCR
                </Button>
              </div>
            </div>
          </div>
        )}

        {company.ncrs.length === 0 ? (
          <EmptyState message="目前無不符合事項" />
        ) : (
          <ScrollRegion ariaLabel="不符合事項清單">
            <table className="qr-checklist w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page text-left text-muted">
                  <th className="border border-line p-2">NCR#</th>
                  <th className="border border-line p-2">證書</th>
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
                  const scope = ncr.companyScope ?? 'both'
                  return (
                    <tr key={ncr.id} className={stale ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                      <td className="border border-line p-2 font-mono text-xs">{ncr.ncrNumber}</td>
                      <td className="border border-line p-2">
                        <div className="no-print">
                          <Select
                            value={scope}
                            onChange={(v) =>
                              updateNCR(ncr.id, { companyScope: v as NcrCompanyScope })
                            }
                            ariaLabel={`${ncr.ncrNumber} 證書範圍`}
                            options={COMPANY_SCOPES.map((s) => ({
                              value: s,
                              label: NCR_COMPANY_SCOPE_LABELS[s],
                            }))}
                          />
                        </div>
                        <span className="print-only">{NCR_COMPANY_SCOPE_LABELS[scope]}</span>
                      </td>
                      <td className="border border-line p-2">{ncr.qpCode}</td>
                      <td className="border border-line p-2">{ncr.department}</td>
                      <td className="border border-line p-2">{ncr.process}</td>
                      <td className="border border-line p-2">
                        {stale && (
                          <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                            查檢已非不符，建議結案
                          </p>
                        )}
                        <textarea
                          className={`w-full min-w-[200px] rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                          rows={2}
                          value={ncr.description}
                          onChange={(e) => updateNCR(ncr.id, { description: e.target.value })}
                          aria-label={`${ncr.ncrNumber} 描述`}
                        />
                        <span className="print-only">{ncr.description}</span>
                      </td>
                      <td className="border border-line p-2">
                        <input
                          type="date"
                          className={`rounded border border-line bg-surface px-1 no-print ${FOCUS_RING}`}
                          value={ncr.date}
                          onChange={(e) => updateNCR(ncr.id, { date: e.target.value })}
                          aria-label={`${ncr.ncrNumber} 日期`}
                        />
                        <span className="print-only">{ncr.date}</span>
                      </td>
                      <td className="border border-line p-2">
                        <div className="no-print">
                          <Select
                            value={ncr.status}
                            onChange={(v) => updateNCR(ncr.id, { status: v as NCRStatus })}
                            ariaLabel={`${ncr.ncrNumber} 狀態`}
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
          </ScrollRegion>
        )}
      </div>
    </div>
  )
}
