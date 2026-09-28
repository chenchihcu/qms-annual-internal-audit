import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from '../../App'

describe('Annual plan QP row', () => {
  beforeAll(async () => {
    await import('../AnnualPlan')
  })

  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('places the checklist link and detail control on the same row', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '年度稽核計畫' }))

    const table = await screen.findByRole('region', { name: '年度稽核計畫月格表' }, { timeout: 10000 })
    const link = within(table).getByRole('link', { name: 'QP-03 品保部 查檢表' })
    const detail = within(table).getByRole('button', { name: 'QP-03 品保部 明細' })
    expect(link.parentElement).toBe(detail.parentElement)
    expect(link.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }, 15000)
})
