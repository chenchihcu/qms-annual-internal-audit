import { useRef, useState } from 'react'
import type { EvidenceAttachment } from '../../types'
import {
  canAddAttachment,
  formatAttachmentNamesForPrint,
  readFileAsAttachment,
} from '../../lib/attachments'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

interface AttachmentFieldProps {
  attachments: EvidenceAttachment[]
  onChange: (attachments: EvidenceAttachment[]) => void
  disabled?: boolean
  label?: string
}

export function AttachmentField({
  attachments,
  onChange,
  disabled = false,
  label = '佐證附件',
}: AttachmentFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return
    let next = [...attachments]
    for (const file of files) {
      const slot = canAddAttachment(next)
      if (!slot.ok) {
        setError(slot.error ?? '無法新增附件')
        break
      }
      const result = await readFileAsAttachment(file)
      if (result.error) {
        setError(result.error)
        continue
      }
      if (result.attachment) {
        next = [...next, result.attachment]
        setError(null)
      }
    }
    onChange(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="mt-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {!disabled && (
          <button
            type="button"
            className={`text-xs text-primary hover:underline no-print ${FOCUS_RING}`}
            onClick={() => fileRef.current?.click()}
          >
            新增附件
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {attachments.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex flex-wrap items-center gap-2 rounded border border-line bg-page/50 px-2 py-1"
            >
              <span className="font-medium text-ink">{att.fileName}</span>
              <span className="text-muted">({Math.round(att.sizeBytes / 1024)} KB)</span>
              {!disabled && (
                <button
                  type="button"
                  className={`text-red-600 hover:underline no-print ${FOCUS_RING}`}
                  onClick={() => onChange(attachments.filter((a) => a.id !== att.id))}
                >
                  移除
                </button>
              )}
              {att.dataUrl.startsWith('data:') && (
                <a
                  href={att.dataUrl}
                  download={att.fileName}
                  className={`text-primary hover:underline no-print ${FOCUS_RING}`}
                >
                  下載
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">尚無附件</p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {attachments.length > 0 && (
        <p className="print-only mt-1 text-xs">
          附件：{formatAttachmentNamesForPrint(attachments)}
        </p>
      )}
    </div>
  )
}
