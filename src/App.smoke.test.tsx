import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from './App'

const TAB_LABELS = [
  '稽核總覽',
  '標準',
  '程序',
  '利害關係人',
  '方案風險',
  '人員合格名單',
  '年度稽核計畫',
  '稽核日程',
  '查檢表',
  '觀察事項',
  '不符合',
  '第三方建議',
  '待改善追蹤',
  '外稽準備',
  '外稽當日行程',
  '系統設定',
]

const SIDEBAR_GROUP_LABELS = [
  '總覽',
  'P · 方案規劃',
  'D · 稽核執行',
  'C · 結果與改善',
  'A · 結案與改進',
  '系統管理',
]

describe('App tab smoke', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('renders all sixteen tabs without crashing', async () => {
    render(<App />)

    for (const label of TAB_LABELS) {
      const tab = screen.getByRole('button', { name: label })
      fireEvent.click(tab)
      await waitFor(() => {
        expect(screen.queryByText(`${label} 無法顯示`)).toBeNull()
      })
    }
  }, 30000)

  it('lists sixteen tabs without PDCA group headings', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: '依稽核流程的表單導覽' })
    for (const heading of SIDEBAR_GROUP_LABELS) {
      expect(within(nav).queryByText(heading)).toBeNull()
    }
    for (const label of TAB_LABELS) {
      expect(within(nav).getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('switches company without crashing', () => {
    render(<App />)
    const companySwitch = screen.getByRole('group', { name: '切換公司' })
    const zlx = within(companySwitch).getByRole('button', { name: '正隆興精密' })
    fireEvent.click(zlx)
    expect(screen.getByRole('button', { name: '稽核總覽' })).toBeTruthy()
  })

  it('shows workflow guide and dashboard drill-down controls', async () => {
    render(<App />)
    expect(document.querySelector('[data-workflow-guide="top"]')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /跨年待追蹤/ })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /跨年待追蹤/ }))
    await waitFor(() => {
      expect(screen.getByText(/前年度觀察事項/)).toBeTruthy()
    })
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
    await waitFor(() => {
      expect(screen.getByLabelText('內稽年度')).toBeTruthy()
    })
    const yearInput = screen.getByLabelText('內稽年度') as HTMLInputElement
    expect(yearInput.value).toBe('2026')
    fireEvent.change(yearInput, { target: { value: '2027' } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('切換至 2027 年')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect((screen.getByLabelText('內稽年度') as HTMLInputElement).value).toBe('2026')
  })

  it('asks before converting observation to NCR', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '觀察事項' }))
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

  it('loads checklist panel with procedure selector', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '查檢表' }))
    await waitFor(() => {
      expect(screen.getByLabelText('查檢表')).toBeTruthy()
      expect(screen.getByLabelText('實施日期')).toBeTruthy()
    })
  })

  it('asks before deleting custom checklist item and keeps item when cancelled', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '查檢表' }))
    await waitFor(() => {
      expect(screen.getByLabelText('查檢表')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '新增稽核項目' }))
    const deleteBtn = screen.getAllByRole('button', { name: /刪除/ }).at(-1)
    expect(deleteBtn).toBeTruthy()
    fireEvent.click(deleteBtn!)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('刪除稽核項目')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: /刪除/ }).length).toBeGreaterThan(0)
  })

  it('exposes skip link to main content', () => {
    render(<App />)
    const skip = screen.getByRole('link', { name: '跳至主要內容' })
    expect(skip.getAttribute('href')).toBe('#main')
    expect(document.getElementById('main')).toBeTruthy()
  })

  it('shows scored demo audit in checklist selector', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '查檢表' }))
    await waitFor(() => {
      expect(screen.getByLabelText('查檢表')).toBeTruthy()
    })
    const select = screen.getByLabelText('查檢表') as HTMLSelectElement
    const scoredOption = Array.from(select.options).find((option) => option.text.includes('QP-16'))
    expect(scoredOption).toBeTruthy()
    fireEvent.change(select, { target: { value: scoredOption!.value } })
    expect(screen.getByLabelText('實施日期')).toBeTruthy()
  })

  it('asks before switching external prep year', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '外稽準備' }))
    await waitFor(() => {
      expect(screen.getByLabelText('外稽準備表年度')).toBeTruthy()
    })
    const yearInput = screen.getByLabelText('外稽準備表年度') as HTMLInputElement
    expect(yearInput.value).toBe('2026')
    fireEvent.change(yearInput, { target: { value: '2027' } })
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('切換外稽準備至 2027 年')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect((screen.getByLabelText('外稽準備表年度') as HTMLInputElement).value).toBe('2026')
  })
})
