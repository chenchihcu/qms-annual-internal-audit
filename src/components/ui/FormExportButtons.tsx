import { useState } from 'react'
import type { FormExportId } from '../../lib/formExport'
import { downloadFormExcel, downloadFormPdf } from '../../lib/formExport'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

interface FormExportButtonsProps {
  formId: FormExportId
  filenameBase: string
  onExportExcel: () => Uint8Array
  onExportPdf: () => Promise<Uint8Array>
  className?: string
}

export function FormExportButtons({
  formId,
  filenameBase,
  onExportExcel,
  onExportPdf,
  className = '',
}: FormExportButtonsProps) {
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExcel = () => {
    setError(null)
    setBusy('excel')
    try {
      const data = onExportExcel()
      if (!data?.length) {
        throw new Error('匯出失敗：產生的 Excel 檔案為空')
      }
      downloadFormExcel(data, filenameBase)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handlePdf = async () => {
    setError(null)
    setBusy('pdf')
    try {
      const data = await onExportPdf()
      if (!data?.length) {
        throw new Error('匯出失敗：產生的 PDF 檔案為空')
      }
      downloadFormPdf(data, filenameBase)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          aria-label={`${formId} 匯出 Excel`}
          className={`no-print rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page disabled:opacity-50 ${FOCUS_RING}`}
          onClick={handleExcel}
        >
          {busy === 'excel' ? '匯出中…' : '匯出 Excel'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          aria-label={`${formId} 匯出 PDF`}
          className={`no-print rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-page disabled:opacity-50 ${FOCUS_RING}`}
          onClick={() => void handlePdf()}
        >
          {busy === 'pdf' ? '匯出中…' : '匯出 PDF'}
        </button>
      </div>
      {error && (
        <p className="no-print text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
