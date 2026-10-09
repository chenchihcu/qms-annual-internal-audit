import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../../App'

describe('Suggestions 一覽', () => {
  beforeAll(async () => {
    await import('../Suggestions')
  })

  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    localStorage.clear()
    Element.prototype.scrollIntoView = () => {}
  })

  it('一覽唯讀顯示進度與狀態，編輯收在明細', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '第三方建議' }))
    const table = await screen.findByRole('region', { name: '第三方建議一覽' }, { timeout: 10000 })
    const firstRow = within(table).getAllByRole('row')[1]
    expect(within(firstRow).queryByRole('textbox')).toBeNull()
    expect(within(firstRow).queryByRole('combobox')).toBeNull()
    expect(within(firstRow).getAllByRole('button')).toHaveLength(1)

    const detail = within(firstRow).getByRole('button', { name: /建議明細/ })
    fireEvent.click(detail)
    expect(detail.getAttribute('aria-expanded')).toBe('true')
    const detailRow = document.getElementById(detail.getAttribute('aria-controls') ?? '')!
    expect(within(detailRow).getByRole('button', { name: /^帶入 \d{4} 年$/ })).toBeTruthy()
    const progress = within(table).getByRole('textbox', { name: /建議進度/ })
    fireEvent.change(progress, { target: { value: '已完成複查' } })
    expect(within(firstRow).getByText('已完成複查')).toBeTruthy()
    expect(within(table).getByRole('combobox', { name: /建議狀態/ })).toBeTruthy()
  }, 15000)
})
