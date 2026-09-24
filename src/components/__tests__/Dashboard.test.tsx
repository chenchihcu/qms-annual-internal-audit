import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { createDemoState } from '../../data/demoData'
import { companySettingsFor } from '../../types'
import { Dashboard } from '../Dashboard'

function syncedDemoState() {
  const base = createDemoState()
  const companyId = base.activeCompanyId
  return {
    ...base,
    settings: companySettingsFor(base, companyId),
    company: base.companies[companyId],
  }
}

function renderDashboard(onNavigate: (tab: string) => void = () => {}) {
  return render(
    <Dashboard
      state={syncedDemoState()}
      onNavigate={onNavigate}
    />,
  )
}

describe('Dashboard attention list', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('shows annual metrics and score tables', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '年度指標' })).toBeTruthy()
    })

    expect(screen.getByRole('heading', { name: '各程序稽核得分' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '稽核重點標示（QR-28-01 概覽）' })).toBeNull()
    const metricsTable = screen.getByRole('region', { name: '年度指標統計表' })
    expect(within(metricsTable).getByText('系統稽核')).toBeTruthy()
    expect(within(metricsTable).getByText('製程稽核')).toBeTruthy()
    expect(within(metricsTable).getByText('型態稽核')).toBeTruthy()
    expect(within(metricsTable).queryByText('計畫程序列數')).toBeNull()
    const systemRow = within(metricsTable).getByText('系統稽核').closest('tr')
    expect(systemRow).toBeTruthy()
    expect(within(systemRow as HTMLElement).getByText('—')).toBeTruthy()
  })

  it('renders scored procedure rows with navigation handler', async () => {
    let tab: string | undefined
    renderDashboard((next) => {
      tab = next
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '開啟 QP-16 · 品保部' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '開啟 QP-16 · 品保部' }))
    expect(tab).toBe('audit')
  })

  it('lists incomplete procedures with status column in score table', async () => {
    renderDashboard()

    const scoreTable = await screen.findByRole('region', { name: '各程序稽核得分統計表' })
    await waitFor(() => {
      expect(within(scoreTable).getAllByText('未完成').length).toBeGreaterThan(0)
      expect(within(scoreTable).getAllByText('已評').length).toBeGreaterThan(0)
    })
  })
})
