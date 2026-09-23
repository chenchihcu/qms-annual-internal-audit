import { Fragment, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportNcrExcel } from '../lib/formExport'
import { buildAppHash } from '../lib/navigation'
import { isNcrStale } from '../lib/ncr'
import type { NCRStatus } from '../types'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Select } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { FilterChips } from './ui/FilterChips'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ScrollRegion } from './ui/ScrollRegion'

const STATUSES: NCRStatus[] = ['開立', '矯正中', '結案']
type NcrStatusFilter = 'all' | NCRStatus

function canCloseNcr(ncr: {
  correctiveActionReference?: string
  effectivenessReference?: string
  effectivenessVerifiedBy?: string
  effectivenessVerifiedAt?: string
}) {
  return Boolean(
    ncr.correctiveActionReference
    && ncr.effectivenessReference
    && ncr.effectivenessVerifiedBy
    && ncr.effectivenessVerifiedAt,
  )
}

function NcrCloseFields({
  ncr,
  updateNCR,
}: {
  ncr: {
    id: string
    ncrNumber: string
    correctionReference?: string
    correctiveActionReference?: string
    effectivenessReference?: string
    effectivenessVerifiedBy?: string
    effectivenessVerifiedAt?: string
  }
  updateNCR: AuditStore['updateNCR']
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs" aria-label={`NCR ${ncr.ncrNumber} 立即矯正／處置引用`} placeholder="立即矯正／處置引用" value={ncr.correctionReference ?? ''} onChange={(e) => updateNCR(ncr.id, { correctionReference: e.target.value })} />
      <input className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs" aria-label={`NCR ${ncr.ncrNumber} 矯正措施／正式處置紀錄`} placeholder="矯正措施／正式處置紀錄" value={ncr.correctiveActionReference ?? ''} onChange={(e) => updateNCR(ncr.id, { correctiveActionReference: e.target.value })} />
      <input className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs" aria-label={`NCR ${ncr.ncrNumber} 效果確認紀錄`} placeholder="效果確認紀錄" value={ncr.effectivenessReference ?? ''} onChange={(e) => updateNCR(ncr.id, { effectivenessReference: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <input className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs" aria-label={`NCR ${ncr.ncrNumber} 效果確認人`} placeholder="確認人" value={ncr.effectivenessVerifiedBy ?? ''} onChange={(e) => updateNCR(ncr.id, { effectivenessVerifiedBy: e.target.value })} />
        <input type="date" className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs" aria-label={`NCR ${ncr.ncrNumber} 效果確認日期`} value={ncr.effectivenessVerifiedAt ?? ''} onChange={(e) => updateNCR(ncr.id, { effectivenessVerifiedAt: e.target.value })} />
      </div>
    </div>
  )
}

export function NCRList({ store }: { store: AuditStore }) {
  const { state, updateNCR } = store
  const { company, settings } = state
  const [closeBlockNcrId, setCloseBlockNcrId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<NcrStatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const statusFilterOptions = [
    { id: 'all' as NcrStatusFilter, label: '全部' },
    ...STATUSES.map((status) => ({ id: status as NcrStatusFilter, label: status })),
  ]

  const visibleNcrs = useMemo(
    () => company.ncrs.filter((ncr) => statusFilter === 'all' || ncr.status === statusFilter),
    [company.ncrs, statusFilter],
  )

  const handleStatusChange = (ncrId: string, value: string, ncr: typeof company.ncrs[number]) => {
    if (value === '結案' && !canCloseNcr(ncr)) {
      setCloseBlockNcrId(ncrId)
      setExpandedId(ncrId)
      return
    }
    setCloseBlockNcrId((current) => (current === ncrId ? null : current))
    updateNCR(ncrId, { status: value as NCRStatus })
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <Card>
        <PrintDocHeader
          companyName={company.name}
          auditYear={settings.auditYear}
          formTitle="不符合事項清單 QR-28-03"
        />
        <PageToolbar
          title="不符合"
          actions={(
            <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportNcrExcel(state, state.activeCompanyId)}>
              匯出 Excel
            </Button>
          )}
        />

        <FilterChips
          options={statusFilterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="不符合狀態篩選"
        />

        {visibleNcrs.length === 0 ? (
          <EmptyState message="目前沒有不符合事項。" />
        ) : (
          <ScrollRegion ariaLabel="不符合事項清單 QR-28-03">
            <table className="qr-checklist w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border p-2">NCR#</th>
                  <th className="border p-2">來源</th>
                  <th className="border p-2">QP</th>
                  <th className="border p-2">部門</th>
                  <th className="border p-2">描述</th>
                  <th className="border p-2">日期</th>
                  <th className="border p-2">狀態</th>
                  <th className="border p-2 no-print">明細</th>
                </tr>
              </thead>
              <tbody>
                {visibleNcrs.map((ncr) => {
                  const stale = isNcrStale(ncr, company.audits)
                  const expanded = expandedId === ncr.id
                  return (
                    <Fragment key={ncr.id}>
                      <tr data-ncr-id={ncr.id} className={stale ? 'bg-amber-50/50' : ''}>
                        <td className="border p-2 font-mono text-xs">
                          {ncr.ncrNumber}
                          {stale && <span className="mt-1 block text-xs text-amber-800">來源判定已變更</span>}
                        </td>
                        <td className="border p-2 text-xs">
                          {ncr.sourceAuditId ? (
                            <a className="text-blue-700 underline" href={buildAppHash('audit', ncr.sourceAuditId)}>稽核事件</a>
                          ) : '—'}
                        </td>
                        <td className="border p-2">{ncr.qpCode}</td>
                        <td className="border p-2">{ncr.department}</td>
                        <td className="border p-2 text-xs">
                          <p className="line-clamp-2">{ncr.description}</p>
                          <span className="print-only">{ncr.description}</span>
                        </td>
                        <td className="border p-2 text-xs">{ncr.date}</td>
                        <td className="border p-2">
                          <div className="no-print">
                            <Select
                              ariaLabel={`NCR ${ncr.ncrNumber} 狀態`}
                              value={ncr.status}
                              onChange={(v) => handleStatusChange(ncr.id, v, ncr)}
                              options={STATUSES.map((s) => ({ value: s, label: s }))}
                            />
                          </div>
                          <span className="print-only"><Badge label={ncr.status} /></span>
                        </td>
                        <td className="border p-2 no-print">
                          <Button
                            variant="ghost"
                            icon={ACTION_ICONS.edit}
                            onClick={() => setExpandedId(expanded ? null : ncr.id)}
                          >
                            {expanded ? '收起' : '編輯'}
                          </Button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={8} className="border p-3">
                            <textarea
                              className="mb-3 w-full min-w-[200px] rounded border border-slate-200 px-2 py-1 no-print"
                              rows={2}
                              aria-label={`NCR ${ncr.ncrNumber} 不符合描述`}
                              value={ncr.description}
                              onChange={(e) => updateNCR(ncr.id, { description: e.target.value })}
                            />
                            <div className="mb-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
                              <label className="text-xs font-medium text-slate-600">發生日</label>
                              <input
                                type="date"
                                className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs"
                                aria-label={`NCR ${ncr.ncrNumber} 發生日`}
                                value={ncr.date}
                                onChange={(e) => updateNCR(ncr.id, { date: e.target.value })}
                              />
                            </div>
                            <p className="mb-2 text-xs font-medium text-slate-600">結案欄位</p>
                            <NcrCloseFields ncr={ncr} updateNCR={updateNCR} />
                            {closeBlockNcrId === ncr.id && (
                              <p role="alert" className="mt-2 text-xs text-red-700">
                                結案前須填寫矯正措施、效果確認紀錄、確認人與確認日期。
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </Card>
    </div>
  )
}
