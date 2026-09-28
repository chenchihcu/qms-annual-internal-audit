import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from './App'

const TAB_LABELS = [
  '稽核總覽',
  '利害關係人',
  '方案風險',
  '人員合格名單',
  '年度稽核計畫',
  '查檢表',
  '觀察事項',
  '不符合',
  '第三方建議',
  '待改善追蹤',
  '外稽準備',
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
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    window.history.replaceState(null, '', '/')
    localStorage.clear()
  })

  afterEach(() => vi.restoreAllMocks())

  it('renders all twelve remaining pages without crashing', async () => {
    render(<App />)

    for (const label of TAB_LABELS) {
      const tab = screen.getByRole('button', { name: label })
      fireEvent.click(tab)
      await waitFor(() => {
        expect(screen.queryByText(`${label} 無法顯示`)).toBeNull()
      })
    }
  }, 30000)

  it('lists twelve tabs without PDCA group headings', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: '依稽核流程的表單導覽' })
    for (const heading of SIDEBAR_GROUP_LABELS) {
      expect(within(nav).queryByText(heading)).toBeNull()
    }
    for (const label of TAB_LABELS) {
      expect(within(nav).getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('exposes mobile navigation state and lets the menu button close the drawer', () => {
    render(<App />)
    const menu = screen.getByRole('button', { name: '開啟導覽' })

    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: '關閉導覽' })).toBe(menu)

    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: '開啟導覽' })).toBe(menu)
  })

  it('keeps a single audit workspace without a company switcher', () => {
    render(<App />)
    expect(screen.queryByRole('group', { name: '切換公司' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '年度稽核計畫' }))
    expect(screen.getByRole('button', { name: '稽核總覽' })).toBeTruthy()
  })

  it('keeps dashboard concise and preserves tracking drill-down controls', async () => {
    render(<App />)
    const guide = document.querySelector('[data-workflow-guide="top"]')
    expect(guide).toBeNull()
    expect(document.querySelector('[data-workflow-guide="bottom"]')).toBeNull()
    expect(screen.getByRole('region', { name: '稽核總覽' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '追蹤清單' })).toBeNull()
    await screen.findByRole('button', { name: '前往：前年度未結觀察' })
    fireEvent.click(screen.getByRole('button', { name: '前往：前年度未結觀察' }))
    await waitFor(() => {
      expect(screen.getByText(/前年度觀察事項/)).toBeTruthy()
    }, { timeout: 5000 })
  })

  it('keeps the selected page when the skip link focuses main content', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '系統設定' }))
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: '系統設定區塊' })).toBeTruthy()
    })

    const main = document.querySelector('main#main')
    fireEvent.click(screen.getByRole('link', { name: '跳至主要內容' }))

    expect(document.activeElement).toBe(main)
    expect(window.location.hash).toBe('#tab=system-settings')
    expect(screen.getByRole('radiogroup', { name: '系統設定區塊' })).toBeTruthy()
  })

  it('returns to the top when switching workflow pages', async () => {
    const scrollTo = vi.mocked(window.scrollTo)
    render(<App />)
    const initialCalls = scrollTo.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: '系統設定' }))
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: '系統設定區塊' })).toBeTruthy()
    })

    expect(scrollTo).toHaveBeenCalledTimes(initialCalls + 1)
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
  })

  it('hides workflow guide on system settings when there are no gaps', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '系統設定' }))
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: '系統設定區塊' })).toBeTruthy()
    })
    expect(document.querySelector('[data-workflow-guide="top"]')).toBeNull()
    expect(screen.queryByText('關於')).toBeNull()
    expect(screen.queryByText(/QMS 年度內部稽核系統 v14/)).toBeNull()
  })

  it('keeps sidebar local storage notice without footer tagline', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: '依稽核流程的表單導覽' })
    expect(within(nav.closest('aside') as HTMLElement).getByText('資料儲存於本機 · v14')).toBeTruthy()
    expect(screen.queryByText('ISO 9001 / AS9100D 內部稽核')).toBeNull()
  })

  it('does not use sidebar brand card as second home control', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: '回到稽核總覽' })).toBeNull()
    expect(screen.getAllByText('QMS 年度內部稽核').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '年度稽核計畫' }))
    expect(window.location.hash).not.toBe('#tab=dashboard')
    fireEvent.click(screen.getByRole('button', { name: '稽核總覽' }))
    expect(window.location.hash).toBe('#tab=dashboard')
  })

  it('omits duplicate toolbar meta on plan, risk, and stakeholders', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '年度稽核計畫' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '依日期與利害關係人自動編排' })).toBeTruthy()
    })
    expect(screen.queryByText(/內稽年度請用頁首切換/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '方案風險' }))
    await waitFor(() => {
      expect(screen.getByRole('region', { name: '程序風險評估一覽' })).toBeTruthy()
      expect(document.querySelector('[data-workflow-guide="top"]')).toBeNull()
    })
    expect(screen.queryByText(/不取代程序固有風險/)).toBeNull()
    expect(screen.queryByText(/至利害關係人編輯部門 O／S/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '利害關係人' }))
    await waitFor(() => {
      expect(screen.getByRole('region', { name: '部門利害關係人一覽' })).toBeTruthy()
      expect(screen.queryByText('評分規則與編排影響')).toBeNull()
    })
    expect(screen.queryByText(/兩者不可互代/)).toBeNull()
  })

  it('shows NCR import guidance only when manual form is expanded', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '不符合' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /不符合事項一覽/ })).toBeTruthy()
    })
    expect(screen.queryByText(/查檢表判定「不符」時自動匯入/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '手動新增 NCR' }))
    expect(
      screen.getByText(/查檢表判定「不符」時自動匯入。描述為發現文字，不會被查檢覆寫；矯正內容請填「矯正措施」。此處可登錄會議或現場發現。/),
    ).toBeTruthy()
  })

  it('hides open-count workflow guide on ncr and observations tabs', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '不符合' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /不符合事項一覽/ })).toBeTruthy()
    })
    expect(document.querySelector('[data-workflow-guide="top"]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '觀察事項' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登錄觀察事項' })).toBeTruthy()
      expect(screen.getByRole('region', { name: '觀察事項紀錄一覽' })).toBeTruthy()
    })
    expect(screen.queryByRole('heading', { name: /觀察事項紀錄一覽/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: /查檢未同步一覽/ })).toBeNull()
    expect(document.querySelector('[data-workflow-guide="top"]')).toBeNull()
  })

  it('shows standard and procedure field errors on system settings', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '系統設定' }))
    await waitFor(() => {
      expect(screen.getByLabelText('程序版本')).toBeTruthy()
    })
    expect(screen.getByText('仍為待確認')).toBeTruthy()
  })

  it('does not expose whole-workspace clearing in system settings', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '系統設定' }))
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: '系統設定區塊' })).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: '清除全部資料' })).toBeNull()
    expect(screen.getByRole('radiogroup', { name: '系統設定區塊' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '備份與匯出' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '回收區' })).toBeTruthy()
  })

  it('asks before switching audit year and keeps year when cancelled', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByLabelText('內稽年度')).toBeTruthy()
    })
    const yearInput = screen.getByLabelText('內稽年度') as HTMLInputElement
    expect(yearInput.value).toBe('2026')
    expect(screen.getByText('年度稽核 ·')).toBeTruthy()
    expect(screen.queryByText('內稽年度')).toBeNull()
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
      expect(screen.getByLabelText('稽核日期')).toBeTruthy()
    })
  })

  it('asks before deleting custom checklist item and keeps item when cancelled', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '查檢表' }))
    await waitFor(() => {
      expect(screen.getByLabelText('查檢表')).toBeTruthy()
    })
    const select = screen.getByLabelText('查檢表') as HTMLSelectElement
    const qaOption = Array.from(select.options).find(
      (option) => option.text.includes('QP-16') && option.text.includes('品保'),
    )
    expect(qaOption).toBeTruthy()
    fireEvent.change(select, { target: { value: qaOption!.value } })
    await waitFor(() => {
      expect(screen.getByText(/不合格品隔離/)).toBeTruthy()
      expect(screen.getByRole('button', { name: '新增稽核項目' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '新增稽核項目' }))
    const deleteBtn = screen.getAllByRole('button', { name: /移至回收區/ }).at(-1)
    expect(deleteBtn).toBeTruthy()
    fireEvent.click(deleteBtn!)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('移至回收區？')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: /移至回收區/ }).length).toBeGreaterThan(0)
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
    expect(screen.getByLabelText('稽核日期')).toBeTruthy()
  })

  it('asks before switching external prep year', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '外稽準備' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '改準備表年度' })).toBeTruthy()
    })
    expect(screen.getByText(/外稽準備 · \d+ 年/)).toBeTruthy()
    expect(screen.getByText('內稽年度')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '改準備表年度' }))
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
