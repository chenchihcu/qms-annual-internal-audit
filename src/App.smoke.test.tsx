import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'

const TAB_LABELS = [
  '稽核總覽',
  '年度稽核計畫',
  '稽核執行與證據',
  '不符合與矯正措施',
  '觀察事項與追蹤',
  '改善機會與建議',
  '稽核啟動與活動準備',
  '方案風險與優先順序',
  '稽核員能力與任命',
  '標準',
  '程序',
  '系統設定',
]

describe('App tab smoke', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('renders all ten tabs without crashing', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /不符合.*前往不符合與矯正措施/i }))
    expect(screen.getByRole('button', { name: '不符合與矯正措施' })).toBeTruthy()
  })
})
