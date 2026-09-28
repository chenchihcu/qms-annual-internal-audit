import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('shows compact annual summary and keeps observation counts separate', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '稽核總覽' })).toBeTruthy()
    })

    expect(screen.getByRole('columnheader', { name: '項目' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '追蹤清單' })).toBeNull()
    expect(screen.getByRole('button', { name: '前往：查檢判定觀察' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '前往：本年度待追蹤觀察' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '前往：前年度未結觀察' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '前往：待追蹤建議' })).toBeTruthy()

    expect(screen.getByText(/已回報 \d+\/\d+ 件/)).toBeTruthy()
    expect(screen.getByText(/計畫項目 \d+\/\d+ 列/)).toBeTruthy()
    for (const label of ['查檢判定觀察', '本年度待追蹤觀察', '前年度未結觀察', '待追蹤建議']) {
      const row = screen.getByRole('button', { name: `前往：${label}` }).closest('tr')
      expect(row?.querySelectorAll('td')[2]?.textContent).toBe('')
    }
    expect(screen.queryByText(/各程序稽核得分/)).toBeNull()
    expect(screen.queryByText(/雙證查檢未判定/)).toBeNull()
    expect(screen.queryByRole('region', { name: '各程序稽核得分統計表' })).toBeNull()
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

  it('keeps each tracking metric linked to its own operational page', async () => {
    const onNavigate = vi.fn()
    renderDashboard(onNavigate)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '前往：前年度未結觀察' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '前往：前年度未結觀察' }))
    expect(onNavigate).toHaveBeenCalledWith('observations', { section: 'prior' })
  })
})
