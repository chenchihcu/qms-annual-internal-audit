import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../../App'

describe('RiskAssessment matrix layout', () => {
  beforeAll(async () => {
    await import('../RiskAssessment')
  })

  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('shows procedure risk table and saves inherent risk on demand', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '方案風險' }))

    const table = await screen.findByRole('region', { name: '程序風險評估表格' }, { timeout: 10000 })

    expect(screen.queryByText(/部門發生度／嚴重度請至/)).toBeNull()
    expect(screen.queryByText(/至利害關係人編輯部門 O／S/)).toBeNull()
    expect(screen.queryByText(/風險指數 = 發生度 O × 嚴重度 S/)).toBeNull()

    expect(within(table).getByText('固有風險')).toBeTruthy()
    const saveButtons = within(table).getAllByRole('button', { name: '存檔' })
    expect(saveButtons.length).toBeGreaterThan(0)
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(within(table).getByRole('button', { name: '已存檔' })).toBeTruthy()
    })
  }, 15000)

  it('workflow guide shows summary gap not per-row list', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '方案風險' }))

    await waitFor(() => {
      expect(document.querySelector('[data-workflow-guide="top"]')).toBeTruthy()
    })

    const guide = document.querySelector('[data-workflow-guide="top"]')!
    expect(guide.textContent).not.toMatch(/評估全部 QP/)
    const gapItems = guide.querySelectorAll('li')
    expect(gapItems.length).toBeLessThanOrEqual(3)
    if (gapItems.length > 0) {
      expect(gapItems[0].textContent).toMatch(/固有風險已存檔 \d+\/\d+/)
    }
  })
})
