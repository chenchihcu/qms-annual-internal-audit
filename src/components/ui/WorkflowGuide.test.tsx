import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { createDemoState } from '../../data/demoData'
import { WorkflowGuide } from './WorkflowGuide'

describe('WorkflowGuide', () => {
  it('renders nothing when there are no gaps or advisories', () => {
    const { container } = render(
      <WorkflowGuide tab="system-settings" state={createDemoState()} />,
    )
    expect(container.querySelector('[data-workflow-guide="top"]')).toBeNull()
  })
})
