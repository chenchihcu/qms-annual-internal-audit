import { describe, it, expect } from 'vitest'
import { backfillCertificateScopeForItem } from '../certificateScope'
import type { ChecklistItem } from '../../types'

describe('backfillCertificateScopeForItem', () => {
  it('upgrades legacy QP-01 item 4 to dual scope', () => {
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
    expect(updated.certificateScope).toBe('dual')
    expect(updated.judgmentByCompany).toEqual({
      jiurun: '符合',
      zhenglongxing: '符合',
    })
    expect(updated.judgment).toBeNull()
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
    expect(backfillCertificateScopeForItem(item, 'QP-01', '品保部')).toBe(item)
  })
})
