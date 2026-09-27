import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createDemoState, STORAGE_KEY } from '../../data/demoData'
import { movePersonToTrash } from '../../lib/trash'
import { useAuditStore } from '../../hooks/useAuditStore'
import { SettingsPanel } from '../SettingsPanel'

beforeEach(() => localStorage.clear())

function SystemSettingsPage() {
  const store = useAuditStore()
  return <SettingsPanel store={store} />
}

describe('SettingsPanel profile feedback', () => {
  it('shows incomplete profile data as guidance within system settings', async () => {
    const state = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    render(<SystemSettingsPage />)

    await waitFor(() => {
        expect(screen.getByText('仍為待確認')).toBeTruthy()
        expect(screen.getByText('至少一項適用標準須標為已確認').getAttribute('role')).toBe('status')
        expect(screen.getByLabelText('證書範圍').getAttribute('aria-invalid')).toBeNull()
      expect(screen.getAllByText('尚未填寫').length).toBeGreaterThan(0)
      expect(screen.getByRole('heading', { name: '稽核基本資料' })).toBeTruthy()
      expect(screen.getByText('進階評分設定')).toBeTruthy()
      expect(screen.getByRole('radiogroup', { name: '系統設定區塊' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: '清除全部資料' })).toBeNull()
    })
  })

  it('shows snapshot ready message after completing required profile fields', async () => {
    const state = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    render(<SystemSettingsPage />)

    expect(screen.queryByLabelText(/依據引用.*ISO 9001/)).toBeNull()
    expect(screen.queryByLabelText(/依據引用.*AS9100/)).toBeNull()
    expect(screen.getByText('AS9100 證書同時涵蓋 ISO 9001；證書範圍與引用共用一次。各標準版本及適用性仍分別確認。')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('適用性 — ISO 9001'), { target: { value: 'confirmed' } })
    fireEvent.change(screen.getByLabelText('證書範圍'), { target: { value: '精密零件製造' } })
    fireEvent.change(screen.getByLabelText('證書編號／引用'), { target: { value: 'CERT-001' } })
    fireEvent.change(screen.getByLabelText('程序版本'), { target: { value: 'Rev.6' } })
    fireEvent.change(screen.getByLabelText('正式紀錄保存位置'), { target: { value: '品保部文件櫃 A-1' } })
    fireEvent.change(screen.getByLabelText('稽核程序代碼'), { target: { value: 'QP-28' } })

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/已寫入。開始稽核時會固定/)
    })
  })
})

describe('SettingsPanel sections', () => {
  it('separates audit data, data protection, and recycle bin actions', async () => {
    const state = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    render(<SystemSettingsPage />)

    expect(screen.getByRole('heading', { name: '稽核基本資料' })).toBeTruthy()
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
    })
  })

  it('does not turn a blank scoring value into zero', async () => {
    const state = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    render(<SystemSettingsPage />)

    const scoringSettings = screen.getByText('進階評分設定').closest('details')!
    scoringSettings.open = true
    expect(scoringSettings.open).toBe(true)
    const conform = scoringSettings.querySelector('input[type="number"]') as HTMLInputElement
    expect(conform).toBeTruthy()
    expect(scoringSettings.querySelector(`label[for="${conform.id}"]`)?.textContent).toContain('符合得分')
    fireEvent.change(conform, { target: { value: '' } })
    fireEvent.blur(conform)

    expect(await screen.findByText('請輸入 0 或更高的有效數值')).toBeTruthy()
    expect(conform.value).toBe('')
    expect(screen.queryByRole('status', { name: '評分規則已寫入' })).toBeNull()
  })

  it('flags a stored ISO 9001:2015 version without changing the saved value', async () => {
    const state = createDemoState()
    for (const companyId of ['jiurun', 'zhenglongxing'] as const) {
      const iso9001 = state.companyAuditProfiles[companyId].applicableStandards.find((item) => item.name === 'ISO 9001')!
      iso9001.version = '2015/Amd 1:2024'
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    render(<SystemSettingsPage />)

    expect(await screen.findByText(/ISO 9001:2026 已發布/)).toBeTruthy()
    const versionInput = screen.getByLabelText('版本 — ISO 9001') as HTMLInputElement
    expect(versionInput.value).toBe('2015/Amd 1:2024')

    fireEvent.change(versionInput, { target: { value: '2026' } })
    await waitFor(() => expect(screen.queryByText(/ISO 9001:2026 已發布/)).toBeNull())
  })
})

describe('SettingsPanel recycle bin', () => {
  it('restores a record and reports when it returned to its original list', async () => {
    const state = createDemoState()
    const target = state.people[0]
    const trashed = movePersonToTrash(state, target.id, 'trash-ui-restore', '2026-09-24T01:00:00.000Z')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trashed))
    render(<SystemSettingsPage />)

    fireEvent.click(screen.getByRole('radio', { name: /^回收區/ }))

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`還原：${target.name}`) }))

    await waitFor(() => {
      expect(screen.getByText('回收區目前是空的。')).toBeTruthy()
      expect(screen.getByRole('status').textContent).toContain('已還原至原年度與清單位置')
    })
  })

  it('requires confirmation for permanent deletion and leaves data intact when cancelled', async () => {
    const state = createDemoState()
    const target = state.people[0]
    const trashed = movePersonToTrash(state, target.id, 'trash-ui-delete', '2026-09-24T01:00:00.000Z')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trashed))
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
