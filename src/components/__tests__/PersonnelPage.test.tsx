import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import App from '../../App'
import { createDemoState, STORAGE_KEY } from '../../data/demoData'
import { WORKSPACE_COMPANY_ID } from '../../lib/singleWorkspaceMigration'
import type { AppState } from '../../types'

async function openPersonnel() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '人員合格名單' }))
  return screen.findByRole('region', { name: '內部稽核人員清單' }, { timeout: 10000 })
}

function storedPeopleCount(name: string): number {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { people?: Array<{ name: string }> }
  return (stored.people ?? []).filter((person) => person.name === name).length
}

function storedState(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState
}

function seedState(mutate: (state: AppState) => void) {
  const state = createDemoState()
  mutate(state)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function selectFirstDepartment(label: string) {
  const select = screen.getByLabelText(label) as HTMLSelectElement
  fireEvent.change(select, { target: { value: select.options[1].value } })
}

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
    const table = await openPersonnel()
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
    expect(screen.getByRole('heading', { name: '編輯人員' })).toBeTruthy()
    expect(screen.getByLabelText('稽核資格 *')).toBeTruthy()
    expect(screen.getByLabelText('所屬單位 *')).toBeTruthy()
    expect(screen.queryByText('可稽核程序（QP）')).toBeNull()
    const qualificationStatus = screen.getByLabelText('資格狀態 *')
    expect(within(qualificationStatus).queryByRole('option', { name: '暫停' })).toBeNull()
    const auditorRole = screen.getByRole('checkbox', { name: '內部稽核員' }) as HTMLInputElement
    expect(auditorRole.checked).toBe(true)
    expect(auditorRole.disabled).toBe(true)
  }, 15000)

  it('has a single add entry whose fields follow the selected roles', async () => {
    await openPersonnel()
    expect(screen.getAllByRole('button', { name: '新增人員' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '新增稽核員' })).toBeNull()
    expect(screen.queryByRole('button', { name: '新增' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '新增人員' }))
    for (const label of ['內部稽核員', '主任稽核員', '管理代表', '陪稽人員']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeTruthy()
    }
    expect(screen.queryByLabelText('稽核資格 *')).toBeNull()
    const save = screen.getByRole('button', { name: '儲存' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '統一入口測試甲' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '內部稽核員' }))
    expect(screen.getByLabelText('稽核資格 *')).toBeTruthy()
    expect((screen.getByLabelText('人員類型') as HTMLSelectElement).disabled).toBe(true)
    expect(save.disabled).toBe(true)
    expect(screen.getByText('尚需填寫：所屬單位')).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox', { name: '主任稽核員' }))
    expect(screen.getByLabelText('主任稽核員生效日')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: '管理代表' }))
    expect(screen.getByLabelText('管理代表生效日')).toBeTruthy()
  }, 15000)

  it('creates one person with auditor and lead roles shown in both sections', async () => {
    await openPersonnel()
    fireEvent.click(screen.getByRole('button', { name: '新增人員' }))
    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '統一入口測試乙' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '內部稽核員' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '主任稽核員' }))
    selectFirstDepartment('所屬單位 *')
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByText('已儲存')).toBeTruthy()
    const auditorTable = screen.getByRole('region', { name: '內部稽核人員清單' })
    expect(within(auditorTable).getByText('統一入口測試乙')).toBeTruthy()
    const otherTable = screen.getByRole('region', { name: '其他角色與任命清單' })
    const otherRow = within(otherTable).getByText('統一入口測試乙').closest('tr')!
    expect(within(otherRow).getByText(/主任稽核員任命/)).toBeTruthy()
    await waitFor(() => expect(storedPeopleCount('統一入口測試乙')).toBe(1))
  }, 15000)

  it('creates management representative and escort without auditor qualification', async () => {
    await openPersonnel()
    fireEvent.click(screen.getByRole('button', { name: '新增人員' }))
    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '統一入口測試丙' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '管理代表' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '陪稽人員' }))
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByText('已儲存')).toBeTruthy()
    const auditorTable = screen.getByRole('region', { name: '內部稽核人員清單' })
    expect(within(auditorTable).queryByText('統一入口測試丙')).toBeNull()
    const otherTable = screen.getByRole('region', { name: '其他角色與任命清單' })
    const otherRow = within(otherTable).getByText('統一入口測試丙').closest('tr')!
    expect(within(otherRow).getByText(/管理代表/)).toBeTruthy()
    expect(within(otherRow).getByText(/陪稽/)).toBeTruthy()
    await waitFor(() => expect(storedPeopleCount('統一入口測試丙')).toBe(1))
  }, 15000)

  it('blocks duplicate names and loads the existing person instead', async () => {
    await openPersonnel()
    fireEvent.click(screen.getByRole('button', { name: '新增人員' }))
    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '王大明' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '陪稽人員' }))
    expect(screen.getByText('已有同名人員，請改為編輯該人員以加入角色。')).toBeTruthy()
    expect((screen.getByRole('button', { name: '儲存' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '載入既有人員' }))
    expect(screen.getByRole('heading', { name: '編輯人員' })).toBeTruthy()
    const auditorRole = screen.getByRole('checkbox', { name: '內部稽核員' }) as HTMLInputElement
    expect(auditorRole.checked && auditorRole.disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: '陪稽人員' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByText('已儲存')).toBeTruthy()
    const otherTable = screen.getByRole('region', { name: '其他角色與任命清單' })
    expect(within(otherTable).getByText('王大明')).toBeTruthy()
    await waitFor(() => expect(storedPeopleCount('王大明')).toBe(1))
  }, 15000)

  it('keeps an annual-only lead assignment from becoming a standing appointment on unrelated saves', async () => {
    let personId = ''
    seedState((state) => {
      const person = state.people.find((item) => item.name === '王大明')!
      personId = person.id
      person.appointments = person.appointments.filter((item) => item.role !== 'internal_lead_auditor')
      state.annualPersonnelAssignments = [{
        id: 'annual-lead-test',
        year: state.settings.auditYear,
        companyId: WORKSPACE_COMPANY_ID,
        personId: person.id,
        role: 'internal_lead_auditor',
      }]
    })
    const table = await openPersonnel()
    const row = within(table).getByText('王大明').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: '編輯' }))
    expect((screen.getByRole('checkbox', { name: '主任稽核員' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByText('已儲存')).toBeTruthy()
    await waitFor(() => {
      const person = storedState().people.find((item) => item.id === personId)!
      expect(person.appointments.filter((item) => item.role === 'internal_lead_auditor')).toEqual([])
    })
  }, 15000)

  it('offers explicit reactivation when loading an inactive duplicate', async () => {
    let personId = ''
    seedState((state) => {
      const person = state.people.find((item) => item.name === '王大明')!
      personId = person.id
      person.active = false
    })
    await openPersonnel()
    fireEvent.click(screen.getByRole('button', { name: '新增人員' }))
    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '王大明' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '陪稽人員' }))
    fireEvent.click(screen.getByRole('button', { name: '載入既有人員' }))

    const reactivate = screen.getByRole('checkbox', { name: /重新啟用此人員/ }) as HTMLInputElement
    expect(reactivate.checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByText('已儲存')).toBeTruthy()
    await waitFor(() => {
      expect(storedState().people.find((item) => item.id === personId)?.active).toBe(true)
    })
  }, 15000)
})
