import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { buildAppHash } from '../lib/navigation'
import {
  buildCarryForwardSummary,
  buildFollowupQueue,
  filterFollowupRows,
  FOLLOWUP_FILTER_LABELS,
  FOLLOWUP_KIND_LABELS,
} from '../lib/followupQueue'
import type { FollowupFilter } from '../lib/followupQueue'
import type { TabId } from '../types'
import { FOLLOWUP_FILTER_ICONS } from '../lib/uiIcons'
import { Badge, Card } from './ui/Badge'
import { Icon } from './ui/Icon'
import { ScrollRegion } from './ui/ScrollRegion'
import { EmptyState } from './ui/EmptyState'

interface FollowupsPageProps {
  store: AuditStore
  onNavigate: (tab: TabId) => void
}

export function FollowupsPage({ store, onNavigate }: FollowupsPageProps) {
  const { state } = store
  const { company } = state
  const rows = useMemo(() => buildFollowupQueue(company), [company])
  const carryForward = useMemo(() => buildCarryForwardSummary(state), [state])
  const [filter, setFilter] = useState<FollowupFilter>('all')
  const visibleRows = useMemo(() => filterFollowupRows(rows, filter), [rows, filter])

  return (
    <div className="space-y-6">
      {carryForward.total > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <p className="text-sm text-amber-900">
            跨年待帶入：觀察 {carryForward.importableObservations} 件、NCR {carryForward.importableNcrs} 件。
            <a className="ml-2 font-medium text-blue-700 underline" href={buildAppHash('observations')}>
              至觀察事項帶入
            </a>
          </p>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">待改善追蹤</h2>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="追蹤類型篩選">
          {(Object.keys(FOLLOWUP_FILTER_LABELS) as FollowupFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                filter === item
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300'
              }`}
              onClick={() => setFilter(item)}
            >
              <Icon name={FOLLOWUP_FILTER_ICONS[FOLLOWUP_FILTER_LABELS[item]]} size="sm" />
              {FOLLOWUP_FILTER_LABELS[item]}
            </button>
          ))}
        </div>

        {visibleRows.length === 0 ? (
          <EmptyState message="目前沒有待追蹤項目。" />
        ) : (
          <ScrollRegion ariaLabel="待改善追蹤工作表">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border p-2">類型</th>
                  <th className="border p-2">摘要</th>
                  <th className="border p-2">QP</th>
                  <th className="border p-2">部門／單位</th>
                  <th className="border p-2">狀態</th>
                  <th className="border p-2">到期</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="hover:bg-slate-50">
                    <td className="border p-2"><Badge label={FOLLOWUP_KIND_LABELS[row.kind]} /></td>
                    <td className="border p-2">
                      <button
                        type="button"
                        className="text-left font-medium text-blue-800 underline-offset-2 hover:underline"
                        onClick={() => onNavigate(row.tab)}
                      >
                        {row.label}
                      </button>
                    </td>
                    <td className="border p-2 text-xs">{row.qpCode || '—'}</td>
                    <td className="border p-2 text-xs">{row.department || '—'}</td>
                    <td className="border p-2 text-xs">{row.status}</td>
                    <td className="border p-2 text-xs">{row.dueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </Card>
    </div>
  )
}
