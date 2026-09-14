import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  applySpreadsheetImport,
  parseSpreadsheetCsv,
} from '../spreadsheetImport'

const FIXTURE_CSV = `recordType,qpCode,departmentId,no,content,as9100Clause,sampleSize,objectiveEvidence,auditors,riskLevel,process,documents,auditCategory
checklist,QP-16,dept-qa,1,不合格品隔離與標示須完整可追蹤,8.7,5 批,QR-16-01 紀錄,,,,
checklist,QP-28,dept-qa,1,內部稽核計畫與執行須符合程序,9.2,1 份,QR-28-01,,,,
plan,QP-16,dept-qa,,,,,,王稽核,高,製程/最終檢驗,QP-16,系統稽核
`

describe('spreadsheetImport', () => {
  it('parses fixture CSV without fatal errors', () => {
    const parsed = parseSpreadsheetCsv(FIXTURE_CSV)
    expect(parsed.errors).toEqual([])
    expect(parsed.rows.length).toBeGreaterThan(0)
  })

  it('merges checklist and plan rows without wiping NCR or other company', () => {
    const { rows } = parseSpreadsheetCsv(FIXTURE_CSV)
    const base = createDemoState()
    const ncrBefore = base.companies.jiurun.ncrs.length
    const zlxAuditsBefore = base.companies.zhenglongxing.audits.length

    const { state, summary } = applySpreadsheetImport(base, 'jiurun', rows)

    expect(summary.checklistUpdated + summary.checklistAdded).toBeGreaterThan(0)
    expect(summary.planUpdated).toBeGreaterThan(0)
    expect(state.companies.jiurun.ncrs.length).toBe(ncrBefore)
    expect(state.companies.zhenglongxing.audits.length).toBe(zlxAuditsBefore)

    const qp16 = state.companies.jiurun.audits.find(
      (a) => a.qpCode === 'QP-16' && a.departmentId === 'dept-qa',
    )
    expect(qp16?.items.find((i) => i.no === 1)?.content).toContain('隔離')
    expect(qp16?.items.find((i) => i.no === 1)?.as9100Clause).toBe('8.7')

    const plan = state.companies.jiurun.planRows.find(
      (r) => r.qpCode === 'QP-16' && r.departmentId === 'dept-qa',
    )
    expect(plan?.auditors).toBe('王稽核')
  })

  it('reports parse errors for invalid CSV', () => {
    const parsed = parseSpreadsheetCsv('bad,header\nx,y')
    expect(parsed.errors.length).toBeGreaterThan(0)
    expect(parsed.rows).toEqual([])
  })
})
