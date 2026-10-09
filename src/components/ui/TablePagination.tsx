import type { TablePaginationState } from '../../hooks/useTablePagination'

const PAGE_SIZES = [10, 20, 50] as const

function visiblePages(page: number, pageCount: number): Array<number | 'start-gap' | 'end-gap'> {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  const pages: Array<number | 'start-gap' | 'end-gap'> = [1]
  if (start > 2) pages.push('start-gap')
  for (let value = start; value <= end; value += 1) pages.push(value)
  if (end < pageCount - 1) pages.push('end-gap')
  pages.push(pageCount)
  return pages
}

export function TablePagination({
  pagination,
  label,
}: {
  pagination: TablePaginationState
  label: string
}) {
  if (pagination.itemCount <= PAGE_SIZES[0]) return null

  const pages = visiblePages(pagination.page, pagination.pageCount)
  const shownStart = pagination.startIndex + 1
  const shownEnd = pagination.endIndex

  return (
    <nav
      className="no-print mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"
      aria-label={`${label}分頁`}
    >
      <p className="text-slate-600" aria-live="polite">
        顯示 {shownStart}–{shownEnd} 筆，共 {pagination.itemCount} 筆
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="mr-1 flex items-center gap-1.5 text-slate-600">
          每頁
          <select
            aria-label={`${label}每頁筆數`}
            value={pagination.pageSize}
            onChange={(event) => pagination.setPageSize(Number(event.target.value))}
            className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} 筆</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={pagination.page === 1}
          onClick={() => pagination.setPage(pagination.page - 1)}
          className="min-h-9 rounded-md border border-slate-300 px-2.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label={`${label}上一頁`}
        >
          上一頁
        </button>
        {pages.map((page) => page === 'start-gap' || page === 'end-gap' ? (
          <span key={page} className="px-1 text-slate-500" aria-hidden="true">…</span>
        ) : (
          <button
            key={page}
            type="button"
            aria-label={`${label}第 ${page} 頁`}
            aria-current={page === pagination.page ? 'page' : undefined}
            onClick={() => pagination.setPage(page)}
            className={`min-h-9 min-w-9 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${page === pagination.page ? 'border-blue-700 bg-blue-700 font-bold text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          disabled={pagination.page === pagination.pageCount}
          onClick={() => pagination.setPage(pagination.page + 1)}
          className="min-h-9 rounded-md border border-slate-300 px-2.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label={`${label}下一頁`}
        >
          下一頁
        </button>
      </div>
    </nav>
  )
}
