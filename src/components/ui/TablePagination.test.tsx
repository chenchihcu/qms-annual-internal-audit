import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTablePagination } from '../../hooks/useTablePagination'
import { TablePagination } from './TablePagination'

function PaginatedRows({ targetIndex, resetKey = 'default' }: { targetIndex?: number; resetKey?: string }) {
  const items = Array.from({ length: 13 }, (_, index) => `資料 ${index + 1}`)
  const pagination = useTablePagination(
    items.length,
    10,
    targetIndex == null ? undefined : { key: `record-${targetIndex}`, index: targetIndex },
    resetKey,
  )

  return (
    <>
      <table><tbody>
        {items.map((item, index) => (
          <tr key={item} className={pagination.isVisible(index) ? '' : 'pagination-hidden-row'}>
            <td>{item}</td>
          </tr>
        ))}
      </tbody></table>
      <TablePagination pagination={pagination} label="測試清單" />
    </>
  )
}

describe('TablePagination', () => {
  it('changes page and page size while keeping page state aligned with the displayed rows', () => {
    render(<PaginatedRows />)

    expect(screen.getByText('顯示 1–10 筆，共 13 筆')).toBeTruthy()
    expect(screen.getByText('資料 11').closest('tr')?.className).toContain('pagination-hidden-row')

    fireEvent.click(screen.getByRole('button', { name: '測試清單第 2 頁' }))
    expect(screen.getByText('顯示 11–13 筆，共 13 筆')).toBeTruthy()
    expect(screen.getByText('資料 11').closest('tr')?.className).toBe('')
    expect(screen.getByText('資料 1').closest('tr')?.className).toContain('pagination-hidden-row')

    fireEvent.change(screen.getByLabelText('測試清單每頁筆數'), { target: { value: '20' } })
    expect(screen.getByText('顯示 1–13 筆，共 13 筆')).toBeTruthy()
  })

  it('opens on the page containing a requested deep-linked row', () => {
    render(<PaginatedRows targetIndex={12} />)

    expect(screen.getByText('顯示 11–13 筆，共 13 筆')).toBeTruthy()
    expect(screen.getByText('資料 13').closest('tr')?.className).toBe('')
  })

  it('returns to the first page when the active filter changes', () => {
    const view = render(<PaginatedRows resetKey="all" />)
    fireEvent.click(screen.getByRole('button', { name: '測試清單第 2 頁' }))
    expect(screen.getByText('顯示 11–13 筆，共 13 筆')).toBeTruthy()

    view.rerender(<PaginatedRows resetKey="open" />)
    expect(screen.getByText('顯示 1–10 筆，共 13 筆')).toBeTruthy()
  })
})
