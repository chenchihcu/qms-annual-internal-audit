import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../../App'

describe('StakeholdersPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/#tab=stakeholders')
    localStorage.clear()
  })

  it('shows formula, ranking, and department rows', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '部門利害關係人一覽' })).toBeTruthy()
      expect(screen.queryByText('評分規則與編排影響')).toBeNull()
      expect(screen.queryByRole('heading', { name: '利害關係人' })).toBeNull()
      expect(screen.queryByRole('heading', { name: /部門利害關係人一覽/ })).toBeNull()
    }, { timeout: 5000 })

    const form = document.getElementById('stakeholders-form') as HTMLElement
    expect(form).toBeTruthy()
    expect(within(form).queryByText(/QP-28/)).toBeNull()
    expect(within(form).getAllByText(/本部門 QP · 優先/).length).toBeGreaterThan(0)
    expect(within(form).queryByRole('radiogroup', { name: /發生度/ })).toBeNull()
    const guide = document.querySelector('[data-workflow-guide="top"]')
    if (guide) {
      expect(guide.textContent).toMatch(/待完成：利害關係人已標註 \d+\/\d+/)
      expect(guide.textContent).not.toMatch(/標定各部門利害關係人/)
    }
    expect(within(form).getAllByText('管理部').length).toBeGreaterThan(0)
  })

  it('updates chip and occurrence only in edit dialog', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('管理部').length).toBeGreaterThan(0)
    }, { timeout: 5000 })

    const adminRow = formDepartmentRow('dept-admin')
    expect(adminRow).toBeTruthy()
    expect(within(adminRow!).queryByRole('button', { name: '供應商' })).toBeNull()

    const editBtn = within(adminRow!).getByRole('button', { name: /編輯 管理部/ })
    fireEvent.click(editBtn)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    const dialog = screen.getByRole('dialog')
    const supplierChip = within(dialog).getByRole('button', { name: '供應商' })
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

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(document.activeElement).toBe(editBtn)
  })
})

function formDepartmentRow(deptId: string): HTMLElement | null {
  const form = document.getElementById('stakeholders-form')
  return form?.querySelector(`[data-stakeholder-dept="${deptId}"]`) as HTMLElement | null
}
