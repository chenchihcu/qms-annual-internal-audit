import { ConfirmDialog } from './ConfirmDialog'

export interface TrashDeleteTarget {
  id: string
  label: string
}

export function MoveToTrashDialog({
  target,
  onConfirm,
  onCancel,
}: {
  target: TrashDeleteTarget | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmDialog
      open={target !== null}
      title="移至回收區？"
      description={target ? `${target.label}\n\n資料可在系統設定的回收區還原。` : ''}
      confirmLabel="移入回收區"
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
