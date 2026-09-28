import { describe, expect, it } from 'vitest'
import type { ChecklistItem } from '../../types'
import {
  createChecklistForProcedure,
  getSeedChecklistQuestions,
  isPendingImportOnlyAudit,
  refreshedSeedItemsIfPendingOnly,
} from '../checklistLoader'

describe('部門種子別名', () => {
  it('開發工程部門主檔名稱可解析 QP-11 種子題', () => {
    const questions = getSeedChecklistQuestions('QP-11', '開發工程')
    expect(questions.length).toBe(7)
    expect(questions[0].category).toContain('PFMEA')
  })

  it('開發工程相關 QP 以開發工程查詢皆有題目', () => {
    for (const qp of ['QP-10', 'QP-13', 'QP-14', 'QP-15']) {
      expect(getSeedChecklistQuestions(qp, '開發工程').length).toBeGreaterThan(0)
    }
  })
})

describe('待匯入占位刷新', () => {
  const placeholder: ChecklistItem[] = [
    {
      id: 'chk-placeholder',
      category: '待匯入',
      no: 1,
      content: '（QP-11 查檢項目待匯入）',
      judgment: null,
      description: '',
    },
  ]

  it('辨識僅含待匯入占位的稽核', () => {
    expect(isPendingImportOnlyAudit(placeholder)).toBe(true)
    expect(
      isPendingImportOnlyAudit([
        ...placeholder,
        {
          id: 'chk-real',
          category: '品質控制計畫',
          no: 2,
          content: '題目',
          judgment: '符合',
          description: '',
        },
      ]),
    ).toBe(false)
  })

  it('可將占位替換為種子題目', () => {
    const refreshed = refreshedSeedItemsIfPendingOnly('QP-11', '開發工程', placeholder)
    expect(refreshed).not.toBeNull()
    expect(refreshed!.length).toBe(7)
    expect(refreshed!.every((item) => item.category !== '待匯入')).toBe(true)
  })

  it('已有判定時不替換', () => {
    const withJudgment: ChecklistItem[] = [
      {
        ...placeholder[0],
        judgment: '符合',
      },
    ]
    expect(refreshedSeedItemsIfPendingOnly('QP-11', '開發工程', withJudgment)).toBeNull()
  })
})

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
