import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoState, migrateToV8, STORAGE_KEY } from '../data/demoData'
import { createChecklistForProcedure } from '../data/checklistLoader'
import { useAuditStore } from '../hooks/useAuditStore'
import { migrateState } from '../lib/migrate'
import { migrateToSingleWorkspace } from '../lib/singleWorkspaceMigration'
import { ProcedureAuditPanel } from './ProcedureAuditPanel'

beforeEach(() => localStorage.clear())

function AuditPage({ selectedKey = 'QP-05|dept-qa' }: { selectedKey?: string }) {
  const store = useAuditStore()
  return <ProcedureAuditPanel store={store} selectedKey={selectedKey} />
}

function createCurrentDemoState() {
  return migrateToSingleWorkspace(migrateState(migrateToV8(createDemoState())))
}

describe('ProcedureAuditPanel', () => {
  it('renders checklist selector and header fields for demo audit', async () => {
    const state = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    render(<AuditPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('查檢表')).toBeTruthy()
      expect(screen.getByLabelText('稽核日期')).toBeTruthy()
      expect(screen.queryByRole('heading', { name: '查檢表' })).toBeNull()
      const stats = screen.getByLabelText('查檢判定統計')
      expect(within(stats).getByText('程序得分')).toBeTruthy()
      expect(within(stats).getByText('未判定')).toBeTruthy()
    })
  })

  it('shows legacy QP-03 seed wording as one shared audit question', async () => {
    const state = createDemoState()
    const company = state.companies[state.activeCompanyId]
    const sourceAudit = company.audits[0]
    company.audits = [
      {
        ...sourceAudit,
        id: 'audit-qp03-single-workspace',
        qpCode: 'QP-03',
        department: '品保部',
        departmentId: 'dept-qa',
        items: createChecklistForProcedure('QP-03', '品保部'),
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<AuditPage selectedKey="QP-03|dept-qa" />)

    await waitFor(() => {
      expect(screen.getAllByText('管理審查紀錄').length).toBeGreaterThan(0)
      expect(screen.getAllByText('組織是否保存管理審查會議紀錄，並涵蓋管理審查輸入事項與決議？').length).toBeGreaterThan(0)
      expect(screen.queryByText(/九潤精密、正隆興精密是否各有一份管理審查會議紀錄/)).toBeNull()
    })
  })

  it.each([
    { status: '規劃中', setupEditable: true, canJudge: false },
    { status: '執行中', setupEditable: false, canJudge: true },
    { status: '已回報', setupEditable: false, canJudge: false },
  ] as const)('enforces editable fields for $status audits', async ({ status, setupEditable, canJudge }) => {
    const state = createCurrentDemoState()
    const company = state.companies[state.activeCompanyId]
    const audit = company.audits.find((item) => item.qpCode === 'QP-28' && item.departmentId === 'dept-qa')!
    audit.id = 'audit-QP-28-dept-qa'
    company.audits = [audit]
    audit.status = status
    audit.notifyDate = '2026-07-30'
    audit.auditDate = '2026-08-14'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<AuditPage selectedKey={`${audit.qpCode}|${audit.departmentId}`} />)

    const auditDate = await screen.findByLabelText('稽核日期') as HTMLInputElement
    expect(screen.queryByLabelText('通知日期')).toBeNull()
    expect(screen.queryByLabelText('客觀性控制措施／依據')).toBeNull()
    await waitFor(() => {
      expect(auditDate.value).toBe(audit.auditDate)
      expect(screen.getByText(status)).toBeTruthy()
    })
    expect(auditDate.disabled).toBe(!setupEditable)

    const judgments = screen.getAllByLabelText('判定') as HTMLSelectElement[]
    expect(judgments.length).toBeGreaterThan(0)
    expect(judgments.every((input) => input.disabled === !canJudge)).toBe(true)

    expect(screen.queryByRole('button', { name: '開始稽核' }) !== null).toBe(status === '規劃中')
    expect(screen.queryByRole('button', { name: '完成回報' }) !== null).toBe(status === '執行中')

    if (status !== '規劃中') {
      fireEvent.click(screen.getByRole('button', { name: / 稽核設定$/ }))
    }

    const setup = screen.getByRole('group', { name: '稽核設定' })
    expect(within(setup).queryByText('對應文件')).toBeNull()
    expect(within(setup).queryByLabelText('客觀性控制措施／依據')).toBeNull()
    expect(within(setup).getByText('稽核人員')).toBeTruthy()
    const impartialityCheckbox = within(setup).getByRole('checkbox', { name: /客觀性風險已確認/ }) as HTMLInputElement
    expect(impartialityCheckbox.disabled).toBe(!setupEditable)
    if (status === '規劃中') {
      expect(within(setup).getByRole('button', { name: '標記已通知' })).toBeTruthy()
    }

    if (status === '執行中') {
      expect(screen.getByText(/日期、人員與客觀性設定已固定/)).toBeTruthy()
    }

    const printHeader = document.querySelector('.qr-header-table')
    expect(printHeader?.textContent).toContain('對應文件')
    expect(printHeader?.textContent).toContain('稽核日期')
    expect(printHeader?.textContent).toContain(audit.qpCode)
    expect(printHeader?.textContent).not.toContain('客觀性控制措施')
  })

  it('prevents starting an audit without an implementation date', async () => {
    const state = createCurrentDemoState()
    const company = state.companies[state.activeCompanyId]
    const audit = company.audits.find((item) => item.qpCode === 'QP-28' && item.departmentId === 'dept-qa')!
    audit.id = 'audit-QP-28-dept-qa'
    company.audits = [audit]
    audit.status = '規劃中'
    audit.auditDate = ''
    audit.notifyDate = '2026-07-30'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<AuditPage selectedKey={`${audit.qpCode}|${audit.departmentId}`} />)
    await waitFor(() => {
      expect(screen.queryByLabelText('通知日期')).toBeNull()
      expect(screen.getByText('規劃中')).toBeTruthy()
    })
    fireEvent.click(await screen.findByRole('button', { name: '開始稽核' }))

    expect((await screen.findByRole('alert')).textContent).toContain('開始稽核前須填寫稽核日期')
    expect(screen.queryByText('未填實施日期')).toBeNull()
    expect(screen.getByText(/未填稽核日期/)).toBeTruthy()
    expect(screen.getByText('規劃中')).toBeTruthy()
  })

  it('resets unsaved report references when changing audit records', async () => {
    const state = createCurrentDemoState()
    const company = state.companies[state.activeCompanyId]
    const audit = company.audits.find((item) => item.qpCode === 'QP-28' && item.departmentId === 'dept-qa')!
    const otherPlan = company.planRows.find((row) => row.qpCode !== audit.qpCode || row.departmentId !== audit.departmentId)!
    audit.id = `audit-${audit.qpCode}-${audit.departmentId}`
    audit.status = '執行中'
    audit.reportReference = ''
    const otherAudit = {
      ...audit,
      id: `audit-${otherPlan.qpCode}-${otherPlan.departmentId}`,
      qpCode: otherPlan.qpCode,
      department: otherPlan.department,
      departmentId: otherPlan.departmentId,
      reportReference: 'REC-B',
      items: createChecklistForProcedure(otherPlan.qpCode, otherPlan.department),
    }
    company.audits = [audit, otherAudit]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    const { rerender } = render(<AuditPage selectedKey={`${audit.qpCode}|${audit.departmentId}`} />)
    const reportReference = await screen.findByLabelText('正式紀錄編號') as HTMLInputElement
    fireEvent.change(reportReference, { target: { value: 'UNSAVED-A' } })
    expect(reportReference.value).toBe('UNSAVED-A')

    rerender(<AuditPage selectedKey={`${otherAudit.qpCode}|${otherAudit.departmentId}`} />)
    await waitFor(() => {
      expect((screen.getByLabelText('正式紀錄編號') as HTMLInputElement).value).toBe('REC-B')
    })
  })

  it('shows evidence fields for the current judgment and keeps saved text', async () => {
    const state = createCurrentDemoState()
    const company = state.companies[state.activeCompanyId]
    const audit = company.audits.find((item) => item.qpCode === 'QP-28' && item.departmentId === 'dept-qa')!
    audit.id = 'audit-QP-28-dept-qa'
    audit.status = '執行中'
    audit.items = [{
      id: 'item-evidence',
      category: '一般',
      no: 1,
      content: '是否保存紀錄',
      judgment: null,
      description: '',
      sampleSize: '',
      objectiveEvidence: '',
      notApplicableReason: '',
      origin: 'seed',
    }]
    company.audits = [audit]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<AuditPage selectedKey="QP-28|dept-qa" />)

    const judgment = await screen.findByLabelText('判定') as HTMLSelectElement
    expect(screen.queryByLabelText('客觀證據')).toBeNull()
    expect(screen.queryByLabelText('發現說明')).toBeNull()
    expect(screen.queryByRole('button', { name: /標不適用/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /移至回收區/ })).toBeNull()

    fireEvent.change(judgment, { target: { value: '符合' } })
    expect(await screen.findByLabelText('客觀證據')).toBeTruthy()
    expect(screen.queryByLabelText('發現說明')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'QP-28 NO 1 加發現說明' }))
    fireEvent.change(await screen.findByLabelText('發現說明'), { target: { value: '現場說明' } })
    fireEvent.change(screen.getByLabelText('客觀證據'), { target: { value: 'QR-01' } })

    fireEvent.change(screen.getByLabelText('判定'), { target: { value: '觀察' } })
    expect(await screen.findByLabelText('發現說明')).toHaveProperty('value', '現場說明')
    expect(screen.getByLabelText('客觀證據')).toHaveProperty('value', 'QR-01')

    fireEvent.change(screen.getByLabelText('判定'), { target: { value: '不適用' } })
    expect(await screen.findByLabelText('不適用理由')).toBeTruthy()
    expect(screen.getByLabelText('發現說明')).toHaveProperty('value', '現場說明')
    expect(screen.getByLabelText('客觀證據')).toHaveProperty('value', 'QR-01')
  })
})
