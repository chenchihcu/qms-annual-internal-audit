import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuditorMultiSelect } from './AuditorMultiSelect'

describe('AuditorMultiSelect', () => {
  it('explains when no auditor matches and preserves the recorded name', () => {
    render(
      <AuditorMultiSelect
        label="稽核人員"
        value="王稽核"
        onChange={() => undefined}
        candidates={[]}
        people={[]}
      />,
    )

    expect(screen.getByRole('status').textContent).toContain('目前沒有符合此次稽核範圍與日期的可指派人員。')
    expect(screen.getByRole('link', { name: '前往人員合格名單' }).getAttribute('href')).toBe(
      '#tab=personnel',
    )
    expect(screen.getByText('目前記錄：王稽核')).toBeTruthy()
    expect(screen.queryByText('已選：王稽核')).toBeNull()
  })

  it('shows the empty state when a compact auditor list is expanded', () => {
    const { container } = render(
      <AuditorMultiSelect
        value="未指派"
        onChange={() => undefined}
        candidates={[]}
        people={[]}
        compact
      />,
    )
    const summary = container.querySelector('summary')
    const details = container.querySelector('details')

    expect(details?.open).toBe(false)
    if (summary) fireEvent.click(summary)
    expect(details?.open).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('目前沒有符合此次稽核範圍與日期的可指派人員。')
  })
})
