import { useState } from 'react'

export interface TablePaginationState {
  itemCount: number
  page: number
  pageSize: number
  pageCount: number
  startIndex: number
  endIndex: number
  isVisible: (index: number) => boolean
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

const PAGE_SIZES = [10, 20, 50] as const

export function useTablePagination(
  itemCount: number,
  initialPageSize = 10,
  requestedItem?: { key: string; index: number },
  resetKey = 'default',
): TablePaginationState {
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [pageState, setPageState] = useState<{ key?: string; page: number; resetKey: string }>(() => ({
    page: 1,
    resetKey,
  }))
  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize))
  const requestedPage = requestedItem ? Math.floor(requestedItem.index / pageSize) + 1 : undefined
  const requestChanged = Boolean(requestedItem && requestedItem.key !== pageState.key)
  const resetChanged = resetKey !== pageState.resetKey
  const requestedOrResetPage = requestedItem ? requestedPage ?? 1 : 1
  const desiredPage = resetChanged
    ? requestedOrResetPage
    : requestChanged
      ? requestedPage ?? 1
      : pageState.page
  const page = Math.max(1, Math.min(desiredPage, pageCount))
  const startIndex = (page - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, itemCount)

  return {
    itemCount,
    page,
    pageSize,
    pageCount,
    startIndex,
    endIndex,
    isVisible: (index) => index >= startIndex && index < endIndex,
    setPage: (nextPage) => setPageState({
      key: requestedItem?.key,
      resetKey,
      page: Math.max(1, Math.min(nextPage, pageCount)),
    }),
    setPageSize: (size) => {
      if (!PAGE_SIZES.includes(size as (typeof PAGE_SIZES)[number])) return
      setPageSizeState(size)
      setPageState({ key: requestedItem?.key, resetKey, page: 1 })
    },
  }
}
