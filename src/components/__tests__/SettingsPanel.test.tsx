import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createDemoState } from '../../data/demoData'
import { useAuditStore } from '../../hooks/useAuditStore'
import { SettingsPanel } from '../SettingsPanel'

beforeEach(() => localStorage.clear())

function SystemSettingsPage() {
  const store = useAuditStore()
  return <SettingsPanel store={store} section="system" />
}

function ProcedureSettingsPage() {
  const store = useAuditStore()
  return <SettingsPanel store={store} section="procedure" />
}

describe('SettingsPanel profile feedback', () => {
  it('shows field errors on procedure page without guide duplication', async () => {
    const state = createDemoState()
    localStorage.setItem('qms-annual-internal-audit-v7', JSON.stringify(state))
    render(<ProcedureSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('仍為待確認')).toBeTruthy()
      expect(screen.getByText('尚未填寫')).toBeTruthy()
    })
  })

  it('shows snapshot ready message after completing procedure fields', async () => {
    const state = createDemoState()
    localStorage.setItem('qms-annual-internal-audit-v7', JSON.stringify(state))
    render(<ProcedureSettingsPage />)

    fireEvent.change(screen.getByLabelText('程序版本'), { target: { value: 'Rev.6' } })
    fireEvent.change(screen.getByLabelText('正式紀錄保存位置'), { target: { value: '品保部文件櫃 A-1' } })

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/已寫入。開始稽核時會固定/)
    })
  })
})

describe('SettingsPanel lifecycle counts', () => {
  it('renders work data and traceability count tables with explanatory copy', async () => {
    const state = createDemoState()
    localStorage.setItem('qms-annual-internal-audit-v7', JSON.stringify(state))
    render(<SystemSettingsPage />)

    fireEvent.click(screen.getByText('年度資料生命週期與追溯'))

    await waitFor(() => {
      expect(
        screen.getByText(/系統把「受控來源」、「本年度工作資料」與「已發生的稽核紀錄」分開管理/),
      ).toBeTruthy()
      expect(screen.getByRole('region', { name: '本年度工作資料統計表' })).toBeTruthy()
      expect(screen.getByRole('region', { name: '追溯統計表' })).toBeTruthy()
      expect(screen.getByText('計畫列')).toBeTruthy()
      expect(screen.getByText('已開始事件來源快照')).toBeTruthy()
      expect(screen.getByText('有來源連結的不符合')).toBeTruthy()
      expect(screen.getByText('有來源連結的觀察')).toBeTruthy()
    })
  })
})
