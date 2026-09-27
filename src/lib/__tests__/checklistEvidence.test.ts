import { describe, expect, it } from 'vitest'
import {
  optionalEvidenceFields,
  visibleEvidenceFields,
} from '../checklistEvidence'
import type { ChecklistItem } from '../../types'

function item(patch: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'item-1',
    category: '一般',
    no: 1,
    content: '查檢內容',
    judgment: null,
    description: '',
    sampleSize: '',
    objectiveEvidence: '',
    notApplicableReason: '',
    ...patch,
  }
}

describe('visibleEvidenceFields', () => {
  it('hides every evidence input before a judgment', () => {
    expect(visibleEvidenceFields(item())).toEqual([])
    expect(optionalEvidenceFields(item())).toEqual([])
  })

  it('shows the fields required to complete each judgment', () => {
    expect(visibleEvidenceFields(item({ judgment: '符合' }))).toEqual(['objectiveEvidence'])
    expect(visibleEvidenceFields(item({ judgment: '不符' }))).toEqual(['description', 'objectiveEvidence'])
    expect(visibleEvidenceFields(item({ judgment: '觀察' }))).toEqual(['description'])
    expect(visibleEvidenceFields(item({ judgment: '不適用' }))).toEqual(['notApplicableReason'])
  })

  it('keeps a filled field visible after the judgment no longer requires it', () => {
    expect(visibleEvidenceFields(item({
      judgment: '觀察',
      objectiveEvidence: 'QR-01',
    }))).toEqual(['description', 'objectiveEvidence'])
  })

  it('shows a blank optional field after the user opens it', () => {
    expect(visibleEvidenceFields(item({ judgment: '符合' }), { description: true }))
      .toEqual(['description', 'objectiveEvidence'])
  })

  it('offers only non-required extras for the current judgment', () => {
    expect(optionalEvidenceFields(item({ judgment: '符合' }))).toEqual(['description', 'sampleSize'])
    expect(optionalEvidenceFields(item({ judgment: '不符' }))).toEqual(['sampleSize'])
    expect(optionalEvidenceFields(item({ judgment: '觀察' }))).toEqual(['sampleSize', 'objectiveEvidence'])
    expect(optionalEvidenceFields(item({ judgment: '不適用' }))).toEqual(['sampleSize'])
  })
})
