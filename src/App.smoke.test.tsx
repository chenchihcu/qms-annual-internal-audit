import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

const TAB_LABELS = [
  '稽核總覽',
  '標準',
  '程序',
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

  it('renders all twelve tabs without crashing', () => {
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
})
