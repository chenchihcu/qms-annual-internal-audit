import { useEffect, useId, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  calculateDepartmentPriority,
  describeArrangementImpact,
  OCCURRENCE_BAND_GUIDE,
  SEVERITY_BAND_GUIDE,
} from '../../lib/planner'
import { calculateRiskLevel } from '../../lib/risk'
import type { DepartmentProfile, StakeholderTag } from '../../types'
import { STAKEHOLDER_TAGS } from '../../types'
import { Button } from '../ui/Badge'
import { OsBandRadios } from './OsBandRadios'

export type StakeholderDeptPatch = Partial<
  Pick<DepartmentProfile, 'stakeholders' | 'riskOccurrence' | 'riskSeverity'>
>

export interface StakeholderEditDialogProps {
  open: boolean
  dept: DepartmentProfile | null
  onUpdate: (patch: StakeholderDeptPatch) => void
  onClose: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function StakeholderEditDialog({
  open,
  dept,
  onUpdate,
  onClose,
  returnFocusRef,
}: StakeholderEditDialogProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeHandlerRef = useRef(onClose)

  useEffect(() => {
    closeHandlerRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open || !dept) return
    const returnTarget = returnFocusRef?.current
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const appRoot = document.getElementById('root')
    const wasInert = appRoot?.inert ?? false
    const previousOverflow = document.body.style.overflow
    if (appRoot) appRoot.inert = true
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeHandlerRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )
      if (!controls?.length) {
        e.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (appRoot) appRoot.inert = wasInert
      document.body.style.overflow = previousOverflow
      if (returnTarget?.isConnected) returnTarget.focus()
      else if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open, dept, returnFocusRef])

  if (!open || !dept) return null

  const { index, level } = calculateRiskLevel(dept.riskOccurrence, dept.riskSeverity)
  const priority = calculateDepartmentPriority(dept)
  const impact = describeArrangementImpact(dept, level)

  const toggleTag = (tag: StakeholderTag) => {
    const active = dept.stakeholders.includes(tag)
    const stakeholders = active
      ? dept.stakeholders.filter((s) => s !== tag)
      : [...dept.stakeholders, tag]
    onUpdate({ stakeholders })
  }

  return createPortal(
    (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="關閉對話"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={dialogRef}
          tabIndex={-1}
          className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col rounded-xl border border-line bg-surface shadow-lg"
        >
          <div className="shrink-0 border-b border-line p-5 pb-3">
            <h2 id={titleId} className="text-sm font-bold text-ink">
              {dept.name}
            </h2>
            <p className="mt-1 text-sm text-muted">負責人：{dept.owner}</p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <p className="text-sm font-bold text-muted">利害關係人</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {STAKEHOLDER_TAGS.map((tag) => {
                  const active = dept.stakeholders.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? 'border-primary bg-row-selected text-tone-info-fg'
                          : 'border-line text-muted hover:border-line'
                      }`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
            <OsBandRadios
              label="發生度"
              fieldId={`${dept.id}-o`}
              value={dept.riskOccurrence}
              guide={OCCURRENCE_BAND_GUIDE}
              onChange={(n) => onUpdate({ riskOccurrence: n })}
            />
            <OsBandRadios
              label="嚴重度"
              fieldId={`${dept.id}-s`}
              value={dept.riskSeverity}
              guide={SEVERITY_BAND_GUIDE}
              onChange={(n) => onUpdate({ riskSeverity: n })}
            />
            <div className="rounded-lg border border-line bg-page p-3 text-sm text-ink">
              <p className="font-bold">RPN {index} · {level} · 優先 {priority}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                <li>{impact.sortLine}</li>
                <li>{impact.frequencyLine}</li>
                <li>{impact.timingLine}</li>
              </ul>
            </div>
          </div>
          <div className="shrink-0 flex justify-end border-t border-line p-4">
            <Button ref={closeRef} variant="secondary" onClick={onClose}>
              關閉
            </Button>
          </div>
        </div>
      </div>
    ),
    document.body,
  )
}
