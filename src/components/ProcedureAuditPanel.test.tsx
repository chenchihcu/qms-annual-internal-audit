import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createChecklistForProcedure } from '../data/checklistLoader'
import { createDemoState, STORAGE_KEY } from '../data/demoData'
import { useAuditStore } from '../hooks/useAuditStore'
import { ProcedureAuditPanel } from './ProcedureAuditPanel'

beforeEach(() => localStorage.clear())

function AuditPage() {
  const store = useAuditStore()
  return <ProcedureAuditPanel store={store} selectedKey="QP-05|dept-qa" />
}

describe('同場稽核表頭', () => {
  it('另一家公司日期只套入空白欄，不帶入判定與人員快照', async () => {
    const state = createDemoState()
    const row = state.sharedPlanRows!.find((plan) => plan.qpCode === 'QP-05' && plan.departmentId === 'dept-qa')!
    const items = createChecklistForProcedure(row.qpCode, row.department)
    items[0].judgment = '符合'
    state.companies.jiurun.audits.push({
      id: `audit-${row.qpCode}-${row.departmentId}`,
      qpCode: row.qpCode,
      departmentId: row.departmentId,
      department: row.department,
      process: row.process,
      documents: row.documents,
      notifyDate: '2026-05-01',
      auditDate: '2026-05-15',
      departmentManager: row.owner,
      auditors: '九潤實際稽核員',
      auditCategory: row.auditCategory,
      items,
    })
    state.activeCompanyId = 'zhenglongxing'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    render(<AuditPage />)

    fireEvent.click(await screen.findByRole('button', { name: '套用另一家公司日期' }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      const target = saved.companies.zhenglongxing.audits.find((audit: { qpCode: string }) => audit.qpCode === 'QP-05')
      expect(target.notifyDate).toBe('2026-05-01')
      expect(target.auditDate).toBe('2026-05-15')
      expect(target.auditors).toBe(row.auditors)
      expect(target.items[0].judgment).toBeNull()
      expect(saved.companies.jiurun.audits.find((audit: { qpCode: string }) => audit.qpCode === 'QP-05').auditors)
        .toBe('九潤實際稽核員')
    })

    fireEvent.change(screen.getByLabelText('實施日期'), { target: { value: '2026-05-16' } })
    expect(await screen.findByText(/兩家公司日期不同/)).toBeTruthy()
  })
})
