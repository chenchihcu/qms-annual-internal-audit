import { useEffect, useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import {
  buildAuditScheduleRows,
  CATEGORY_FILTER_LABELS,
  defaultScheduleFilter,
  filterScheduleRows,
  SCHEDULE_FILTER_LABELS,
} from '../lib/auditSchedule'
import type { CategoryFilter, ScheduleFilter } from '../lib/auditSchedule'
import { CATEGORY_FILTER_ICONS, SCHEDULE_FILTER_ICONS } from '../lib/uiIcons'
import { Badge, Card } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { FilterChips } from './ui/FilterChips'
import { PageToolbar } from './ui/PageToolbar'
import { ScrollRegion } from './ui/ScrollRegion'

interface AuditSchedulePageProps {
  store: AuditStore
  onOpenAudit: (auditId: string) => void
}

export function AuditSchedulePage({ store, onOpenAudit }: AuditSchedulePageProps) {
  const { state, ensureAllAudits } = store
  const { company, settings } = state
  const rows = useMemo(
    () => buildAuditScheduleRows(company, settings.scoringRules),
    [company, settings.scoringRules],
  )
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>(() => defaultScheduleFilter(rows))
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  useEffect(() => {
    ensureAllAudits()
  }, [ensureAllAudits])

  const visibleRows = useMemo(
    () => filterScheduleRows(rows, scheduleFilter, categoryFilter),
    [rows, scheduleFilter, categoryFilter],
  )

  const scheduleFilterOptions = (Object.keys(SCHEDULE_FILTER_LABELS) as ScheduleFilter[]).map((filter) => ({
    id: filter,
    label: SCHEDULE_FILTER_LABELS[filter],
    icon: SCHEDULE_FILTER_ICONS[SCHEDULE_FILTER_LABELS[filter]],
  }))

  const categoryFilterOptions = (Object.keys(CATEGORY_FILTER_LABELS) as CategoryFilter[]).map((filter) => ({
    id: filter,
    label: CATEGORY_FILTER_LABELS[filter],
    icon: CATEGORY_FILTER_ICONS[CATEGORY_FILTER_LABELS[filter]],
  }))

  return (
    <div className="space-y-6">
      <Card>
        <PageToolbar title="稽核日程" />

        <FilterChips
          options={scheduleFilterOptions}
          value={scheduleFilter}
          onChange={setScheduleFilter}
          ariaLabel="日程篩選"
        />

        <FilterChips
          options={categoryFilterOptions}
          value={categoryFilter}
          onChange={setCategoryFilter}
          ariaLabel="稽核類型篩選"
          tone="slate"
        />

        {visibleRows.length === 0 ? (
          <EmptyState message="目前沒有稽核事件。" />
        ) : (
          <ScrollRegion ariaLabel="稽核日程工作表">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border p-2">QP · 部門</th>
                  <th className="border p-2">類型</th>
                  <th className="border p-2">計畫月／日期</th>
                  <th className="border p-2">狀態</th>
                  <th className="border p-2">判定</th>
                  <th className="border p-2">得分</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.auditId} className="hover:bg-slate-50">
                    <td className="border p-2">
                      <button
                        type="button"
                        className="font-medium text-blue-800 underline-offset-2 hover:underline"
                        onClick={() => onOpenAudit(row.auditId)}
                      >
                        {row.qpCode} · {row.department}
                      </button>
                    </td>
                    <td className="border p-2 text-xs">{row.auditCategory}</td>
                    <td className="border p-2 text-xs">
                      {row.scheduledMonths || row.plannedDate || row.auditDate || '—'}
                    </td>
                    <td className="border p-2"><Badge label={row.status} /></td>
                    <td className="border p-2 text-xs">{row.judgedCount}/{row.totalItems}</td>
                    <td className="border p-2 text-xs">
                      {row.score == null ? '未計分' : `${row.score}%`}
                    </td>
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
