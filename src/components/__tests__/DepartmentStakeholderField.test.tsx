import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createDemoState } from '../../data/demoData'
import { DepartmentStakeholderField } from '../DepartmentStakeholderField'

function demoDept() {
  const dept = createDemoState().workspace.departments.find((d) => d.stakeholders.length > 0)!
  return { ...dept, stakeholders: [...dept.stakeholders] }
}

describe('DepartmentStakeholderField', () => {
  it('shows a visible label, text state per tag, and read-only O/S', () => {
    const dept = demoDept()
    render(<DepartmentStakeholderField dept={dept} rowCount={3} onChange={() => {}} />)
    const group = screen.getByRole('group', { name: '利害關係人（部門）' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons).toHaveLength(5)
    for (const button of buttons) {
      const pressed = button.getAttribute('aria-pressed') === 'true'
      expect(button.textContent?.startsWith('✓')).toBe(pressed)
    }
    expect(within(group).getByRole('status').textContent).toBe(`已選 ${dept.stakeholders.length} 項 · 套用於本部門 3 列`)
    expect(within(group).getByText(/部門 O／S（參考）：O [低中高] · S [低中高]/)).toBeTruthy()
    expect(group.querySelectorAll('input, select, textarea')).toHaveLength(0)
  })

  it('writes only the stakeholder list when a tag is toggled', () => {
    const dept = demoDept()
    const onChange = vi.fn()
    render(<DepartmentStakeholderField dept={dept} rowCount={1} onChange={onChange} />)
    const group = screen.getByRole('group', { name: '利害關係人（部門）' })
    const off = within(group).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'false')!
    const tag = off.textContent!
    off.focus()
    fireEvent.click(off)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([...dept.stakeholders, tag])

    const on = within(group).getByRole('button', { name: dept.stakeholders[0] })
    fireEvent.click(on)
    expect(onChange).toHaveBeenLastCalledWith(dept.stakeholders.slice(1))
  })

  it('states the missing tag in text when none are selected', () => {
    const dept = { ...demoDept(), stakeholders: [] }
    render(<DepartmentStakeholderField dept={dept} rowCount={2} onChange={() => {}} />)
    expect(screen.getByRole('status').textContent).toBe('待標註：至少選 1 項 · 套用於本部門 2 列')
  })
})
