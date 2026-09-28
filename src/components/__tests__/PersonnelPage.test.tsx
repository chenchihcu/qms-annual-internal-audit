import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from '../../App'

describe('Personnel list columns', () => {
  beforeAll(async () => {
    await import('../PersonnelPage')
  })

  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
    Element.prototype.scrollIntoView = () => {}
  })

  it('hides the scope column on screen and keeps qualification editing', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '人員合格名單' }))

    const table = await screen.findByRole('region', { name: '人員合格名單一覽' }, { timeout: 10000 })
    expect(within(table).getByText('適用範圍').className).toContain('print-table-cell')
    expect(table.querySelector('col.print-table-column')).toBeTruthy()
    expect(table.querySelectorAll('col')[3]?.className).toBe('col-person-role')
    expect(within(table).getByText('有效日期').className).not.toContain('print-table-cell')
    const trash = within(table).getByRole('button', { name: '移至回收區：王大明' })
    expect(trash.querySelector('svg')).toBeTruthy()
    expect(trash.textContent).toBe('')
    expect(trash.getAttribute('title')).toBe('移至回收區')

    fireEvent.click(within(table).getAllByRole('button', { name: '編輯' })[0])
    fireEvent.change(screen.getByLabelText('角色／資格類別'), { target: { value: 'internal_auditor' } })
    expect(screen.getByText('可稽核程序（QP）')).toBeTruthy()
  }, 15000)
})
