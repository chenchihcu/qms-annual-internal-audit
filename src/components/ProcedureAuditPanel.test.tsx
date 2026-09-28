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

  it('folds matching documents into the procedure cell', async () => {
    const state = createCurrentDemoState()
    const company = state.companies[state.activeCompanyId]
    const audit = company.audits.find((item) => item.qpCode === 'QP-03') ?? company.audits[0]
    audit.id = 'audit-QP-03-dept-qa'
    audit.qpCode = 'QP-03'
    audit.department = '品保部'
    audit.departmentId = 'dept-qa'
    audit.process = '品質目標及管理審查管理程序'
    audit.documents = 'QP-03'
    audit.status = '規劃中'
    company.audits = [audit]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<AuditPage selectedKey="QP-03|dept-qa" />)
    const setup = await screen.findByRole('group', { name: '稽核設定' })
    const selector = screen.getByLabelText('查檢表') as HTMLSelectElement
    expect(selector.selectedOptions[0]?.textContent).toContain('QP-03 品質目標及管理審查管理程序')
    expect(within(setup).queryByText('稽核流程 (QP)')).toBeNull()
    expect(within(setup).queryByText(/品質目標及管理審查管理程序/)).toBeNull()
    expect(within(setup).queryByText(/對應文件/)).toBeNull()
    expect(within(setup).getByLabelText('稽核日期')).toBeTruthy()
  })

  it('keeps a distinct document on the procedure cell', async () => {
    const state = createCurrentDemoState()
    const company = state.companies[state.activeCompanyId]
    const audit = company.audits[0]
    audit.id = 'audit-QP-03-dept-qa'
    audit.qpCode = 'QP-03'
    audit.department = '品保部'
    audit.departmentId = 'dept-qa'
    audit.process = '品質目標及管理審查管理程序'
    audit.documents = 'QR-28-04'
    audit.status = '規劃中'
    company.audits = [audit]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<AuditPage selectedKey="QP-03|dept-qa" />)
    const setup = await screen.findByRole('group', { name: '稽核設定' })
    expect(within(setup).queryByText('稽核流程 (QP)')).toBeNull()
    expect(within(setup).getByText('對應文件')).toBeTruthy()
    expect(within(setup).getByText('QR-28-04')).toBeTruthy()
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

    expect(screen.queryByLabelText('客觀性控制措施／依據')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /客觀性風險已確認/ })).toBeNull()

    if (status === '執行中') {
      expect(screen.getByText(/日期、人員與客觀性設定已固定/)).toBeTruthy()
    }
  })

  it('shows the impartiality checkbox only when an assignee belongs to the audited department', async () => {
    const state = createCurrentDemoState()
    const company = state.companies[state.activeCompanyId]
    const audit = company.audits.find((item) => item.qpCode === 'QP-03' && item.departmentId === 'dept-qa')
      ?? company.audits[0]
    const sameDepartment = state.people.find((person) => person.affiliations.some(
      (affiliation) => affiliation.departmentId === 'dept-qa',
    ))
    const otherDepartment = state.people.find((person) => person.affiliations.some(
      (affiliation) => affiliation.departmentId && affiliation.departmentId !== 'dept-qa',
    ))
    if (!sameDepartment || !otherDepartment) throw new Error('demo people missing department affiliations')
    audit.id = 'audit-QP-03-dept-qa'
    audit.qpCode = 'QP-03'
    audit.departmentId = 'dept-qa'
    audit.status = '規劃中'
    audit.team = {
      leadAuditorPersonId: sameDepartment.id,
      auditorPersonIds: [],
      escortPersonIds: [],
      impartialityConfirmed: false,
      impartialityNote: '既有依據',
    }
    company.audits = [audit]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    const { unmount } = render(<AuditPage selectedKey="QP-03|dept-qa" />)
    const checkbox = await screen.findByRole('checkbox', { name: /客觀性風險已確認/ }) as HTMLInputElement
    expect(checkbox.disabled).toBe(false)
    expect(checkbox.checked).toBe(false)
    expect(screen.queryByLabelText('客觀性控制措施／依據')).toBeNull()
    fireEvent.click(checkbox)
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      const savedAudit = saved.companies?.[saved.activeCompanyId]?.audits?.find(
        (item: { id: string }) => item.id === audit.id,
      )
      expect(savedAudit?.team?.impartialityConfirmed).toBe(true)
      expect(savedAudit?.team?.impartialityNote).toBe('既有依據')
    })
    unmount()

    audit.team = {
      ...audit.team,
      leadAuditorPersonId: otherDepartment.id,
      impartialityConfirmed: false,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    const otherDepartmentView = render(<AuditPage selectedKey="QP-03|dept-qa" />)
    await screen.findByLabelText('稽核日期')
    expect(screen.queryByRole('checkbox', { name: /客觀性風險已確認/ })).toBeNull()
    expect(screen.queryByLabelText('客觀性控制措施／依據')).toBeNull()
    otherDepartmentView.unmount()

    audit.status = '執行中'
    audit.team = {
      leadAuditorPersonId: sameDepartment.id,
      auditorPersonIds: [],
      escortPersonIds: [],
      impartialityConfirmed: true,
      impartialityNote: '既有依據',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    render(<AuditPage selectedKey="QP-03|dept-qa" />)
    fireEvent.click(await screen.findByRole('button', { name: /稽核設定$/ }))
    const lockedCheckbox = await screen.findByRole('checkbox', { name: /客觀性風險已確認/ }) as HTMLInputElement
    expect(lockedCheckbox.disabled).toBe(true)
    expect(lockedCheckbox.checked).toBe(true)
    expect(screen.queryByLabelText('客觀性控制措施／依據')).toBeNull()
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
