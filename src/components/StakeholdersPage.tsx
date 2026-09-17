import { useMemo } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { calculateDepartmentPriority, STAKEHOLDER_WEIGHTS } from '../lib/planner'
import { calculateRiskLevel } from '../lib/risk'
import type { DepartmentProfile, StakeholderTag } from '../types'
import { STAKEHOLDER_TAGS } from '../types'
import { Badge, Card } from './ui/Badge'

function ScaleOneToFive({
  label,
  fieldId,
  value,
  onChange,
}: {
  label: string
  fieldId: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div id={fieldId} className="space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div role="radiogroup" aria-label={`${label}（1–5）`} className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={String(n)}
              className={`min-h-9 min-w-8 flex-1 rounded border text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function arrangementHint(dept: DepartmentProfile, level: string): string {
  const parts: string[] = []
  if (dept.stakeholders.some((s) => s === '客戶' || s === '法規/認證')) {
    parts.push('含客戶／法規 · 傾向較早')
  }
  if (level === '高') parts.push('高風險 · 較密')
  else if (level === '中') parts.push('中風險')
  return parts.join(' · ') || '一般排程'
}

function DepartmentRow({
  dept,
  onUpdate,
}: {
  dept: DepartmentProfile
  onUpdate: (patch: Partial<Pick<DepartmentProfile, 'stakeholders' | 'riskOccurrence' | 'riskSeverity'>>) => void
}) {
  const { index, level } = calculateRiskLevel(dept.riskOccurrence, dept.riskSeverity)
  const priority = calculateDepartmentPriority(dept)
  const hint = arrangementHint(dept, level)

  const toggleTag = (tag: StakeholderTag) => {
    const active = dept.stakeholders.includes(tag)
    const stakeholders = active
      ? dept.stakeholders.filter((s) => s !== tag)
      : [...dept.stakeholders, tag]
    onUpdate({ stakeholders })
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="p-3 align-top">
        <p className="font-medium text-slate-900">{dept.name}</p>
        <p className="text-xs text-slate-500">負責人：{dept.owner}</p>
      </td>
      <td className="p-3 align-top">
        <div className="flex flex-wrap gap-1.5">
          {STAKEHOLDER_TAGS.map((tag) => {
            const active = dept.stakeholders.includes(tag)
            const weight = STAKEHOLDER_WEIGHTS[tag] ?? 0
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
                onClick={() => toggleTag(tag)}
              >
                {tag} · {weight}
              </button>
            )
          })}
        </div>
      </td>
      <td className="p-3 align-top">
        <ScaleOneToFive
          label="發生度 O"
          fieldId={`${dept.id}-o`}
          value={dept.riskOccurrence}
          onChange={(n) => onUpdate({ riskOccurrence: n })}
        />
      </td>
      <td className="p-3 align-top">
        <ScaleOneToFive
          label="嚴重度 S"
          fieldId={`${dept.id}-s`}
          value={dept.riskSeverity}
          onChange={(n) => onUpdate({ riskSeverity: n })}
        />
      </td>
      <td className="p-3 align-top text-center text-sm font-medium">{index}</td>
      <td className="p-3 align-top">
        <Badge label={level} />
      </td>
      <td className="p-3 align-top text-sm font-semibold text-slate-900">{priority}</td>
      <td className="p-3 align-top text-xs text-slate-600">{hint}</td>
    </tr>
  )
}

function DepartmentCard({
  dept,
  rank,
  onUpdate,
}: {
  dept: DepartmentProfile
  rank: number
  onUpdate: (patch: Partial<Pick<DepartmentProfile, 'stakeholders' | 'riskOccurrence' | 'riskSeverity'>>) => void
}) {
  const { index, level } = calculateRiskLevel(dept.riskOccurrence, dept.riskSeverity)
  const priority = calculateDepartmentPriority(dept)
  const hint = arrangementHint(dept, level)
  const tagged = dept.stakeholders.length >= 1

  const toggleTag = (tag: StakeholderTag) => {
    const active = dept.stakeholders.includes(tag)
    const stakeholders = active
      ? dept.stakeholders.filter((s) => s !== tag)
      : [...dept.stakeholders, tag]
    onUpdate({ stakeholders })
  }

  return (
    <details className="rounded-lg border border-slate-200 bg-white" data-stakeholder-dept={dept.id}>
      <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-400">#{rank}</span>
            <p className="font-medium text-slate-900">{dept.name}</p>
            <p className="text-xs text-slate-500">負責人：{dept.owner}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">優先 {priority}</p>
            <Badge label={level} />
            {!tagged && <p className="mt-1 text-xs text-amber-700">尚未標註</p>}
          </div>
        </div>
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-4">
        <div className="flex flex-wrap gap-1.5">
          {STAKEHOLDER_TAGS.map((tag) => {
            const active = dept.stakeholders.includes(tag)
            const weight = STAKEHOLDER_WEIGHTS[tag] ?? 0
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  active ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500'
                }`}
                onClick={() => toggleTag(tag)}
              >
                {tag} · {weight}
              </button>
            )
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScaleOneToFive
            label="發生度 O（1–5）"
            fieldId={`${dept.id}-o-mobile`}
            value={dept.riskOccurrence}
            onChange={(n) => onUpdate({ riskOccurrence: n })}
          />
          <ScaleOneToFive
            label="嚴重度 S（1–5）"
            fieldId={`${dept.id}-s-mobile`}
            value={dept.riskSeverity}
            onChange={(n) => onUpdate({ riskSeverity: n })}
          />
        </div>
        <p className="text-xs text-slate-600">
          RPN {index} · {hint}
        </p>
      </div>
    </details>
  )
}

export function StakeholdersPage({ store }: { store: AuditStore }) {
  const { state, updateDepartment } = store
  const { company } = state
  const hasScheduledMonths = company.planRows.some((row) => row.months.some(Boolean))
  const taggedCount = company.departments.filter((d) => d.stakeholders.length >= 1).length

  const ranked = useMemo(
    () =>
      [...company.departments].sort(
        (a, b) => calculateDepartmentPriority(b) - calculateDepartmentPriority(a),
      ),
    [company.departments],
  )

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold">部門利害關係人與優先權</h2>
        <p className="mt-1 text-sm text-slate-600">
          優先分數 = Σ(標籤權重)×2 + O×S。此為自動編排輸入，<strong>不是</strong> QR-02-01 方案風險。
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {STAKEHOLDER_TAGS.map((tag) => (
            <div key={tag}>
              <dt className="inline font-medium">{tag}</dt>
              <dd className="inline">：{STAKEHOLDER_WEIGHTS[tag] ?? 0}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-semibold">{taggedCount}/{company.departments.length}</span> 部門已標註利害關係人
        </p>
        {ranked.length > 0 && (
          <ol className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            {ranked.slice(0, 6).map((dept, i) => (
              <li key={dept.id} className="rounded-full border border-slate-200 px-2.5 py-1">
                {i + 1}. {dept.name}（{calculateDepartmentPriority(dept)}）
              </li>
            ))}
          </ol>
        )}
        {hasScheduledMonths && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            變更只影響下次「預覽自動編排」；已手動覆寫（manualOverride）的計畫列會保留。
          </p>
        )}
      </Card>

      <Card className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <th className="p-3">部門 · 負責人</th>
              <th className="p-3">利害關係人</th>
              <th className="p-3">O</th>
              <th className="p-3">S</th>
              <th className="p-3 text-center">RPN</th>
              <th className="p-3">等級</th>
              <th className="p-3">優先分數</th>
              <th className="p-3">編排影響</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((dept) => (
              <DepartmentRow
                key={dept.id}
                dept={dept}
                onUpdate={(patch) => updateDepartment(dept.id, patch)}
              />
            ))}
          </tbody>
        </table>
      </Card>

      <div className="space-y-3 lg:hidden">
        {ranked.map((dept, i) => (
          <DepartmentCard
            key={dept.id}
            dept={dept}
            rank={i + 1}
            onUpdate={(patch) => updateDepartment(dept.id, patch)}
          />
        ))}
      </div>
    </div>
  )
}
