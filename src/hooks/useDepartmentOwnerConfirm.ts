import { useCallback, useState } from 'react'
import type { AuditStore } from './useAuditStore'
import {
  formatDepartmentOwnerChangeDescription,
  previewDepartmentOwnerChange,
} from '../lib/departmentOwner'

export function useDepartmentOwnerConfirm(store: AuditStore) {
  const { state, updateDepartmentOwner } = store
  const [pending, setPending] = useState<{ deptId: string; newOwner: string } | null>(null)

  const preview = pending
    ? previewDepartmentOwnerChange(
        state,
        pending.deptId,
        pending.newOwner,
        state.settings.scoringRules,
      )
    : null

  const requestChange = useCallback(
    (deptId: string, newOwner: string): boolean => {
      const p = previewDepartmentOwnerChange(
        state,
        deptId,
        newOwner,
        state.settings.scoringRules,
      )
      if (!p || !p.changed) return false
      setPending({ deptId, newOwner: p.newOwner })
      return true
    },
    [state],
  )

  const confirm = useCallback(() => {
    if (!pending) return
    updateDepartmentOwner(pending.deptId, pending.newOwner)
    setPending(null)
  }, [pending, updateDepartmentOwner])

  const cancel = useCallback(() => setPending(null), [])

  const description = preview ? formatDepartmentOwnerChangeDescription(preview) : ''

  return {
    pendingOpen: pending !== null,
    pendingDeptId: pending?.deptId ?? null,
    description,
    requestChange,
    confirm,
    cancel,
  }
}
