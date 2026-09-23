import { describe, expect, it } from 'vitest'
import { createChecklistForProcedure, getSeedChecklistQuestions } from '../checklistLoader'

describe('共用查檢題目基準', () => {
  it('以共用題目產生新的表單快照，編輯快照不反向修改基準', () => {
    const shared = getSeedChecklistQuestions('QP-28', '品保部')
    expect(shared.length).toBeGreaterThan(0)
    const revised = shared.map((question, index) =>
      index === 0 ? { ...question, content: '共用修訂題目' } : question,
    )
    const first = createChecklistForProcedure('QP-28', '品保部', revised)
    const second = createChecklistForProcedure('QP-28', '品保部', revised)
    first[0].content = '九潤表單快照修改'

    expect(second[0].content).toBe('共用修訂題目')
    expect(revised[0].content).toBe('共用修訂題目')
    expect(getSeedChecklistQuestions('QP-28', '品保部')[0].content).toBe(shared[0].content)
  })
})
