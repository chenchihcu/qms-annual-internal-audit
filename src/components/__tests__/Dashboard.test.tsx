import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { createDemoState } from '../../data/demoData'
import { companySettingsFor } from '../../types'
import { Dashboard } from '../Dashboard'

function syncedDemoState() {
  const base = createDemoState()
  return {
    ...base,
    settings: companySettingsFor(base),
    company: base.workspace,
  }
}

function renderDashboard() {
  return render(<Dashboard state={syncedDemoState()} />)
}

describe('Dashboard attention list', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('shows compact annual summary and keeps observation counts separate', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '稽核總覽' })).toBeTruthy()
    })

    expect(screen.getByRole('columnheader', { name: '項目' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: '結果' })).toBeTruthy()
    expect(screen.getByText('查檢判定觀察')).toBeTruthy()
    expect(screen.getByText('本年度待追蹤觀察')).toBeTruthy()
    expect(screen.getByText('前年度未結觀察')).toBeTruthy()
    expect(screen.getByText('待追蹤建議')).toBeTruthy()
    expect(screen.getByText('內部稽核')).toBeTruthy()
    expect(screen.getByText('管審日期')).toBeTruthy()
    expect(screen.getByText('管審前置')).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: '操作' })).toBeNull()
    expect(screen.queryByRole('link', { name: '至稽核總覽' })).toBeNull()
    expect(screen.queryByRole('link', { name: '至年度稽核計畫' })).toBeNull()
    expect(screen.getByText(/已回報 \d+\/\d+ 件/)).toBeTruthy()
    expect(screen.getByText(/計畫項目 \d+\/\d+ 列/)).toBeTruthy()
    expect(screen.queryByText(/各程序稽核得分/)).toBeNull()
    expect(screen.queryByText(/雙證查檢未判定/)).toBeNull()
    expect(screen.queryByText(/尚有 \d+ 項缺口/)).toBeNull()
  })

  it('shows management-review gaps on the overview without page shortcuts', () => {
    const base = createDemoState()
    base.externalAuditPrep.externalAuditDate = '2026-09-15'
    base.settings.managementReviewDate = '2026-12-10'
    base.settings.externalAuditDate = undefined
    render(
      <Dashboard
        state={{
          ...base,
          settings: { ...companySettingsFor(base), managementReviewDate: '2026-12-10', externalAuditDate: undefined },
          company: base.workspace,
        }}
      />,
    )

    const overview = screen.getByRole('region', { name: '稽核總覽' })
    expect(within(overview).getByText('2026-12-10')).toBeTruthy()
    expect(within(overview).getByText('尚缺')).toBeTruthy()
    expect(within(overview).getByText('完成當年度內部稽核；將管審日期調整至外稽日期前')).toBeTruthy()
    expect(within(overview).queryByRole('link', { name: '至年度稽核計畫' })).toBeNull()
    expect(within(overview).queryByRole('link', { name: '至稽核總覽' })).toBeNull()
  })

  it('does not send dashboard data to a local debug collector', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    try {
      renderDashboard()
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
