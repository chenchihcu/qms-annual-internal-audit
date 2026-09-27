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
    render(<WorkflowGuide tab="dashboard" state={state} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: '至標準' }))
    expect(onNavigate).toHaveBeenCalledWith('standard')
  })
})
