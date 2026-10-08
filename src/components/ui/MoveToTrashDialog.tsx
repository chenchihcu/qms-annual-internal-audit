import { ConfirmDialog } from './ConfirmDialog'

export interface TrashDeleteTarget {
  id: string
  label: string
}

export function MoveToTrashDialog({
  target,
  onConfirm,
  onCancel,
  title = '移至回收區？',
  confirmLabel = '移入回收區',
  descriptionSuffix = '資料可在系統設定的回收區還原。',
}: {
  target: TrashDeleteTarget | null
  onConfirm: () => void
  onCancel: () => void
  title?: string
  confirmLabel?: string
  descriptionSuffix?: string
}) {
  return (
    <ConfirmDialog
      open={target !== null}
      title={title}
      description={target ? `${target.label}\n\n${descriptionSuffix}` : ''}
      confirmLabel={confirmLabel}
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
