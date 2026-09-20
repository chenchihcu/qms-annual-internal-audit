import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportNcrExcel } from '../lib/formExport'
import { buildAppHash } from '../lib/navigation'
import { isNcrStale } from '../lib/ncr'
import type { NCRStatus } from '../types'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Badge, Button, Card, Select } from './ui/Badge'
import { ScrollRegion } from './ui/ScrollRegion'
import { EmptyState } from './ui/EmptyState'

const STATUSES: NCRStatus[] = ['開立', '矯正中', '結案']

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
    <div className="mt-2 grid gap-1 no-print">
      <input className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs" aria-label={`NCR ${ncr.ncrNumber} 立即矯正／處置引用`} placeholder="立即矯正／處置引用" value={ncr.correctionReference ?? ''} onChange={(e) => updateNCR(ncr.id, { correctionReference: e.target.value })} />
      <input className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs" aria-label={`NCR ${ncr.ncrNumber} 矯正措施／正式處置紀錄`} placeholder="矯正措施／正式處置紀錄" value={ncr.correctiveActionReference ?? ''} onChange={(e) => updateNCR(ncr.id, { correctiveActionReference: e.target.value })} />
      <input className="min-h-10 rounded border border-slate-200 px-2 py-1 text-xs" aria-label={`NCR ${ncr.ncrNumber} 效果確認紀錄`} placeholder="效果確認紀錄" value={ncr.effectivenessReference ?? ''} onChange={(e) => updateNCR(ncr.id, { effectivenessReference: e.target.value })} />
      <div className="grid grid-cols-2 gap-1">
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

  const handleStatusChange = (ncrId: string, value: string, ncr: typeof company.ncrs[number]) => {
    if (value === '結案' && !canCloseNcr(ncr)) {
      setCloseBlockNcrId(ncrId)
      return
    }
    setCloseBlockNcrId((current) => (current === ncrId ? null : current))
    updateNCR(ncrId, { status: value as NCRStatus })
  }

  return (
    <div className="space-y-6 print-area qr-form">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">不符合</h2>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportNcrExcel(state, state.activeCompanyId)}>
              匯出 Excel
            </Button>
          </div>
        </div>

        <div className="print-only qr-form-header mb-4 text-center">
          <h1 className="text-xl font-bold">{company.name}</h1>
          <p>{settings.auditYear} 不符合事項清單 QR-28-03</p>
        </div>

        {company.ncrs.length === 0 ? (
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
                  <th className="border p-2">流程</th>
                  <th className="border p-2">描述</th>
                  <th className="border p-2">日期</th>
                  <th className="border p-2">狀態</th>
                </tr>
              </thead>
              <tbody>
                {company.ncrs.map((ncr) => {
                  const stale = isNcrStale(ncr, company.audits)
                  return (
                  <tr key={ncr.id} data-ncr-id={ncr.id} className={stale ? 'bg-amber-50/50' : ''}>
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
                    <td className="border p-2">{ncr.process}</td>
                    <td className="border p-2">
                      <textarea
                        className="w-full min-w-[200px] rounded border border-slate-200 px-2 py-1 no-print"
                        rows={2}
                        aria-label={`NCR ${ncr.ncrNumber} 不符合描述`}
                        value={ncr.description}
                        onChange={(e) => updateNCR(ncr.id, { description: e.target.value })}
                      />
                      <span className="print-only">{ncr.description}</span>
                      <NcrCloseFields ncr={ncr} updateNCR={updateNCR} />
                      {closeBlockNcrId === ncr.id && (
                        <p role="alert" className="mt-2 text-xs text-red-700">
                          結案前須填寫矯正措施、效果確認紀錄、確認人與確認日期。
                        </p>
                      )}
                    </td>
                    <td className="border p-2">
                      <input
                        type="date"
                        className="min-h-10 rounded border border-slate-200 px-1 no-print"
                        aria-label={`NCR ${ncr.ncrNumber} 發生日`}
                        value={ncr.date}
                        onChange={(e) => updateNCR(ncr.id, { date: e.target.value })}
                      />
                      <span className="print-only">{ncr.date}</span>
                    </td>
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
                  </tr>
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
