import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(onNavigate).toHaveBeenCalledWith('personnel')
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
