import { useMemo } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import {
  calculateDepartmentPriority,
  describeArrangementImpact,
  OCCURRENCE_BAND_GUIDE,
  OS_BAND_LABELS,
  OS_BAND_ORDER,
  osBandToScale,
  scaleToOsBand,
  SEVERITY_BAND_GUIDE,
  STAKEHOLDER_WEIGHTS,
  type OsBand,
} from '../lib/planner'
import { buildAppHash } from '../lib/navigation'
import { calculateRiskLevel } from '../lib/risk'
import { stakeholdersReady } from '../lib/workflowStatus'
import type { DepartmentProfile, StakeholderTag } from '../types'
import { STAKEHOLDER_TAGS } from '../types'
import { StakeholderRulesPanel } from './stakeholders/StakeholderRulesPanel'
import { Badge, Card } from './ui/Badge'

function OsBandRadios({
  label,
  fieldId,
  value,
  guide,
  onChange,
}: {
  label: string
  fieldId: string
  value: number
  guide: Record<OsBand, string>
  onChange: (value: number) => void
}) {
  const selectedBand = scaleToOsBand(value)

  return (
    <div id={fieldId} className="space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div role="radiogroup" aria-label={`${label}（低／中／高）`} className="flex gap-1">
        {OS_BAND_ORDER.map((band) => {
          const selected = selectedBand === band
          const bandLabel = OS_BAND_LABELS[band]
          const fact = guide[band]
          return (
            <button
              key={band}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${bandLabel}：${fact}`}
              title={fact}
              className={`min-h-9 flex-1 rounded border px-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => onChange(osBandToScale(band))}
            >
              {bandLabel}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] leading-snug text-slate-500">
        {OS_BAND_LABELS[selectedBand]}：{guide[selectedBand]}
      </p>
    </div>
  )
}

function ArrangementImpactSummary({
  dept,
  level,
  expandable = false,
}: {
  dept: DepartmentProfile
  level: '高' | '中' | '低'
  expandable?: boolean
}) {
  const impact = describeArrangementImpact(dept, level)
  const title = [impact.sortLine, impact.frequencyLine, impact.timingLine].join('\n')

  if (!expandable) {
    return (
      <p className="text-xs font-medium text-slate-800" title={title}>
        {impact.summary}
      </p>
    )
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-slate-800" title={title}>
        {impact.summary}
      </summary>
      <div className="mt-1 space-y-0.5 text-[11px] leading-snug text-slate-500">
        <p>{impact.sortLine}</p>
        <p>{impact.frequencyLine}</p>
        <p>{impact.timingLine}</p>
      </div>
    </details>
  )
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
  const tagged = dept.stakeholders.length >= 1

  const toggleTag = (tag: StakeholderTag) => {
    const active = dept.stakeholders.includes(tag)
    const stakeholders = active
      ? dept.stakeholders.filter((s) => s !== tag)
      : [...dept.stakeholders, tag]
    onUpdate({ stakeholders })
  }

  return (
    <tr className={`border-t border-slate-100 ${tagged ? '' : 'bg-amber-50/50'}`}>
      <td className="p-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-900">{dept.name}</p>
          {!tagged && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
              待標註
            </span>
          )}
        </div>
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
        <OsBandRadios
          label="發生度"
          fieldId={`${dept.id}-o`}
          value={dept.riskOccurrence}
          guide={OCCURRENCE_BAND_GUIDE}
          onChange={(n) => onUpdate({ riskOccurrence: n })}
        />
      </td>
      <td className="p-3 align-top">
        <OsBandRadios
          label="嚴重度"
          fieldId={`${dept.id}-s`}
          value={dept.riskSeverity}
          guide={SEVERITY_BAND_GUIDE}
          onChange={(n) => onUpdate({ riskSeverity: n })}
        />
      </td>
      <td className="p-3 align-top text-sm text-slate-800">
        <p className="font-medium">RPN {index} · {level} · 優先 {priority}</p>
      </td>
      <td className="p-3 align-top">
        <ArrangementImpactSummary dept={dept} level={level} expandable />
      </td>
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
  const tagged = dept.stakeholders.length >= 1

  const toggleTag = (tag: StakeholderTag) => {
    const active = dept.stakeholders.includes(tag)
    const stakeholders = active
      ? dept.stakeholders.filter((s) => s !== tag)
      : [...dept.stakeholders, tag]
    onUpdate({ stakeholders })
  }

  return (
    <details
      className={`rounded-lg border bg-white ${tagged ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'}`}
      data-stakeholder-dept={dept.id}
    >
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
            {!tagged && <p className="mt-1 text-xs text-amber-700">待標註</p>}
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
          <OsBandRadios
            label="發生度（低／中／高）"
            fieldId={`${dept.id}-o-mobile`}
            value={dept.riskOccurrence}
            guide={OCCURRENCE_BAND_GUIDE}
            onChange={(n) => onUpdate({ riskOccurrence: n })}
          />
          <OsBandRadios
            label="嚴重度（低／中／高）"
            fieldId={`${dept.id}-s-mobile`}
            value={dept.riskSeverity}
            guide={SEVERITY_BAND_GUIDE}
            onChange={(n) => onUpdate({ riskSeverity: n })}
          />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-1 text-xs text-slate-600">
          <span>RPN {index} ·</span>
          <ArrangementImpactSummary dept={dept} level={level} />
        </div>
      </div>
    </details>
  )
}

export function StakeholdersPage({ store }: { store: AuditStore }) {
  const { state, updateDepartment } = store
  const { company } = state
  const hasScheduledMonths = company.planRows.some((row) => row.months.some(Boolean))
  const taggedCount = company.departments.filter((d) => d.stakeholders.length >= 1).length
  const untaggedDepts = company.departments.filter((d) => d.stakeholders.length < 1)
  const ready = stakeholdersReady(state)

  const ranked = useMemo(
    () =>
      [...company.departments].sort(
        (a, b) => calculateDepartmentPriority(b) - calculateDepartmentPriority(a),
      ),
    [company.departments],
  )

  const pendingLabel = (() => {
    if (untaggedDepts.length === 0) return null
    const names = untaggedDepts.slice(0, 3).map((d) => d.name)
    const rest = untaggedDepts.length - names.length
    return rest > 0 ? `${names.join('、')} 等 ${untaggedDepts.length} 部門` : names.join('、')
  })()

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold">部門利害關係人與優先權</h2>
        <p className="mt-1 text-sm text-slate-600">
          標定各部門利害關係人與部門風險，供自動編排用（<strong>不是</strong> QR-02-01）。
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>每個部門至少勾一個「誰在乎」。</li>
          <li>發生度、嚴重度各選一檔事實（低／中／高），不要想分數。</li>
          <li>
            優先分數由系統算；O／S <strong>不影響本頁完成</strong>，但會影響編排估算。已手動覆寫的月格不會被這頁改掉。
          </li>
        </ol>
        <p className="mt-3 text-sm text-slate-600">
          資料流：
          <span className="font-medium text-slate-800"> 利害關係人（部門）</span>
          {' → '}
          <a className="font-medium text-blue-700 underline" href={buildAppHash('risk')}>
            方案風險（QP／QR-02-01）
          </a>
          {' → '}
          <a className="font-medium text-blue-700 underline" href={buildAppHash('plan')}>
            年度計畫（QR-28-01）
          </a>
        </p>
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-semibold">{taggedCount}/{company.departments.length}</span> 部門已標註利害關係人
          {pendingLabel && (
            <span className="text-amber-800"> · 尚待：{pendingLabel}</span>
          )}
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
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-sm no-print ${
            ready
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {ready ? (
            <>
              已完成本頁終點。
              <a className="ml-2 font-medium text-blue-700 underline" href={buildAppHash('risk')}>
                前往方案風險與優先順序
              </a>
            </>
          ) : (
            <span>尚待完成：{pendingLabel ?? '請標註各部門利害關係人'}</span>
          )}
        </div>
        <StakeholderRulesPanel />
        {hasScheduledMonths && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            變更只影響下次「預覽自動編排」；已手動覆寫（manualOverride）的計畫列會保留。
          </p>
        )}
      </Card>

      <Card className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <th className="p-3">部門 · 負責人</th>
              <th className="p-3">利害關係人</th>
              <th className="p-3">發生度</th>
              <th className="p-3">嚴重度</th>
              <th className="p-3">風險與優先</th>
              <th className="p-3">
                編排影響
                <span className="mt-0.5 block font-normal text-slate-500">本部門 QP · 順序／次數／早晚</span>
              </th>
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
