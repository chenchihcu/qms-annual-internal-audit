import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { createDemoState } from '../../data/demoData'
import { Dashboard } from '../Dashboard'

function renderDashboard() {
  const base = createDemoState()
  return render(
    <Dashboard
      state={{ ...base, company: base.companies.jiurun }}
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

    const defaultRows = screen.getAllByRole('button', { name: /^QP-/ })
    expect(defaultRows.length).toBeGreaterThan(0)
    expect(defaultRows.length).toBeLessThan(29)

    fireEvent.click(screen.getByRole('button', { name: '全部' }))
    const allRows = screen.getAllByRole('button', { name: /^QP-/ })
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
    const base = createDemoState()
    render(
      <Dashboard
        state={{ ...base, company: base.companies.jiurun }}
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

    const unscoredButtons = screen
      .getAllByRole('button', { name: /^QP-/ })
      .filter((button) => within(button).queryByText('未計分'))

    expect(unscoredButtons.length).toBeGreaterThan(0)
    for (const button of unscoredButtons) {
      expect(button.querySelector('.rounded-full.bg-slate-100')).toBeNull()
    }
  })
})
