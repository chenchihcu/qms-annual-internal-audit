import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../../App'

describe('StakeholdersPage', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('shows formula, ranking, and department rows', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '利害關係人' }))

    await waitFor(() => {
      expect(screen.getByText('部門利害關係人與優先權')).toBeTruthy()
    })

    const form = document.getElementById('stakeholders-form') as HTMLElement
    expect(form).toBeTruthy()
    expect(within(form).getByText(/標定各部門利害關係人與部門風險/)).toBeTruthy()
    expect(within(form).getByText(/每個部門至少勾一個「誰在乎」/)).toBeTruthy()
    expect(within(form).getByText('不影響本頁完成')).toBeTruthy()
    expect(within(form).getByText(/利害關係人（部門）/)).toBeTruthy()
    expect(within(form).getByText(/評分規則與編排影響/)).toBeTruthy()
    expect(within(form).getByText(/優先分數 = Σ\(標籤權重\)×2 \+ O×S/)).toBeTruthy()
    expect(within(form).getByText(/編排影響（預覽自動編排時）/)).toBeTruthy()
    expect(within(form).getByText(/QP-28/)).toBeTruthy()
    expect(within(form).getByText(/部門已標註利害關係人/)).toBeTruthy()
    expect(within(form).getAllByText(/本部門 QP · 優先/).length).toBeGreaterThan(0)
    expect(within(form).getByText(/已完成本頁終點/)).toBeTruthy()
    expect(within(form).getAllByText('管理部').length).toBeGreaterThan(0)
  })

  it('updates chip pressed state when toggling stakeholder tag', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '利害關係人' }))

    await waitFor(() => {
      expect(screen.getAllByText('管理部').length).toBeGreaterThan(0)
    })

    const adminCard = document.querySelector('[data-stakeholder-dept="dept-admin"]') as HTMLElement
    expect(adminCard).toBeTruthy()
    fireEvent.click(adminCard.querySelector('summary')!)

    const supplierChip = within(adminCard).getByRole('button', { name: /供應商 · 5/ })
    const pressedBefore = supplierChip.getAttribute('aria-pressed')
    fireEvent.click(supplierChip)

    await waitFor(() => {
      expect(supplierChip.getAttribute('aria-pressed')).toBe(pressedBefore === 'true' ? 'false' : 'true')
    })

    const group = document.getElementById('dept-admin-o-mobile')?.querySelector('[role="radiogroup"]') as HTMLElement
    expect(group).toBeTruthy()
    fireEvent.click(within(group).getByRole('radio', { name: /發生度（低／中／高） 高：一年多次或持續發生/ }))
    await waitFor(() => {
      expect(within(group).getByRole('radio', { name: /發生度（低／中／高） 高：一年多次或持續發生/ }).getAttribute('aria-checked')).toBe('true')
    })
  })
})
