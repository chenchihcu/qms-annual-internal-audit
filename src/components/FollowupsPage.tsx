import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
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
  const auditYear = companySettingsFor(state, WORKSPACE_COMPANY_ID).auditYear
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
          <ScrollRegion ariaLabel="待改善追蹤一覽">
            <table className="worksheet-table min-w-[41.5rem]">
              <colgroup>
                <col className="col-status" />
                <col />
                <col className="col-code" />
                <col className="col-name" />
                <col className="col-status" />
                <col className="col-date" />
              </colgroup>
              <thead>
                <tr>
                  <th >類型</th>
                  <th >摘要</th>
                  <th >QP</th>
                  <th >部門／單位</th>
                  <th >狀態</th>
                  <th >到期</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={`${row.kind}-${row.id}`} className={`${!pagination.isVisible(index) ? 'pagination-hidden-row ' : ''}`}>
                    <td ><Badge label={FOLLOWUP_KIND_LABELS[row.kind]} /></td>
                    <td >
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
                    <td>{row.qpCode || '—'}</td>
                    <td>{row.department || '—'}</td>
                    <td>
                      {row.status}
                      {isFollowupOverdue(row.dueDate, today) && (
                        <span className="ml-2 inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">
                          逾期
                        </span>
                      )}
                    </td>
                    <td>{row.dueDate || '—'}</td>
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
