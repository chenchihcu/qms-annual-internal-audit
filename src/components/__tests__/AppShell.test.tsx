import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ALL_TABS } from '../../lib/navigation'
import { COMPANY_LABELS } from '../../types'
import { AppShell } from '../AppShell'

function renderShell(tab: (typeof ALL_TABS)[number]['id'] = 'dashboard') {
  const onNavigate = vi.fn()
  render(
    <AppShell
      tab={tab}
      onNavigate={onNavigate}
      companyName={COMPANY_LABELS.jiurun}
      auditYear={2026}
      leadAuditor="王稽核"
      savedLabel={null}
      loadWarning={null}
      saveError={null}
      actionError={null}
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
    const labels = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent?.trim())
    expect(labels).toEqual(ALL_TABS.map((t) => t.label))
  })

  it('marks the active tab with aria-current', () => {
    renderShell('plan')
    const planBtn = screen.getByRole('button', { name: '年度稽核計畫' })
    expect(planBtn.getAttribute('aria-current')).toBe('page')
    expect(planBtn.className).toContain('bg-blue-50')
  })

  it('navigates when a tab is clicked', () => {
    const { onNavigate } = renderShell('dashboard')
    fireEvent.click(screen.getByRole('button', { name: '標準' }))
    expect(onNavigate).toHaveBeenCalledWith('standard')
  })

  it('toggles the sidebar from a labelled control and closes it after navigation', () => {
    const { onNavigate } = renderShell('dashboard')
    const toggle = screen.getByRole('button', { name: '開啟選單' })
    expect(toggle.getAttribute('aria-controls')).toBe('app-nav')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: '關閉選單' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '標準' }))
    expect(onNavigate).toHaveBeenCalledWith('standard')
    expect(screen.getByRole('button', { name: '開啟選單' }).getAttribute('aria-expanded')).toBe('false')
  })
})
