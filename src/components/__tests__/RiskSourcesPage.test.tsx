import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from '../../App'

async function openSources() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '風險來源登錄' }))
  return screen.findByRole('region', { name: '外部來源登錄' }, { timeout: 10000 })
}

function checkboxByLabelStart(container: HTMLElement, start: string) {
  return within(container).getAllByRole('checkbox').find((box) => box.closest('label')?.textContent?.startsWith(start))!
}

describe('Risk sources page', () => {
  beforeAll(async () => {
    await import('../RiskSourcesPage')
    await import('../RiskAssessment')
  })

  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('registers a complaint by clicking related procedures and auto-counts it on the risk page', async () => {
    const register = await openSources()
    fireEvent.click(within(register).getByRole('button', { name: '登錄來源' }))
    fireEvent.click(within(register).getByRole('button', { name: '儲存來源' }))
    expect(within(register).getByText('請填外部紀錄編號，供回查原始紀錄。')).toBeTruthy()

    fireEvent.change(within(register).getByLabelText(/外部紀錄編號/), { target: { value: 'CC-2026-007' } })
    fireEvent.change(within(register).getByLabelText(/^日期/), { target: { value: '2026-02-03' } })
    fireEvent.click(checkboxByLabelStart(register, 'QP-21'))
    expect(within(register).getByRole('list', { name: '已選關聯程序' }).textContent).toContain('QP-21')
    fireEvent.click(within(register).getByRole('button', { name: '儲存來源' }))

    const sourceTable = await within(register).findByRole('region', { name: '外部來源登錄一覽' })
    expect(within(sourceTable).getByText('CC-2026-007')).toBeTruthy()
    expect(within(sourceTable).getByText(/已確認・計入/)).toBeTruthy()
    expect(within(sourceTable).getByText(/→ 優先分 \d+/)).toBeTruthy()
    expect(within(register).getByText(/客戶抱怨 1 件・重大變更 0 件・計入關聯 1 筆・待確認 0 筆/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '方案風險' }))
    const table = await screen.findByRole('region', { name: '程序風險評估一覽' }, { timeout: 10000 })
    expect(within(table).getByRole('button', { name: /QP-21 .*客戶抱怨件數：1件（自動・1筆）/ })).toBeTruthy()
  }, 20000)

  it('keeps pending links out of the count and rejects links only with a selected reason', async () => {
    const register = await openSources()
    fireEvent.click(within(register).getByRole('button', { name: '登錄來源' }))
    fireEvent.change(within(register).getByLabelText(/外部紀錄編號/), { target: { value: 'ECN-2026-02' } })
    fireEvent.click(within(register).getByLabelText('重大變更'))
    fireEvent.change(within(register).getByLabelText(/^日期/), { target: { value: '2026-02-03' } })
    fireEvent.click(checkboxByLabelStart(register, 'QP-14'))
    fireEvent.click(within(register).getByLabelText('待確認（暫不計入）'))
    fireEvent.click(within(register).getByRole('button', { name: '儲存來源' }))

    const sourceTable = await within(register).findByRole('region', { name: '外部來源登錄一覽' })
    expect(within(sourceTable).getByText(/待確認・暫不計入/)).toBeTruthy()
    fireEvent.click(within(sourceTable).getByRole('button', { name: '不適用' }))
    const confirm = within(sourceTable).getByRole('button', { name: '判定不適用' })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    fireEvent.change(within(sourceTable).getByLabelText(/不適用理由/), { target: { value: '重複關聯' } })
    fireEvent.click(confirm)
    expect(within(sourceTable).getByText(/不適用・不計入/)).toBeTruthy()
    expect(within(sourceTable).getByText(/（重複關聯）/)).toBeTruthy()
  }, 20000)

  it('declares a category fully registered with one checkbox and suggests links by process type', async () => {
    const register = await openSources()
    const coverage = within(register).getByLabelText(/客戶抱怨已全部登錄至/)
    fireEvent.click(coverage)
    expect((coverage as HTMLInputElement).checked).toBe(true)

    fireEvent.click(within(register).getByRole('button', { name: '登錄來源' }))
    expect(checkboxByLabelStart(register, 'QP-21').closest('label')?.textContent).toContain('建議關聯')
    expect(within(register).getByText(/\d+ 個程序標示「建議關聯」/)).toBeTruthy()
    expect(within(register).queryByRole('combobox', { name: /程序類型/ })).toBeNull()
  }, 20000)
})
