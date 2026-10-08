import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { buildYearSwitchDescription, parseAuditYearDraft } from '../lib/auditYearSwitch'
import { getPdcaOverview } from '../lib/workflowStatus'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useNcrUnsavedGuardActions } from '../context/NcrUnsavedGuardContext'

interface AuditYearSwitcherProps {
  store: AuditStore
  compact?: boolean
  hideLabel?: boolean
  inputAriaLabel?: string
}

export function AuditYearSwitcher({ store, compact = false, hideLabel = false, inputAriaLabel = '內稽年度' }: AuditYearSwitcherProps) {
  const { state, switchAuditYear } = store
  const { settings } = state
  const { confirmIfUnsaved, peekUnsaved } = useNcrUnsavedGuardActions()
  const [yearOverride, setYearOverride] = useState<string | null>(null)
  const [pendingYear, setPendingYear] = useState<number | null>(null)
  const yearDraft = yearOverride ?? String(settings.auditYear)

  const handleYearDraftChange = (value: string) => {
    setYearOverride(value)
    const year = parseAuditYearDraft(value, settings.auditYear)
    if (year == null) {
      if (Number(value) === settings.auditYear) setYearOverride(null)
      return
    }
    setPendingYear(year)
  }

  const confirmYearSwitch = () => {
    if (pendingYear == null) return
    if (!confirmIfUnsaved()) return
    switchAuditYear(pendingYear)
    setPendingYear(null)
    setYearOverride(null)
  }

  const cancelYearSwitch = () => {
    setPendingYear(null)
    setYearOverride(null)
  }

  const yearInput = (
    <input
      type="number"
      className={`rounded border border-slate-300 bg-surface px-2 py-1 text-sm font-medium text-ink ${compact ? 'w-20' : 'w-24'}`}
      value={yearDraft}
      aria-label={inputAriaLabel}
      onChange={(event) => handleYearDraftChange(event.target.value)}
    />
  )

  return (
    <>
      {hideLabel ? yearInput : (
        <label className={`flex items-center gap-2 text-sm text-slate-600 ${compact ? '' : 'rounded-lg border border-line px-3 py-2'}`}>
          <span className="text-sm">內稽年度</span>
          {yearInput}
        </label>
      )}
      {pendingYear != null && (
        <ConfirmDialog
          open
          title={`切換至 ${pendingYear} 年？`}
          description={`${buildYearSwitchDescription(state, pendingYear)}${peekUnsaved() ? '\n\nQR-28-03 報告有未存檔變更；切換年度將捨棄未存檔內容。' : ''}`}
          confirmLabel="確認切換"
          variant={getPdcaOverview(state).annualCloseReady ? 'primary' : 'danger'}
          onConfirm={confirmYearSwitch}
          onCancel={cancelYearSwitch}
        />
      )}
    </>
  )
}
