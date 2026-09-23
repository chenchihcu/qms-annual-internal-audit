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

function renderDashboard() {
  return render(
    <Dashboard
      state={syncedDemoState()}
      onNavigate={() => {}}
    />,
  )
}

describe('Dashboard attention list', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('shows the merged attention card instead of legacy tables', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '程序風險與得分' })).toBeTruthy()
    })

    expect(screen.queryByRole('heading', { name: /稽核重點標示/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: '各程序稽核得分' })).toBeNull()
  })

  it('shows fewer rows by default than the full plan list', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('group', { name: '程序清單篩選' })).toBeTruthy()
    })

    const table = screen.getByRole('table', { name: '程序風險與得分工作表' })
    const defaultRows = within(table).getAllByRole('button')
    expect(defaultRows.length).toBeGreaterThan(0)
    expect(defaultRows.length).toBeLessThan(29)

    fireEvent.click(screen.getByRole('button', { name: '全部' }))
    const allRows = within(table).getAllByRole('button')
    expect(allRows.length).toBeGreaterThan(defaultRows.length)
  })

  it('reveals low-risk rows when switching to all filter', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '全部' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '全部' }))
    expect(screen.getByRole('button', { name: /QP-06 · 管理部/ })).toBeTruthy()
  })

  it('navigates via row click handler for scored demo row', async () => {
    let tab: string | undefined
    render(
      <Dashboard
        state={syncedDemoState()}
        onNavigate={(next) => {
          tab = next
        }}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /QP-16 · 品保部/ })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /QP-16 · 品保部/ }))
    expect(tab).toBe('audit')
  })

  it('does not render score bars for unscored rows', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '全部' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '全部' }))

    const table = screen.getByRole('table', { name: '程序風險與得分工作表' })
    const unscoredRows = within(table)
      .getAllByRole('row')
      .slice(1)
      .filter((row) => within(row).queryByText('未計分'))

    expect(unscoredRows.length).toBeGreaterThan(0)
    unscoredRows.forEach((row) => {
      expect(row.querySelector('.bg-green-500, .bg-amber-500, .bg-red-500')).toBeNull()
    })
  })
})
