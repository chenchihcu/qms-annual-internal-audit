import { describe, expect, it } from 'vitest'
import { checkImpartiality } from '../impartiality'
import type { DepartmentProfile } from '../../types'

const departments: DepartmentProfile[] = [
  {
    id: 'dept-qa',
    name: '品保部',
    owner: '品保部經理',
    auditUnit: '管理部',
    defaultAuditors: '王稽核',
    stakeholders: [],
    riskOccurrence: 2,
    riskSeverity: 5,
  },
  {
    id: 'dept-admin',
    name: '管理部',
    owner: '管理部主任',
    auditUnit: '品保部',
    defaultAuditors: '王稽核',
    stakeholders: [],
    riskOccurrence: 2,
    riskSeverity: 3,
  },
]

describe('checkImpartiality', () => {
  it('warns when auditor matches audited department owner', () => {
    const warning = checkImpartiality({
      auditors: '品保部經理',
      departmentId: 'dept-qa',
      department: '品保部',
      auditCategory: '型態稽核',
      departments,
    })
    expect(warning).not.toBeNull()
    expect(warning?.message).toContain('品保部經理')
  })

  it('does not warn for external auditor on non-system audit', () => {
    const warning = checkImpartiality({
      auditors: '王稽核',
      departmentId: 'dept-qa',
      department: '品保部',
      auditCategory: '型態稽核',
      departments,
    })
    expect(warning).toBeNull()
  })

  it('warns when auditors field contains audited department name', () => {
    const warning = checkImpartiality({
      auditors: '品保部 張三',
      departmentId: 'dept-qa',
      department: '品保部',
      auditCategory: '製程稽核',
      departments,
    })
    expect(warning).not.toBeNull()
    expect(warning?.message).toContain('品保部')
  })
})
