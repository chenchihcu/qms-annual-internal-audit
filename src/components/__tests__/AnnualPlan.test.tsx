import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from '../../App'
import { createDemoState } from '../../data/demoData'

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

  it('edits department stakeholder tags in the row detail and keeps O/S read-only', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '年度稽核計畫' }))
    const table = await screen.findByRole('region', { name: '年度稽核計畫月格表' }, { timeout: 10000 })
    fireEvent.click(within(table).getByRole('button', { name: 'QP-03 品保部 明細' }))

    const group = within(table).getByRole('group', { name: '利害關係人（部門）' })
    expect(within(group).getByText(/部門 O／S（參考）/)).toBeTruthy()
    expect(group.querySelectorAll('input, select, textarea')).toHaveLength(0)
    const off = within(group).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'false')!
    const tag = off.textContent!
    fireEvent.click(off)
    const toggled = within(group).getByRole('button', { name: tag })
    expect(toggled.getAttribute('aria-pressed')).toBe('true')
    expect(toggled.textContent).toBe(`✓${tag}`)
    expect(within(group).getByRole('status').textContent).toMatch(/^已選 \d+ 項 · 套用於本部門 \d+ 列$/)
  }, 15000)

  it('reopens the same row when the stakeholder gap link is clicked again', async () => {
    window.location.hash = '#tab=plan&record=plan-QP-03-dept-qa'
    render(<App />)
    await screen.findByRole('region', { name: '年度稽核計畫月格表' }, { timeout: 10000 })
    const detail = () => document.getElementById('plan-detail-plan-QP-03-dept-qa')!
    const group = within(detail()).getByRole('group', { name: '利害關係人（部門）' })
    for (const button of within(group).getAllByRole('button')) {
      if (button.getAttribute('aria-pressed') === 'true') fireEvent.click(button)
    }
    const gapLine = (await screen.findByText(/部門利害關係人已標註/)).closest('li')!
    const gapLink = within(gapLine).getByRole('button', { name: '至年度稽核計畫' })

    fireEvent.click(gapLink)
    fireEvent.click(screen.getByRole('button', { name: 'QP-03 品保部 明細' }))
    expect(detail().hidden).toBe(true)
    fireEvent.click(gapLink)
    expect(detail().hidden).toBe(false)
  }, 15000)

  it('opens the row requested by a #tab=plan&record deep link, even on a later page', async () => {
    const rows = createDemoState().workspace.planRows
    const target = rows[rows.length - 1]
    expect(rows.length).toBeGreaterThan(10)
    window.location.hash = `#tab=plan&record=${target.id}`
    render(<App />)
    await screen.findByRole('region', { name: '年度稽核計畫月格表' }, { timeout: 10000 })
    const detail = document.getElementById(`plan-detail-${target.id}`)!
    expect(detail.hidden).toBe(false)
    expect(within(detail).getByRole('group', { name: '利害關係人（部門）' })).toBeTruthy()
  }, 15000)
})
