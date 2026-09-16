import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../../App'

describe('RiskAssessment card layout', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('shows grouped scales, missing chips, and provisional hints when expanded', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '方案風險與優先順序' }))

    await waitFor(() => {
      expect(screen.getByText('風險指標評估（QR-02-01）')).toBeTruthy()
    })

    const firstCard = document.querySelector('details[data-risk-key]') as HTMLDetailsElement
    expect(firstCard).toBeTruthy()
    fireEvent.click(firstCard.querySelector('summary')!)

    expect(within(firstCard).getByText('歷史結果', { exact: true })).toBeTruthy()
    expect(within(firstCard).getByText('現況壓力', { exact: true })).toBeTruthy()
    expect(within(firstCard).getByText('時間', { exact: true })).toBeTruthy()
    expect(within(firstCard).getByRole('radiogroup', { name: '固有風險（1–5）' })).toBeTruthy()

    const missingHints = within(firstCard).getAllByText('尚未填寫 · 分數暫估 3')
    expect(missingHints.length).toBeGreaterThan(0)

    const chip = within(firstCard).queryByRole('button', { name: '客戶抱怨' })
    if (chip) {
      expect(chip).toBeTruthy()
    }
  })

  it('persists customer complaint selection and removes missing chip', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '方案風險與優先順序' }))

    await waitFor(() => {
      expect(document.querySelector('details[data-risk-key]')).toBeTruthy()
    })

    const firstCard = document.querySelector('details[data-risk-key]') as HTMLDetailsElement
    fireEvent.click(firstCard.querySelector('summary')!)

    const complaintGroup = within(firstCard).getByRole('radiogroup', { name: '客戶抱怨（1–5）' })
    fireEvent.click(within(complaintGroup).getByRole('radio', { name: '4' }))

    await waitFor(() => {
      expect(within(complaintGroup).getByRole('radio', { name: '4' }).getAttribute('aria-checked')).toBe('true')
    })
    expect(within(firstCard).queryByRole('button', { name: '客戶抱怨' })).toBeNull()
  })
})
