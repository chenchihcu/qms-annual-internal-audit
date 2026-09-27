interface DemoBannerProps {
  onDismiss?: () => void
}

export function DemoBanner({ onDismiss }: DemoBannerProps) {
  return (
    <div
      role="status"
      className="mb-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">範示資料</p>
          <p className="mt-1 text-sky-900/90 dark:text-sky-100/90">
            目前載入的是示範用稽核紀錄（含 2026 年範例人員與分數），可直接試用各功能；正式使用前請至「系統設定」匯入或建立稽核資料。
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md border border-sky-400 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-sky-600 dark:bg-sky-900 dark:text-sky-100 dark:hover:bg-sky-800"
          >
            了解，開始編輯
          </button>
        )}
      </div>
    </div>
  )
}
