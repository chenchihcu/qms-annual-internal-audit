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

  it('shows simplified auditor columns and edit form without QP scope fields', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '人員合格名單' }))

    const table = await screen.findByRole('region', { name: '內部稽核人員清單' }, { timeout: 10000 })
    expect(within(table).getByText('稽核資格')).toBeTruthy()
    expect(within(table).queryByText('適用標準')).toBeNull()
    expect(within(table).queryByText('可稽核程序（QP）')).toBeNull()
    const trash = within(table).getByRole('button', { name: '移至回收區：王大明' })
    expect(trash.querySelector('svg')).toBeTruthy()
    expect(trash.textContent).toBe('')
    expect(trash.getAttribute('title')).toBe('移至回收區')

    expect(screen.queryByLabelText('搜尋姓名')).toBeNull()
    expect(screen.queryByLabelText('資格狀態')).toBeNull()
    expect(screen.queryByRole('heading', { name: '內部稽核人員清單' })).toBeNull()

    fireEvent.click(within(table).getAllByRole('button', { name: '編輯' })[0])
    expect(screen.getByLabelText('稽核資格 *')).toBeTruthy()
    expect(screen.getByLabelText('所屬單位 *')).toBeTruthy()
    expect(screen.queryByText('可稽核程序（QP）')).toBeNull()
    const qualificationStatus = screen.getByLabelText('資格狀態 *')
    expect(within(qualificationStatus).queryByRole('option', { name: '暫停' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '新增' }))
    const role = screen.getByLabelText('角色／任命')
    expect(within(role).queryByRole('option', { name: '第三方主任稽核員' })).toBeNull()
    expect(within(role).queryByRole('option', { name: '第三方稽核員' })).toBeNull()
    expect(within(role).getByRole('option', { name: '主任稽核員任命' })).toBeTruthy()
  }, 15000)
})
