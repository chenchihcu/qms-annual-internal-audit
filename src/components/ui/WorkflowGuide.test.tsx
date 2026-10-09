import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createDemoState } from '../../data/demoData'
import { WorkflowGuide } from './WorkflowGuide'

describe('WorkflowGuide', () => {
  it('renders nothing when there are no gaps or advisories', () => {
    const { container } = render(
      <WorkflowGuide tab="system-settings" state={createDemoState()} />,
    )
    expect(container.querySelector('[data-workflow-guide="top"]')).toBeNull()
  })

  it('links gap tab targets when onNavigate is provided', () => {
    const onNavigate = vi.fn()
    const state = createDemoState()
    render(<WorkflowGuide tab="plan" state={state} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: '至人員合格名單' }))
    expect(onNavigate).toHaveBeenCalledWith('personnel', undefined)
  })

  it('passes the deep-link options of a gap to onNavigate', () => {
    const onNavigate = vi.fn()
    const state = createDemoState()
    const dept = state.workspace.departments[0]
    dept.stakeholders = []
    const row = state.workspace.planRows.find((item) => item.departmentId === dept.id)!
    render(<WorkflowGuide tab="plan" state={state} onNavigate={onNavigate} />)
    const line = screen.getByText(/部門利害關係人已標註/).closest('li')!
    fireEvent.click(within(line).getByRole('button', { name: '至年度稽核計畫' }))
    expect(onNavigate).toHaveBeenCalledWith('plan', { recordId: row.id })
  })

  it('keeps the top guide off audit, prep and followups', () => {
    const state = createDemoState()
    const { container, rerender } = render(
      <WorkflowGuide tab="prep" state={state} onNavigate={() => {}} />,
    )
    expect(container.querySelector('[data-workflow-guide="top"]')).toBeNull()
    rerender(<WorkflowGuide tab="followups" state={state} onNavigate={() => {}} />)
    expect(container.querySelector('[data-workflow-guide="top"]')).toBeNull()
    rerender(<WorkflowGuide tab="audit" state={{ ...state, workspace: { ...state.workspace, audits: [] } }} onNavigate={() => {}} />)
    expect(container.querySelector('[data-workflow-guide="top"]')).toBeNull()
  })

  it('keeps workflow gap details off the dashboard', () => {
    const { container } = render(
      <WorkflowGuide tab="dashboard" state={createDemoState()} onNavigate={() => {}} />,
    )
    expect(container.querySelector('[data-workflow-guide="top"]')).toBeNull()
  })
})
