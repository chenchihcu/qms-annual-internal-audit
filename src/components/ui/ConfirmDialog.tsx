import { useEffect, useId, useRef } from 'react'
import { Button } from './Badge'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  secondaryLabel?: string
  variant?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
  onSecondary?: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '確認',
  cancelLabel = '取消',
  secondaryLabel,
  variant = 'primary',
  onConfirm,
  onCancel,
  onSecondary,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="關閉對話"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p id={descId} className="mt-2 whitespace-pre-line text-sm text-muted">
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {secondaryLabel && onSecondary && (
            <Button variant="ghost" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
