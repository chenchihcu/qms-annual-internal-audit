import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createDemoState, STORAGE_KEY } from '../../data/demoData'
import { movePersonToTrash } from '../../lib/trash'
import { useAuditStore } from '../../hooks/useAuditStore'
import { SettingsPanel } from '../SettingsPanel'

beforeEach(() => localStorage.clear())

function createPersistedWorkspaceState() {
  return createDemoState()
}

function seedSettingsLocalStorage(state = createPersistedWorkspaceState()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return state
}

function SystemSettingsPage() {
  const store = useAuditStore()
  return <SettingsPanel store={store} />
}

describe('SettingsPanel profile feedback', () => {
  it('shows incomplete profile data as guidance within system settings', async () => {
    seedSettingsLocalStorage()
    render(<SystemSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('尚未指定保存位置')).toBeTruthy()
      expect(screen.getByRole('button', { name: '指定保存位置' })).toBeTruthy()
      expect(screen.queryByText('至少一項適用標準須標為已確認')).toBeNull()
      expect(screen.queryByLabelText('證書範圍')).toBeNull()
      expect(screen.queryByLabelText('證書編號／引用')).toBeNull()
      expect(screen.queryByLabelText('適用性 — AS9100')).toBeNull()
      expect(screen.queryByRole('heading', { name: '適用標準' })).toBeNull()
      expect(screen.queryByText('稽核開始時會保存適用依據快照。欄位變更即時儲存於目前瀏覽器。')).toBeNull()
      expect(screen.queryByRole('heading', { name: '稽核基本資料' })).toBeNull()
      expect(screen.queryByRole('heading', { name: '管理系統認證證書' })).toBeNull()
      expect(screen.queryByLabelText('版本 — AS9100')).toBeNull()
      expect(screen.queryByRole('heading', { name: '稽核程序與正式紀錄位置' })).toBeNull()
      expect(screen.queryByRole('tab', { name: '進階評分設定' })).toBeNull()
      expect(screen.queryByRole('tablist', { name: '稽核資料分頁' })).toBeNull()
      expect(screen.queryByLabelText(/符合得分/)).toBeNull()
      expect(screen.getByRole('radiogroup', { name: '系統設定區塊' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: '清除全部資料' })).toBeNull()
    })
  })

  it('shows snapshot ready message after completing required profile fields', async () => {
    seedSettingsLocalStorage()
    render(<SystemSettingsPage />)

    expect(screen.queryByLabelText(/依據引用.*ISO 9001/)).toBeNull()
    expect(screen.queryByLabelText(/依據引用.*AS9100/)).toBeNull()
    expect(screen.queryByText('確認 AS9100 的版本與適用性。')).toBeNull()
    expect(screen.queryByLabelText('版本 — ISO 9001')).toBeNull()
    expect(screen.queryByText(/ISO 9001:2026 已發布/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '指定保存位置' }))
    expect(screen.getByRole('dialog', { name: '指定正式紀錄保存位置' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('正式紀錄保存位置'), { target: { value: '品保部文件櫃 A-1' } })
    fireEvent.click(screen.getByRole('button', { name: '確認儲存' }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/已設定正式紀錄保存位置/)
    })
  })
})

describe('SettingsPanel sections', () => {
  it('separates audit data, data protection, and recycle bin actions', async () => {
    seedSettingsLocalStorage()
    render(<SystemSettingsPage />)

    expect(screen.queryByRole('heading', { name: '稽核基本資料' })).toBeNull()
    expect(screen.queryByRole('heading', { name: '稽核程序與正式紀錄位置' })).toBeNull()
    expect(screen.getByRole('button', { name: '指定保存位置' })).toBeTruthy()
    expect(screen.queryByText('年度資料生命週期與追溯')).toBeNull()

    await waitFor(() => {
      const auditSection = screen.getByRole('radio', { name: '稽核資料' }) as HTMLInputElement
      const dataSection = screen.getByRole('radio', { name: '備份與匯出' }) as HTMLInputElement
      expect(auditSection.checked).toBe(true)
      fireEvent.click(dataSection)
      expect(dataSection.checked).toBe(true)
      expect(auditSection.checked).toBe(false)
      expect(screen.getByRole('heading', { name: '備份與還原' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '下載完整備份' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '匯出全部稽核表單' })).toBeTruthy()
      expect((screen.getByRole('button', { name: '選擇備份檔還原' }) as HTMLButtonElement).disabled).toBe(true)
      expect(screen.queryByRole('button', { name: '還原示範資料' })).toBeNull()

      const trashSection = screen.getByRole('radio', { name: '回收區' }) as HTMLInputElement
      fireEvent.click(trashSection)
      expect(trashSection.checked).toBe(true)
      expect(dataSection.checked).toBe(false)
      expect(screen.getByText('回收區目前是空的。')).toBeTruthy()

      expect(screen.queryByRole('radio', { name: '系統流程' })).toBeNull()
      expect(screen.queryByRole('figure', { name: '系統作業流程' })).toBeNull()
    })
  })

  it('keeps stored standard versions when the certificate fields are not shown', async () => {
    const state = createPersistedWorkspaceState()
    const iso9001 = state.auditProfile.applicableStandards.find((item) => item.name === 'ISO 9001')!
    const as9100 = state.auditProfile.applicableStandards.find((item) => item.name === 'AS9100')!
    iso9001.version = '2015/Amd 1:2024'
    as9100.version = '2016 (Rev E)'
    seedSettingsLocalStorage(state)
    render(<SystemSettingsPage />)

    expect(screen.queryByLabelText('版本 — ISO 9001')).toBeNull()
    expect(screen.queryByLabelText('版本 — AS9100')).toBeNull()
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      const profile = stored.auditProfile
      const storedIso = profile.applicableStandards.find((item: { name: string }) => item.name === 'ISO 9001')
      const storedAs = profile.applicableStandards.find((item: { name: string }) => item.name === 'AS9100')
      expect(storedIso.version).toBe('2015/Amd 1:2024')
      expect(storedAs.version).toBe('2016 (Rev E)')
    })
  })
})

describe('SettingsPanel recycle bin', () => {
  it('restores a record and reports when it returned to its original list', async () => {
    const state = createPersistedWorkspaceState()
    const target = state.people[0]
    seedSettingsLocalStorage(movePersonToTrash(state, target.id, 'trash-ui-restore', '2026-09-24T01:00:00.000Z'))
    render(<SystemSettingsPage />)

    fireEvent.click(screen.getByRole('radio', { name: /^回收區/ }))

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`還原：${target.name}`) }))

    await waitFor(() => {
      expect(screen.getByText('回收區目前是空的。')).toBeTruthy()
      expect(screen.getByRole('status').textContent).toContain('已還原至原年度與清單位置')
    })
  })

  it('requires confirmation for permanent deletion and leaves data intact when cancelled', async () => {
    const state = createPersistedWorkspaceState()
    const target = state.people[0]
    seedSettingsLocalStorage(movePersonToTrash(state, target.id, 'trash-ui-delete', '2026-09-24T01:00:00.000Z'))
    render(<SystemSettingsPage />)

    fireEvent.click(screen.getByRole('radio', { name: /^回收區/ }))

    const openConfirm = () => fireEvent.click(screen.getByRole('button', { name: new RegExp(`永久清除：${target.name}`) }))
    openConfirm()
    expect(screen.getByRole('alertdialog').textContent).toContain('永久清除後無法還原')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByText(new RegExp(target.name))).toBeTruthy()

    openConfirm()
    fireEvent.click(screen.getByRole('button', { name: /^永久清除$/ }))
    await waitFor(() => expect(screen.getByText('回收區目前是空的。')).toBeTruthy())
  })
})
