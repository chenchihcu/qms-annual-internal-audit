import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ALL_TABS, NAV_TABS } from '../../lib/navigation'
import { DUAL_COMPANY_LABEL } from '../../types'
import { AppShell } from '../AppShell'

function renderShell(tab: (typeof ALL_TABS)[number]['id'] = 'settings') {
  const onNavigate = vi.fn()
  render(
    <AppShell
      tab={tab}
      onNavigate={onNavigate}
      companyName={DUAL_COMPANY_LABEL}
      auditYear={2026}
      leadAuditor="王稽核"
      savedLabel={null}
      loadWarning={null}
      saveError={null}
      isDark={false}
      onToggleTheme={vi.fn()}
      onPrint={vi.fn()}
    >
      <div>頁面內容</div>
    </AppShell>,
  )
  return { onNavigate }
}

describe('AppShell', () => {
  it('renders workflow-ordered flat tabs and no company switcher', () => {
    renderShell()
    const nav = screen.getByRole('navigation', { name: '主要分頁' })
    expect(nav).toBeTruthy()
    expect(screen.queryByLabelText('切換公司')).toBeNull()
    expect(screen.queryByRole('button', { name: '九潤精密' })).toBeNull()
    expect(screen.queryByRole('button', { name: '正隆興精密' })).toBeNull()
    for (const t of ALL_TABS) {
      expect(screen.getByRole('button', { name: t.label })).toBeTruthy()
    }
    const labels = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent)
    expect(labels).toEqual(NAV_TABS.map((t) => t.label))
  })

  it('marks the active tab with aria-current and phase color', () => {
    renderShell('plan')
    const planBtn = screen.getByRole('button', { name: '年度計畫' })
    expect(planBtn.getAttribute('aria-current')).toBe('page')
    expect(planBtn.className).toContain('bg-indigo-600')
  })

  it('navigates when a tab is clicked', () => {
    const { onNavigate } = renderShell('settings')
    fireEvent.click(screen.getByRole('button', { name: '儀表板' }))
    expect(onNavigate).toHaveBeenCalledWith('dashboard')
  })
})
