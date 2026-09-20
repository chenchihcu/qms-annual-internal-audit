import { useMemo, type KeyboardEvent } from 'react'
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
import { calculateRiskLevel } from '../lib/risk'
import type { DepartmentProfile, StakeholderTag } from '../types'
import { STAKEHOLDER_TAGS } from '../types'
import { StakeholderRulesPanel } from './stakeholders/StakeholderRulesPanel'
import { Card } from './ui/Badge'
import { ScrollRegion } from './ui/ScrollRegion'

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

  const moveBand = (band: OsBand, direction: -1 | 1) => {
    const index = OS_BAND_ORDER.indexOf(band)
    const next = OS_BAND_ORDER[index + direction]
    if (next) onChange(osBandToScale(next))
  }

  const handleBandKeyDown = (event: KeyboardEvent<HTMLButtonElement>, band: OsBand) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveBand(band, -1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveBand(band, 1)
    }
  }

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
              tabIndex={selected ? 0 : -1}
              className={`min-h-9 flex-1 rounded border px-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => onChange(osBandToScale(band))}
              onKeyDown={(event) => handleBandKeyDown(event, band)}
            >
              {bandLabel}
            </button>
          )
        })}
      </div>
      <p className="text-xs leading-snug text-slate-500">
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
      <div className="mt-1 space-y-0.5 text-xs leading-snug text-slate-500">
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
    <tr className={`border-t border-slate-100 ${tagged ? '' : 'bg-amber-50/50'}`} data-stakeholder-dept={dept.id}>
      <td className="p-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-900">{dept.name}</p>
          {!tagged && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
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

export function StakeholdersPage({ store }: { store: AuditStore }) {
  const { state, updateDepartment } = store
  const { company } = state

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
        <h2 className="text-sm font-semibold">利害關係人</h2>
        <StakeholderRulesPanel />
      </Card>

      <Card>
        <ScrollRegion ariaLabel="部門利害關係人工作表">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <th className="p-3">部門 · 負責人</th>
              <th className="p-3">利害關係人</th>
              <th className="p-3">發生度</th>
              <th className="p-3">嚴重度</th>
              <th className="p-3">風險與優先</th>
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
        </ScrollRegion>
      </Card>
    </div>
  )
}
