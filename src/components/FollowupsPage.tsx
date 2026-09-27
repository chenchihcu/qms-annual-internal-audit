import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import {
  buildFollowupQueue,
  filterFollowupRows,
  FOLLOWUP_FILTER_LABELS,
  FOLLOWUP_KIND_LABELS,
  isFollowupOverdue,
} from '../lib/followupQueue'
import type { FollowupFilter } from '../lib/followupQueue'
import type { NavigateOptions } from '../lib/navigation'
import type { TabId } from '../types'
import { companySettingsFor } from '../types'
import { FOLLOWUP_FILTER_ICONS } from '../lib/uiIcons'
import { Badge } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { FilterChips } from './ui/FilterChips'
import { PageToolbar } from './ui/PageToolbar'
import { ScrollRegion } from './ui/ScrollRegion'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'

interface FollowupsPageProps {
  store: AuditStore
  onNavigate: (tab: TabId, options?: NavigateOptions) => void
}

export function FollowupsPage({ store, onNavigate }: FollowupsPageProps) {
  const { state } = store
  const { company } = state
  const auditYear = companySettingsFor(state, state.activeCompanyId).auditYear
  const [today] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10))
  const rows = useMemo(() => buildFollowupQueue(company), [company])
  const [filter, setFilter] = useState<FollowupFilter>('all')
  const visibleRows = useMemo(() => filterFollowupRows(rows, filter), [rows, filter])
  const pagination = useTablePagination(visibleRows.length, 10, undefined, `${filter}|${state.settings.auditYear}`)

  const filterOptions = (Object.keys(FOLLOWUP_FILTER_LABELS) as FollowupFilter[]).map((item) => ({
    id: item,
    label: FOLLOWUP_FILTER_LABELS[item],
    icon: FOLLOWUP_FILTER_ICONS[FOLLOWUP_FILTER_LABELS[item]],
  }))

  return (
    <div className="space-y-6">
      <div>
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
          <>
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
                {visibleRows.map((row, index) => (
                  <tr key={`${row.kind}-${row.id}`} className={`${!pagination.isVisible(index) ? 'pagination-hidden-row ' : ''}hover:bg-slate-50`}>
                    <td className="border p-2"><Badge label={FOLLOWUP_KIND_LABELS[row.kind]} /></td>
                    <td className="border p-2">
                      <button
                        type="button"
                        className="text-left font-medium text-blue-800 underline-offset-2 hover:underline"
                        onClick={() =>
                          onNavigate(row.tab, {
                            recordId: row.id,
                            section:
                              row.kind === 'observation'
                                ? row.year < auditYear
                                  ? 'prior'
                                  : 'current'
                                : undefined,
                          })
                        }
                      >
                        {row.label}
                      </button>
                    </td>
                    <td className="border p-2 text-xs">{row.qpCode || '—'}</td>
                    <td className="border p-2 text-xs">{row.department || '—'}</td>
                    <td className="border p-2 text-xs">
                      {row.status}
                      {isFollowupOverdue(row.dueDate, today) && (
                        <span className="ml-2 inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">
                          逾期
                        </span>
                      )}
                    </td>
                    <td className="border p-2 text-xs">{row.dueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
          <TablePagination pagination={pagination} label="待改善追蹤" />
          </>
        )}
      </div>
    </div>
  )
}
