import { useMemo, useRef, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { calculateDepartmentPriority, describeArrangementImpact } from '../lib/planner'
import { ACTION_ICONS } from '../lib/uiIcons'
import { calculateRiskLevel } from '../lib/risk'
import type { DepartmentProfile } from '../types'
import { StakeholderEditDialog } from './stakeholders/StakeholderEditDialog'
import { Badge, Button } from './ui/Badge'
import { ScrollRegion } from './ui/ScrollRegion'
import { useTablePagination } from '../hooks/useTablePagination'
import { TablePagination } from './ui/TablePagination'

function ArrangementImpactSummary({
  dept,
  level,
}: {
  dept: DepartmentProfile
  level: '高' | '中' | '低'
}) {
  const impact = describeArrangementImpact(dept, level)
  const title = [impact.sortLine, impact.frequencyLine, impact.timingLine].join('\n')

  return (
    <p className="text-xs text-slate-800" title={title}>
      {impact.summary}
    </p>
  )
}

function DepartmentRow({
  dept,
  hidden,
  onEdit,
}: {
  dept: DepartmentProfile
  hidden: boolean
  onEdit: (trigger: HTMLButtonElement) => void
}) {
  const { level } = calculateRiskLevel(dept.riskOccurrence, dept.riskSeverity)
  const priority = calculateDepartmentPriority(dept)
  const tagged = dept.stakeholders.length >= 1

  return (
    <tr
      className={`${hidden ? 'pagination-hidden-row ' : ''}${tagged ? '' : 'bg-amber-50/50'}`}
      data-stakeholder-dept={dept.id}
    >
      <td className="text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{dept.name}</span>
          {!tagged && <Badge label="待標註" />}
        </div>
      </td>
      <td className="text-xs">{dept.owner || '—'}</td>
      <td >
        {dept.stakeholders.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {dept.stakeholders.map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="text-xs">
        <Badge label={level} />
      </td>
      <td className="text-xs font-semibold">{priority}</td>
      <td >
        <ArrangementImpactSummary dept={dept} level={level} />
      </td>
      <td className="no-print">
        <Button
          variant="secondary"
          icon={ACTION_ICONS.edit}
          aria-label={`編輯 ${dept.name} 利害關係人與風險`}
          onClick={(event) => onEdit(event.currentTarget)}
        >
          編輯
        </Button>
      </td>
    </tr>
  )
}

export function StakeholdersPage({ store }: { store: AuditStore }) {
  const { state, updateDepartment } = store
  const { company } = state
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const editReturnFocusRef = useRef<HTMLButtonElement | null>(null)

  const ranked = useMemo(
    () =>
      [...company.departments].sort(
        (a, b) => calculateDepartmentPriority(b) - calculateDepartmentPriority(a),
      ),
    [company.departments],
  )
  const pagination = useTablePagination(ranked.length)
  const editingDept = editingDeptId
    ? company.departments.find((d) => d.id === editingDeptId) ?? null
    : null
  return (
    <div className="space-y-6">
      <div>
        <ScrollRegion ariaLabel="部門利害關係人一覽">
          <table className="worksheet-table min-w-[48rem]">
            <colgroup>
              <col className="col-name" />
              <col className="col-name" />
              <col />
              <col className="col-status" />
              <col className="col-status" />
              <col />
              <col className="col-action no-print" />
            </colgroup>
            <thead>
              <tr>
                <th >部門</th>
                <th >負責人</th>
                <th >利害關係人</th>
                <th >風險</th>
                <th >優先</th>
                <th >建議安排</th>
                <th className="no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((dept, index) => (
                <DepartmentRow
                  key={dept.id}
                  dept={dept}
                  hidden={!pagination.isVisible(index)}
                  onEdit={(trigger) => {
                    editReturnFocusRef.current = trigger
                    setEditingDeptId(dept.id)
                  }}
                />
              ))}
            </tbody>
          </table>
        </ScrollRegion>
        <TablePagination pagination={pagination} label="利害關係人" />
      </div>
      <StakeholderEditDialog
        open={editingDeptId !== null}
        dept={editingDept}
        onUpdate={(patch) => {
          if (editingDeptId) updateDepartment(editingDeptId, patch)
        }}
        onClose={() => setEditingDeptId(null)}
        returnFocusRef={editReturnFocusRef}
      />
    </div>
  )
}
