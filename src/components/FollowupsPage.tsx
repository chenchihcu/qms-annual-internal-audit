import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import {
  buildFollowupQueue,
  filterFollowupRows,
  FOLLOWUP_FILTER_LABELS,
  FOLLOWUP_KIND_LABELS,
} from '../lib/followupQueue'
import type { FollowupFilter } from '../lib/followupQueue'
import type { TabId } from '../types'
import { FOLLOWUP_FILTER_ICONS } from '../lib/uiIcons'
import { Badge, Card } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { FilterChips } from './ui/FilterChips'
import { PageToolbar } from './ui/PageToolbar'
import { ScrollRegion } from './ui/ScrollRegion'

interface FollowupsPageProps {
  store: AuditStore
  onNavigate: (tab: TabId) => void
}

export function FollowupsPage({ store, onNavigate }: FollowupsPageProps) {
  const { state } = store
  const { company } = state
  const rows = useMemo(() => buildFollowupQueue(company), [company])
  const [filter, setFilter] = useState<FollowupFilter>('all')
  const visibleRows = useMemo(() => filterFollowupRows(rows, filter), [rows, filter])

  const filterOptions = (Object.keys(FOLLOWUP_FILTER_LABELS) as FollowupFilter[]).map((item) => ({
    id: item,
    label: FOLLOWUP_FILTER_LABELS[item],
    icon: FOLLOWUP_FILTER_ICONS[FOLLOWUP_FILTER_LABELS[item]],
  }))

  return (
    <div className="space-y-6">
      <Card>
        <PageToolbar title="待改善追蹤" />

        <FilterChips
          options={filterOptions}
          value={filter}
          onChange={setFilter}
          ariaLabel="追蹤類型篩選"
        />

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
