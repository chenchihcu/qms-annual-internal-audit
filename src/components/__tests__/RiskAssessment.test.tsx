import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../../App'

describe('RiskAssessment matrix layout', () => {
  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('shows department risk table and persists factor edits', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '方案風險' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '方案風險' })).toBeTruthy()
    })

    const table = screen.getByRole('region', { name: '部門風險評估表格' })
    expect(within(table).getByText('平均分')).toBeTruthy()
    expect(within(table).getByText('未結 NCR')).toBeTruthy()
    const occurrenceInput = within(table).getAllByLabelText(/發生度 O/)[0] as HTMLInputElement
    fireEvent.change(occurrenceInput, { target: { value: '1' } })

    await waitFor(() => {
      expect(occurrenceInput.value).toBe('1')
    })
  })

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
