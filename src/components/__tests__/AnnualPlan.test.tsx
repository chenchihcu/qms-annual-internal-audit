import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from '../../App'

describe('Annual plan QP row', () => {
  beforeAll(async () => {
    await import('../AnnualPlan')
  })

  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('places the checklist link and detail control on the same row', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '年度稽核計畫' }))

    const table = await screen.findByRole('region', { name: '年度稽核計畫月格表' }, { timeout: 10000 })
    const link = within(table).getByRole('link', { name: 'QP-03 品保部 查檢表' })
    const detail = within(table).getByRole('button', { name: 'QP-03 品保部 明細' })
    expect(link.parentElement).toBe(detail.parentElement)
    expect(link.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '依日期與利害關係人自動編排' }))
    const preview = screen.getByRole('region', { name: '自動編排預覽' })
    expect(preview.textContent).toContain('未手動調整的計畫列，將依日期、利害關係人與風險重排月格（寫入擬定）')
    expect(preview.textContent).toMatch(/方案風險已確認 \d+\/\d+ 列/)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    fireEvent.click(within(preview).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('region', { name: '自動編排預覽' })).toBeNull()
    expect(screen.getByText('計畫尚未核准')).toBeTruthy()
  }, 15000)
})
