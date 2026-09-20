import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../../App'

describe('RiskAssessment matrix layout', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('shows matrix table and persists factor on cell click', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '方案風險與優先順序' }))

    await waitFor(() => {
      expect(screen.getByText('風險指標評估（QR-02-01）')).toBeTruthy()
    })

    const matrix = document.querySelector('[data-risk-matrix]')
    expect(matrix).toBeTruthy()

    const firstRow = document.querySelector('[data-risk-key]') as HTMLTableRowElement
    expect(firstRow).toBeTruthy()

    const complaintBtn = within(firstRow).getByRole('button', { name: /客訴/ })
    fireEvent.click(complaintBtn)

    await waitFor(() => {
      expect(complaintBtn.textContent).toBe('無')
    })
  })

  it('workflow guide shows summary gap not per-row list', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '方案風險與優先順序' }))

    await waitFor(() => {
      expect(document.querySelector('[data-workflow-guide="top"]')).toBeTruthy()
    })

    const guide = document.querySelector('[data-workflow-guide="top"]')!
    const gapItems = guide.querySelectorAll('li')
    expect(gapItems.length).toBeLessThanOrEqual(3)
    if (gapItems.length > 0) {
      expect(gapItems[0].textContent).toMatch(/固有風險已存檔 \d+\/\d+/)
    }
  })
})
