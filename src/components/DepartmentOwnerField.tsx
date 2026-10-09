import { useState } from 'react'

import { FOCUS_RING } from '../lib/focusRing'
import type { Person } from '../types'
import { PersonNameSelect } from './ui/PersonNameSelect'

export interface DepartmentOwnerFieldProps {
  departmentId: string
  /** 已儲存於部門主檔的負責人（用於判斷是否需儲存） */
  savedOwner: string
  /** 欄位目前顯示值；未編輯時可與 savedOwner 不同（如查檢表表頭快照） */
  displayOwner?: string
  ariaLabel: string
  onSaveRequest: (departmentId: string, value: string) => void
  candidates?: Person[]
  className?: string
  inputClassName?: string
  selectClassName?: string
}

export function DepartmentOwnerField({
  departmentId,
  savedOwner,
  displayOwner,
  ariaLabel,
  onSaveRequest,
  candidates = [],
  className = '',
  inputClassName = '',
  selectClassName = '',
}: DepartmentOwnerFieldProps) {
  const shown = displayOwner ?? savedOwner
  const sourceKey = JSON.stringify([departmentId, savedOwner, shown])
  const [draftState, setDraftState] = useState<{ sourceKey: string; value: string | null }>(() => ({
    sourceKey,
    value: null,
  }))
  if (draftState.sourceKey !== sourceKey) {
    setDraftState({ sourceKey, value: null })
  }
  const draft = draftState.sourceKey === sourceKey ? draftState.value : null
  const setDraft = (value: string | null) => setDraftState({ sourceKey, value })
  const value = draft ?? shown
  const dirty = value.trim() !== savedOwner.trim()

  const handleSave = () => {
    onSaveRequest(departmentId, value)
  }

  const handleCancel = () => {
    setDraft(null)
  }

  const usePicker = candidates.length > 0

  return (
    <div className={`no-print ${className}`}>
      <div className="flex flex-wrap items-center gap-1">
        {usePicker ? (
          <div className={`min-w-[5rem] flex-1 ${dirty ? 'rounded border border-amber-400' : ''}`}>
            <PersonNameSelect
              value={value}
              onChange={setDraft}
              candidates={candidates}
              ariaLabel={ariaLabel}
              className={inputClassName}
              selectClassName={selectClassName}
            />
          </div>
        ) : (
          <input
            type="text"
            className={`min-w-[5rem] flex-1 rounded border border-line bg-surface px-2 py-1 text-sm ${FOCUS_RING} ${dirty ? 'border-amber-400' : ''} ${inputClassName} ${selectClassName}`}
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty) {
                e.preventDefault()
                handleSave()
              }
              if (e.key === 'Escape') handleCancel()
            }}
            aria-label={ariaLabel}
          />
        )}
        {dirty && (
          <>
            <button
              type="button"
              className={`shrink-0 rounded bg-primary px-2 py-1 text-sm font-bold text-white hover:opacity-90 ${FOCUS_RING}`}
              onClick={handleSave}
            >
              儲存
            </button>
            <button
              type="button"
              className={`shrink-0 rounded border border-line px-2 py-1 text-sm text-muted hover:bg-page ${FOCUS_RING}`}
              onClick={handleCancel}
            >
              取消
            </button>
          </>
        )}
      </div>
      <span className="print-only text-muted">{shown}</span>
    </div>
  )
}
