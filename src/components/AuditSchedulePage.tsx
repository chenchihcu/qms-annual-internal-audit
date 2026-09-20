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
import { Icon } from './ui/Icon'
import { ScrollRegion } from './ui/ScrollRegion'
import { EmptyState } from './ui/EmptyState'

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

  const inProgressCount = rows.filter((row) => row.status === '執行中').length
  const planningCount = rows.filter((row) => row.status === '規劃中' || !row.status).length
  const reportedCount = rows.filter((row) => row.status === '已回報').length

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">稽核日程</h2>
          </div>
          <p className="text-sm text-slate-600" role="status">
            執行中 {inProgressCount} · 規劃中 {planningCount} · 已回報 {reportedCount}
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="日程篩選">
          {(Object.keys(SCHEDULE_FILTER_LABELS) as ScheduleFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={scheduleFilter === filter}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                scheduleFilter === filter
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300'
              }`}
              onClick={() => setScheduleFilter(filter)}
            >
              <Icon name={SCHEDULE_FILTER_ICONS[SCHEDULE_FILTER_LABELS[filter]]} size="sm" />
              {SCHEDULE_FILTER_LABELS[filter]}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="稽核類型篩選">
          {(Object.keys(CATEGORY_FILTER_LABELS) as CategoryFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={categoryFilter === filter}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                categoryFilter === filter
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
              onClick={() => setCategoryFilter(filter)}
            >
              <Icon name={CATEGORY_FILTER_ICONS[CATEGORY_FILTER_LABELS[filter]]} size="sm" />
              {CATEGORY_FILTER_LABELS[filter]}
            </button>
          ))}
        </div>

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
