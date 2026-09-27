import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../../App'

describe('StakeholdersPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    localStorage.clear()
  })

  it('shows formula, ranking, and department rows', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '利害關係人' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '利害關係人' })).toBeTruthy()
    }, { timeout: 5000 })

    const form = document.getElementById('stakeholders-form') as HTMLElement
    expect(form).toBeTruthy()
    expect(within(form).getByText(/評分規則與編排影響/)).toBeTruthy()
    const rulesPanel = within(form).getByText(/評分規則與編排影響/).closest('details')
    expect(rulesPanel?.hasAttribute('open')).toBe(false)
    expect(within(form).getByText(/優先分數 = Σ\(標籤權重\)×2 \+ O×S/)).toBeTruthy()
    expect(within(form).getByText(/編排影響（預覽自動編排時）/)).toBeTruthy()
    expect(within(form).queryByText(/QP-28/)).toBeNull()
    expect(within(form).getAllByText(/本部門 QP · 優先/).length).toBeGreaterThan(0)
    const guide = document.querySelector('[data-workflow-guide="top"]')
    if (guide) {
      expect(guide.textContent).toMatch(/待完成：利害關係人已標註 \d+\/\d+/)
      expect(guide.textContent).not.toMatch(/標定各部門利害關係人/)
    }
    expect(within(form).getAllByText('管理部').length).toBeGreaterThan(0)
  })

  it('updates chip pressed state when toggling stakeholder tag', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '利害關係人' }))

    await waitFor(() => {
      expect(screen.getAllByText('管理部').length).toBeGreaterThan(0)
    }, { timeout: 5000 })

    const adminRow = formDepartmentRow('dept-admin')
    expect(adminRow).toBeTruthy()

    const supplierChip = within(adminRow!).getByRole('button', { name: '供應商' })
    const pressedBefore = supplierChip.getAttribute('aria-pressed')
    fireEvent.click(supplierChip)

    await waitFor(() => {
      expect(supplierChip.getAttribute('aria-pressed')).toBe(pressedBefore === 'true' ? 'false' : 'true')
    })

    const group = document.getElementById('dept-admin-o')?.querySelector('[role="radiogroup"]') as HTMLElement
    expect(group).toBeTruthy()
    fireEvent.click(within(group).getByRole('radio', { name: /發生度 高：一年多次或持續發生/ }))
    await waitFor(() => {
      expect(within(group).getByRole('radio', { name: /發生度 高：一年多次或持續發生/ }).getAttribute('aria-checked')).toBe('true')
    })
  })
})

function formDepartmentRow(deptId: string): HTMLElement | null {
  const form = document.getElementById('stakeholders-form')
  return form?.querySelector(`[data-stakeholder-dept="${deptId}"]`) as HTMLElement | null
}
