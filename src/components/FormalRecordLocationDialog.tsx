import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input } from './ui/Badge'
import { ACTION_ICONS } from '../lib/uiIcons'

export interface FormalRecordLocationDialogProps {
  open: boolean
  currentLocation?: string
  title?: string
  description?: string
  onConfirm: (location: string) => void
  onCancel: () => void
}

const QUICK_LOCATION_PRESETS = [
  '文管中心受控檔案室／品保部',
  '品保部受控檔案夾',
  '\\\\公司NAS\\品質保證\\內部稽核紀錄',
]

export function FormalRecordLocationDialog({
  open,
  currentLocation = '',
  title = '指定正式紀錄保存位置',
  description = '本系統為本機輔助工具；正式稽核紀錄（QR-28-02 查檢表與報告）須歸檔至組織受控位置。請指定或選取正式紀錄保存路徑：',
  onConfirm,
  onCancel,
}: FormalRecordLocationDialogProps) {
  const [draft, setDraft] = useState(currentLocation)
  const [error, setError] = useState('')
  const [previousProps, setPreviousProps] = useState({ open, currentLocation })
  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const cancelHandlerRef = useRef(onCancel)

  if (previousProps.open !== open || previousProps.currentLocation !== currentLocation) {
    setPreviousProps({ open, currentLocation })
    if (open) {
      setDraft(currentLocation)
      setError('')
    }
  }

  useEffect(() => {
    cancelHandlerRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const appRoot = document.getElementById('root')
    const wasInert = appRoot?.inert ?? false
    const previousOverflow = document.body.style.overflow
    if (appRoot) appRoot.inert = true
    document.body.style.overflow = 'hidden'

    cancelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelHandlerRef.current()
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
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  const handleSave = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('請輸入或選取正式紀錄保存位置')
      return
    }
    setError('')
    onConfirm(trimmed)
  }

  return createPortal(
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-sm font-semibold text-slate-900">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm text-slate-600">
          {description}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1.5">快速代入常用位置：</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_LOCATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDraft(preset)
                    setError('')
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs transition ${
                    draft === preset
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="正式紀錄保存位置"
            value={draft}
            error={error}
            hint="例如：文管中心受控檔案室／品保部 或 \\NAS路徑"
            onChange={(val) => {
              setDraft(val)
              if (error) setError('')
            }}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button icon={ACTION_ICONS.backup} onClick={handleSave}>
            確認儲存
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
