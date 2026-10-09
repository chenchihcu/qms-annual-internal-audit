import { describe, expect, it } from 'vitest'
import type { PlanRow } from '../../types'
import { procedureRelatedDepartments } from '../procedureDepartments'

const row = (qpCode: string, department: string): PlanRow => ({ qpCode, department } as PlanRow)

describe('procedureRelatedDepartments', () => {
  it('lists every planned department of the procedure in plan order without duplicates', () => {
    const rows = [row('QP-16', '品保部'), row('QP-01', '管理部'), row('QP-16', '業務部'), row('QP-16', '品保部 ')]
    expect(procedureRelatedDepartments('QP-16', rows)).toEqual(['品保部', '業務部'])
  })

  it('returns an empty list when the procedure is not in the plan', () => {
    expect(procedureRelatedDepartments('QP-99', [row('QP-01', '管理部'), row('QP-02', '')])).toEqual([])
  })
})
