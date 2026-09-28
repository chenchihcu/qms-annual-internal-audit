import { describe, it, expect } from 'vitest'
import { backfillCertificateScopeForItem, ncrCompanyScopeLabel } from '../certificateScope'
import type { ChecklistItem } from '../../types'

describe('ncrCompanyScopeLabel', () => {
  it('hides the shared scope and keeps a legacy company name', () => {
    expect(ncrCompanyScopeLabel(undefined)).toBe('')
    expect(ncrCompanyScopeLabel('both')).toBe('')
    expect(ncrCompanyScopeLabel('jiurun')).toBe('九潤')
    expect(ncrCompanyScopeLabel('zhenglongxing')).toBe('正隆興')
  })
})

describe('backfillCertificateScopeForItem', () => {
  it('normalizes a legacy checklist item to one shared judgment', () => {
    const item: ChecklistItem = {
      id: 'chk-legacy',
      category: '管理代表',
      no: 4,
      content: '雙證項',
      judgment: '符合',
      description: '',
      origin: 'seed',
    }
    const updated = backfillCertificateScopeForItem(item, 'QP-01', '品保部')
    expect(updated.certificateScope).toBe('shared')
    expect(updated.judgment).toBe('符合')
    expect(updated).not.toHaveProperty('judgmentByCompany')
  })

  it('leaves custom items unchanged', () => {
    const item: ChecklistItem = {
      id: 'chk-custom',
      category: '自訂',
      no: 99,
      content: '自訂',
      judgment: null,
      description: '',
      origin: 'custom',
    }
    expect(backfillCertificateScopeForItem(item, 'QP-01', '品保部')).toEqual({
      ...item,
      certificateScope: 'shared',
    })
  })
})
