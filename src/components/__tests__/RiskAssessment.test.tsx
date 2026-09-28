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

    const table = await screen.findByRole('region', { name: '程序風險評估一覽' }, { timeout: 10000 })

    expect(screen.queryByText(/部門發生度／嚴重度請至/)).toBeNull()
    expect(screen.queryByText(/至利害關係人編輯部門 O／S/)).toBeNull()
    expect(screen.queryByText(/風險指數 = 發生度 O × 嚴重度 S/)).toBeNull()

    expect(within(table).queryByText('未存檔')).toBeNull()
    const cols = table.querySelectorAll('colgroup col')
    expect(cols[2]?.className).toBe('col-inherent')
    expect(cols[3]?.className).toBe('col-status')
    expect(cols[5]?.className).toBe('')
    const inherentButton = within(table).getAllByRole('button', { name: /固有風險$/ })[0]
    const factorSummary = within(table).getAllByText('其他因素（可暫定）')[0]
    expect(inherentButton.parentElement).toBe(factorSummary.closest('div'))
    const saveButtons = within(table).getAllByRole('button', { name: '存檔' })
    expect(saveButtons.length).toBeGreaterThan(0)
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(within(table).getByRole('button', { name: '已存檔' })).toBeTruthy()
    })
  }, 15000)

  it('does not show the workflow guide on the risk page', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '方案風險' }))

    await screen.findByRole('region', { name: '程序風險評估一覽' }, { timeout: 10000 })
    expect(document.querySelector('[data-workflow-guide="top"]')).toBeNull()
    expect(screen.queryByRole('heading', { name: /程序風險評估一覽/ })).toBeNull()
  })
})
