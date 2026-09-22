import { describe, it, expect } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  applyDepartmentOwnerChange,
  previewDepartmentOwnerChange,
} from '../departmentOwner'
import type { ProcedureAudit } from '../../types'

function makeAudit(
  id: string,
  departmentId: string,
  departmentManager: string,
  items: ProcedureAudit['items'],
): ProcedureAudit {
  return {
    id,
    qpCode: 'QP-01',
    departmentId,
    department: '品保部',
    process: '測試',
    documents: 'QP-01',
    notifyDate: '',
    auditDate: '',
    departmentManager,
    auditors: '稽核員',
    auditCategory: '系統稽核',
    items,
  }
}

describe('departmentOwner', () => {
  it('preview counts plan rows and audits by completion', () => {
    const state = createDemoState()
    const preview = previewDepartmentOwnerChange(
      state,
      'dept-qa',
      '新主管',
      state.settings.scoringRules,
    )
    expect(preview).not.toBeNull()
    expect(preview!.planRowCount).toBeGreaterThan(0)
    expect(preview!.changed).toBe(true)
  })

  it('apply updates department, plan rows, and open audits only', () => {
    const state = createDemoState()
    const scoredItem = { id: 'i1', category: 'c', no: 1, content: 'x', judgment: '符合' as const, description: '' }
    const openItem = { id: 'i2', category: 'c', no: 1, content: 'y', judgment: null, description: '' }

    state.company.audits.push(
      makeAudit('audit-scored', 'dept-qa', '陳智富', [scoredItem]),
      makeAudit('audit-open', 'dept-qa', '陳智富', [openItem]),
    )

    const next = applyDepartmentOwnerChange(
      state,
      'dept-qa',
      '王小明',
      state.settings.scoringRules,
    )

    const dept = next.company.departments.find((d) => d.id === 'dept-qa')
    expect(dept?.owner).toBe('王小明')
    expect(next.company.planRows.every((r) => r.departmentId !== 'dept-qa' || r.owner === '王小明')).toBe(
      true,
    )

    const scored = next.company.audits.find((a) => a.id === 'audit-scored')
    const open = next.company.audits.find((a) => a.id === 'audit-open')
    expect(scored?.departmentManager).toBe('陳智富')
    expect(open?.departmentManager).toBe('王小明')
  })

  it('no-op when trimmed owner unchanged', () => {
    const state = createDemoState()
    const dept = state.company.departments.find((d) => d.id === 'dept-qa')!
    const next = applyDepartmentOwnerChange(
      state,
      'dept-qa',
      `  ${dept.owner}  `,
      state.settings.scoringRules,
    )
    expect(next).toBe(state)
  })

  it('does not affect other departments', () => {
    const state = createDemoState()
    const adminBefore = state.company.departments.find((d) => d.id === 'dept-admin')!.owner
    const next = applyDepartmentOwnerChange(
      state,
      'dept-qa',
      '新主管',
      state.settings.scoringRules,
    )
    const adminAfter = next.company.departments.find((d) => d.id === 'dept-admin')!.owner
    expect(adminAfter).toBe(adminBefore)
  })
})
