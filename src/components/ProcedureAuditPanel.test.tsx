import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoState } from '../data/demoData'
import { useAuditStore } from '../hooks/useAuditStore'
import { ProcedureAuditPanel } from './ProcedureAuditPanel'

beforeEach(() => localStorage.clear())

function AuditPage() {
  const store = useAuditStore()
  return <ProcedureAuditPanel store={store} selectedKey="QP-05|dept-qa" />
}

describe('ProcedureAuditPanel', () => {
  it('renders checklist selector and header fields for demo audit', async () => {
    const state = createDemoState()
    localStorage.setItem('qms-annual-internal-audit-v7', JSON.stringify(state))
    render(<AuditPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('查檢表')).toBeTruthy()
      expect(screen.getByLabelText('實施日期')).toBeTruthy()
      expect(screen.getByRole('heading', { name: '內部稽核查檢表（QR-28-02）' })).toBeTruthy()
    })
  })
})
