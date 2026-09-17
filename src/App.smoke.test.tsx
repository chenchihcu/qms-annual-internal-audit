import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

const TAB_LABELS = [
  '稽核總覽',
  '標準',
  '程序',
  '利害關係人',
  '方案風險與優先順序',
  '年度稽核計畫',
  '稽核員能力與任命',
  '稽核執行與證據',
  '不符合與矯正措施',
  '觀察事項與追蹤',
  '改善機會與建議',
  '外部稽核前準備與序位',
  '系統設定',
]

describe('App tab smoke', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('renders all thirteen tabs without crashing', () => {
    render(<App />)

    for (const label of TAB_LABELS) {
      const tab = screen.getByRole('button', { name: label })
      fireEvent.click(tab)
      expect(screen.queryByText(`${label} 無法顯示`)).toBeNull()
    }
  })

  it('switches company without crashing', () => {
    render(<App />)
    const zlx = screen.getByRole('button', { name: /正隆興精密/ })
    fireEvent.click(zlx)
    expect(screen.getByRole('button', { name: '稽核總覽' })).toBeTruthy()
  })

  it('shows workflow guide and dashboard drill-down controls', () => {
    render(<App />)
    expect(document.querySelector('[data-workflow-guide="top"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /不符合 NCR/i }))
    expect(screen.getByRole('button', { name: '不符合與矯正措施' })).toBeTruthy()
  })

  it('asks before clearing all data and keeps data when cancelled', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '系統設定' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '清除全部資料' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '清除全部資料' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('清除全部資料')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('button', { name: '稽核總覽' })).toBeTruthy()
  })

  it('asks before switching audit year and keeps year when cancelled', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '年度稽核計畫' }))
    await waitFor(() => {
      expect(screen.getByLabelText('稽核年度')).toBeTruthy()
    })
    const yearInput = screen.getByLabelText('稽核年度') as HTMLInputElement
    expect(yearInput.value).toBe('2026')
    fireEvent.change(yearInput, { target: { value: '2027' } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('切換至 2027 年')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect((screen.getByLabelText('稽核年度') as HTMLInputElement).value).toBe('2026')
  })

  it('asks before converting observation to NCR', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '觀察事項與追蹤' }))
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '轉為 NCR' }).length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByRole('button', { name: '轉為 NCR' })[0])
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('轉為 NCR')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: '轉為 NCR' }).length).toBeGreaterThan(0)
  })

  it('links start audit button to visible block reasons for planning events', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '稽核執行與證據' }))
    await waitFor(() => {
      expect(screen.getByLabelText('目前稽核事件')).toBeTruthy()
    })
    const select = screen.getByLabelText('目前稽核事件') as HTMLSelectElement
    const planningOption = Array.from(select.options).find(
      (option) => option.text.includes('事件 ') && !option.text.match(/\d{4}-\d{2}-\d{2}/),
    )
    expect(planningOption).toBeTruthy()
    fireEvent.change(select, { target: { value: planningOption!.value } })

    const startBtn = screen.getByRole('button', { name: '開始稽核' })
    expect(startBtn.getAttribute('aria-describedby')).toBe('audit-start-gaps')
    const gaps = document.getElementById('audit-start-gaps')
    expect(gaps).toBeTruthy()
    expect(gaps!.textContent).toContain('阻擋：')
    expect(startBtn.closest('span')?.getAttribute('title')).toContain('；')
  })

  it('asks before deleting custom checklist item and keeps item when cancelled', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '稽核執行與證據' }))
    await waitFor(() => {
      expect(screen.getByLabelText('目前稽核事件')).toBeTruthy()
    })
    const select = screen.getByLabelText('目前稽核事件') as HTMLSelectElement
    const planningOption = Array.from(select.options).find((option) => option.text.includes('事件 '))
    expect(planningOption).toBeTruthy()
    fireEvent.change(select, { target: { value: planningOption!.value } })

    fireEvent.click(screen.getByRole('button', { name: '新增稽核項目' }))
    const deleteBtn = screen.getAllByRole('button', { name: /刪除/ }).at(-1)
    expect(deleteBtn).toBeTruthy()
    fireEvent.click(deleteBtn!)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('確認刪除查檢項')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: /刪除/ }).length).toBeGreaterThan(0)
  })
})
