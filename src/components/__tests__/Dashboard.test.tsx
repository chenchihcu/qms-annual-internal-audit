import { describe, it, expect, beforeEach } from 'vitest'
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

  it('shows focus and score sections from the integrated dashboard', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '稽核重點標示（QR-28-01 概覽）' })).toBeTruthy()
    })

    expect(screen.getByRole('heading', { name: '各程序稽核得分' })).toBeTruthy()
  })

  it('renders scored procedure rows with navigation handler', async () => {
    let tab: string | undefined
    renderDashboard((next) => {
      tab = next
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /QP-16 · 品保部/ })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /QP-16 · 品保部/ }))
    expect(tab).toBe('audit')
  })

  it('lists incomplete procedures separately from scored rows', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/未完成程序（/)).toBeTruthy()
    })
  })

  it('does not render score bars for incomplete procedures', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/未完成程序（/)).toBeTruthy()
    })

    const incompleteSection = screen.getByText(/未完成程序（/).closest('div')
    expect(incompleteSection?.querySelector('.bg-green-500, .bg-amber-500, .bg-red-500')).toBeNull()
  })
})
