import { useState, type ChangeEvent } from 'react'

export function MigrationGate({
  downloadRequested,
  backupConfirmed,
  warning,
  onDownload,
  onVerifyBackup,
  onContinue,
}: {
  downloadRequested: boolean
  backupConfirmed: boolean
  warning: string | null
  onDownload: () => boolean
  onVerifyBackup: (file: File) => Promise<boolean>
  onContinue: () => boolean
}) {
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verifying, setVerifying] = useState(false)

  const handleDownload = () => {
    const started = onDownload()
    setVerificationMessage(started ? '已啟動備份下載。請確認 JSON 已保存，再選取該檔案進行比對。' : '')
  }

  const handleBackupSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setVerificationMessage('正在確認備份檔…')
    setVerifying(true)
    try {
      const verified = await onVerifyBackup(file)
      setVerificationMessage(verified
        ? '備份檔驗證通過，可以套用升級。'
        : '備份檔與目前原始資料不一致，請重新下載並選取該檔案。')
    } catch {
      setVerificationMessage('無法讀取備份檔，請重新下載並選取有效的 JSON 檔。')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-line bg-surface p-6" aria-labelledby="migration-title">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">資料格式升級</p>
      <h1 id="migration-title" className="mt-2 text-xl font-bold text-ink">先備份，再整理為單一稽核工作區</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        系統會把原本分開的稽核資料合併成一份。資料不一致的欄位會列入待覆核，查檢判定衝突會先暫停計分。
        選取的備份檔與目前原始資料一致前，系統不會改寫原始資料。
      </p>
      <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <li className={`rounded-lg border p-3 ${backupConfirmed ? 'border-green-300 bg-green-50 text-green-900' : 'border-line bg-page text-ink'}`}>
          <span className="block font-semibold">1. 下載並驗證備份</span>
          <span className="mt-1 block text-xs">下載並保存 JSON 後選取該檔；系統會比對完整內容。</span>
        </li>
        <li className={`rounded-lg border p-3 ${backupConfirmed ? 'border-line bg-page text-ink' : 'border-line bg-slate-50 text-muted'}`}>
          <span className="block font-semibold">2. 驗證並套用新格式</span>
          <span className="mt-1 block text-xs">寫入後會讀回檢查；原始資料不會刪除。</span>
        </li>
      </ol>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          disabled={verifying}
          onClick={handleDownload}
        >
          {downloadRequested ? '重新下載原始備份' : '下載原始備份'}
        </button>
        <label className={`flex min-h-11 max-w-full flex-col justify-center gap-1 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink ${downloadRequested && !verifying ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed opacity-50'}`}>
          <span>選取備份檔</span>
          <input
            type="file"
            accept=".json,application/json"
            aria-label="選取遷移前原始備份 JSON"
            className="block max-w-full cursor-pointer text-xs font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            disabled={!downloadRequested || verifying}
            onChange={handleBackupSelection}
          />
        </label>
        <button
          type="button"
          className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          disabled={!backupConfirmed || verifying}
          onClick={onContinue}
        >
          驗證並套用升級
        </button>
      </div>
      {downloadRequested && (
        <p role="status" aria-live="polite" className="mt-4 text-sm text-muted">
          {verificationMessage || (backupConfirmed ? '備份檔驗證通過。' : '請選取已保存的 JSON；系統會確認內容與目前原始資料完全一致。')}
        </p>
      )}
      {warning && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{warning}</p>}
    </section>
  )
}
