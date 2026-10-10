import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../../App'

async function openRiskTable() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '方案風險' }))
  return screen.findByRole('region', { name: '程序風險評估一覽' }, { timeout: 10000 })
}

describe('RiskAssessment auto-counted matrix', () => {
  beforeAll(async () => {
    await import('../RiskAssessment')
  })

  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('shows the seven factors as columns with automatic values and saves a row', async () => {
    const table = await openRiskTable()

    expect(within(table).queryByRole('button', { name: /因素明細/ })).toBeNull()
    expect(screen.queryByRole('region', { name: '外部來源登錄' })).toBeNull()
    expect(screen.getByRole('link', { name: '風險來源登錄' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /未填因素帶入建議/ })).toBeNull()

    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual(['QP', '部門', '固有系統', '內稽NCR系統', '第三方NCR系統', '未結NCR系統', '客訴登錄', '重大變更登錄', '距上次稽核系統', '結果', '證據引用', '操作'])
    expect(within(table).getByRole('columnheader', { name: '客訴登錄' }).getAttribute('title')).toContain('同一外部編號只計一次')
    const cols = table.querySelectorAll('colgroup col')
    expect(cols).toHaveLength(12)
    expect(cols[2]?.className).toBe('col-risk-factor col-print-factor')
    expect(cols[9]?.className).toBe('col-risk-result col-print-result')
    expect(cols[10]?.className).toBe('col-print-evidence-ref')

    const firstRow = within(table).getAllByRole('row')[1]
    expect(within(firstRow).getByRole('button', { name: /程序固有風險：.+（自動）/ })).toBeTruthy()
    expect(within(firstRow).getAllByRole('button', { name: /（待確認）$/ }).length).toBeGreaterThan(0)
    // 客訴未登錄視為 0 件，自動帶入
    expect(within(firstRow).getByRole('button', { name: /客戶抱怨件數：0件（自動）/ })).toBeTruthy()
    expect(within(firstRow).getByText(/^暫估 \d+$/)).toBeTruthy()
    expect(within(firstRow).getByText(/^・缺 \d 項$/)).toBeTruthy()
    expect(screen.getByRole('status', { name: '缺資料摘要' })).toBeTruthy()

    fireEvent.click(within(firstRow).getByRole('button', { name: '存檔' }))
    await waitFor(() => {
      expect(within(firstRow).getByRole('button', { name: '已存檔' })).toBeTruthy()
    })
    await waitFor(() => {
      expect(within(firstRow).getByText('已存')).toBeTruthy()
    }, { timeout: 4000 })
    expect(within(firstRow).queryByRole('button', { name: '存檔' })).toBeNull()
  }, 15000)

  it('keeps row order fixed while editing and re-sorts only on request', async () => {
    const table = await openRiskTable()
    const sortGroup = screen.getByRole('group', { name: '列排序' })
    expect(within(sortGroup).getByRole('button', { name: '待處理優先' }).getAttribute('aria-pressed')).toBe('true')
    const firstCode = () => within(within(table).getAllByRole('row')[1]).getAllByRole('cell').slice(0, 2).map((cell) => cell.textContent).join('|')
    const before = firstCode()
    fireEvent.click(within(within(table).getAllByRole('row')[1]).getByRole('button', { name: '存檔' }))
    expect(firstCode()).toBe(before)
    fireEvent.click(within(sortGroup).getByRole('button', { name: '計畫順序' }))
    expect(within(sortGroup).getByRole('button', { name: '計畫順序' }).getAttribute('aria-pressed')).toBe('true')

    // 已存列在「待處理優先」排到後面；列印時仍回到計畫順序。
    fireEvent.click(within(sortGroup).getByRole('button', { name: '待處理優先' }))
    expect(firstCode()).not.toBe(before)
    fireEvent(window, new Event('beforeprint'))
    expect(firstCode()).toBe(before)
    fireEvent(window, new Event('afterprint'))
    await waitFor(() => expect(firstCode()).not.toBe(before))
  }, 15000)

  it('requires a selected reason when a value departs from the system value', async () => {
    const table = await openRiskTable()
    const row = within(table).getAllByRole('row')[1]

    fireEvent.click(within(row).getByRole('button', { name: /程序固有風險：/ }))
    const editor = screen.getByRole('dialog', { name: /程序固有風險$/ })
    const target = within(editor).getAllByRole('radio').find((option) => option.getAttribute('aria-checked') === 'false')!
    fireEvent.click(target)
    expect(within(row).getByRole('button', { name: /程序固有風險：.+（人工（系統/ })).toBeTruthy()
    expect(within(editor).getByLabelText(/^調整理由/)).toBeTruthy()
    fireEvent.click(within(editor).getByRole('button', { name: '完成' }))

    fireEvent.click(within(row).getByRole('button', { name: '存檔' }))
    expect(within(row).getByRole('alert').textContent).toContain('為人工值，須選調整理由')

    fireEvent.click(within(row).getByRole('button', { name: /程序固有風險：/ }))
    fireEvent.change(screen.getByLabelText(/^調整理由/), { target: { value: '調查結論與系統歸屬不同' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(within(row).getByRole('button', { name: '存檔' }))
    await waitFor(() => {
      expect(within(row).getByRole('button', { name: '已存檔' })).toBeTruthy()
    })
    expect(within(row).getByText('草稿')).toBeTruthy()
  }, 15000)

  it('saves every unsaved row in one step', async () => {
    await openRiskTable()
    fireEvent.click(screen.getByRole('button', { name: /儲存全部（\d+）/ }))
    expect(await screen.findByText(/^已存 \d+ 列。$/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '儲存全部（0）' }).hasAttribute('disabled')).toBe(true)
  }, 15000)

  it('does not show the workflow guide on the risk page', async () => {
    await openRiskTable()
    expect(document.querySelector('[data-workflow-guide="top"]')).toBeNull()
    expect(screen.queryByRole('heading', { name: /程序風險評估一覽/ })).toBeNull()
  })
})
