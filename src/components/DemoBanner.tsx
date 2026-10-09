interface DemoBannerProps {
  onDismiss?: () => void
}

export function DemoBanner({ onDismiss }: DemoBannerProps) {
  return (
    <div
      role="status"
      className="mb-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">示範資料</p>
          <p className="mt-1 text-sky-900/90">
            目前載入的是示範用稽核紀錄（含 2026 年範例人員與分數），可直接試用各功能；正式使用前請至「系統設定」匯入或建立稽核資料。
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md border border-sky-400 bg-white px-3 py-1.5 text-sm font-bold text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            了解，開始編輯
          </button>
        )}
      </div>
    </div>
  )
}
