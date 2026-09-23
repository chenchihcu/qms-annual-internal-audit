import type { useDepartmentOwnerConfirm } from '../hooks/useDepartmentOwnerConfirm'
import { ConfirmDialog } from './ui/ConfirmDialog'

type OwnerConfirm = ReturnType<typeof useDepartmentOwnerConfirm>

export function DepartmentOwnerConfirm({ ownerConfirm }: { ownerConfirm: OwnerConfirm }) {
  return (
    <ConfirmDialog
      open={ownerConfirm.pendingOpen}
      title="儲存部門負責人"
      description={ownerConfirm.description}
      confirmLabel="確認儲存"
      onConfirm={() => ownerConfirm.confirm()}
      onCancel={() => ownerConfirm.cancel()}
    />
  )
}
