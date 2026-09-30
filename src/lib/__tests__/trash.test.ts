import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import type { ChecklistItem, NCR, Observation, OnsiteAuditSlot, Person, ThirdPartySuggestion } from '../../types'
import {
  isGeneratedRecordPermanentlyDeleted,
  moveChecklistItemToTrash,
  moveCompanyRecordToTrash,
  moveOnsiteSlotToTrash,
  movePersonToTrash,
  permanentlyDeleteTrashRecord,
  restoreTrashRecord,
} from '../trash'

function ncr(id: string): NCR {
  return {
    id,
    ncrNumber: `NCR-${id}`,
    qpCode: 'QP-01',
    departmentId: 'dept-qa',
    department: '品保部',
    process: '品質管理',
    description: id,
    date: '2026-01-01',
    status: '開立',
    rootCause: '',
    correctiveAction: '',
    verificationEvidence: '',
  }
}

function observation(id: string): Observation {
  return {
    id,
    year: 2024,
    qpCode: 'QP-01',
    departmentId: 'dept-qa',
    department: '品保部',
    process: '品質管理',
    content: id,
    description: '',
    status: 'open',
  }
}

function suggestion(id: string): ThirdPartySuggestion {
  return {
    id,
    year: 2026,
    procedure: 'QP-01',
    issue: id,
    progress: '',
    responsibleUnit: '品保部',
    status: 'open',
  }
}

function person(id: string): Person {
  return {
    id,
    name: id,
    employeeNumber: '',
    type: 'internal',
    affiliations: [],
    qualifications: [],
    appointments: [],
    active: true,
    notes: '',
  }
}

function slot(id: string): OnsiteAuditSlot {
  return {
    id,
    date: '2026-09-15',
    startTime: '09:00',
    endTime: '10:00',
    site: 'both',
    qpCodes: [],
    productModels: [],
    escortPersonIds: [],
    note: id,
  }
}

function checklistItem(id: string, no: number): ChecklistItem {
  return {
    id,
    category: '自訂',
    no,
    content: id,
    judgment: null,
    description: '',
    origin: 'custom',
  }
}

describe('recycle bin data lifecycle', () => {
  it('moves an NCR out of the active list and restores it to the original index', () => {
    const state = createDemoState()
    const records = [ncr('before'), ncr('target'), ncr('after')]
    state.workspace.ncrs = records

    const removed = moveCompanyRecordToTrash(state, 'ncr', 'target', 'jiurun', 'trash-1', '2026-09-24T01:00:00.000Z')
    expect(removed.workspace.ncrs.map((item) => item.id)).toEqual(['before', 'after'])
    expect(removed.trash?.[0]).toMatchObject({ kind: 'ncr', recordId: 'target', originalIndex: 1 })

    const restored = restoreTrashRecord(removed, 'trash-1')
    expect(restored.ok).toBe(true)
    expect(restored.state.workspace.ncrs).toEqual(records)
    expect(restored.state.trash).toEqual([])
  })

  it('remembers archive year and company when restoring a prior-year observation', () => {
    const state = createDemoState()
    const archiveCompany = {
      ...state.workspace,
      observations: [observation('before'), observation('archived-target'), observation('after')],
    }
    state.yearArchives['2024'] = {
      workspace: archiveCompany,
      settings: { ...state.settings, auditYear: 2024 },
    }

    const removed = moveCompanyRecordToTrash(state, 'observation', 'archived-target', 'jiurun', 'trash-archive', '2026-09-24T01:00:00.000Z')
    expect(removed.yearArchives['2024'].workspace?.observations.map((item) => item.id)).toEqual(['before', 'after'])
    expect(removed.trash?.[0]).toMatchObject({ location: { companyId: 'jiurun', year: 2024, archiveYear: '2024' } })

    const restored = restoreTrashRecord(removed, 'trash-archive')
    expect(restored.ok).toBe(true)
    expect(restored.state.yearArchives['2024'].workspace?.observations.map((item) => item.id))
      .toEqual(['before', 'archived-target', 'after'])
  })

  it('restores third-party suggestions without changing other company data', () => {
    const state = createDemoState()
    state.workspace.suggestions = [suggestion('suggestion-before'), suggestion('suggestion-target')]
    const departmentsBefore = state.workspace.departments

    const removed = moveCompanyRecordToTrash(state, 'suggestion', 'suggestion-target', 'jiurun', 'trash-suggestion', '2026-09-24T01:00:00.000Z')
    expect(removed.workspace.suggestions.map((item) => item.id)).toEqual(['suggestion-before'])
    expect(removed.workspace.departments).toBe(departmentsBefore)

    const restored = restoreTrashRecord(removed, 'trash-suggestion')
    expect(restored.ok).toBe(true)
    expect(restored.state.workspace.suggestions.map((item) => item.id))
      .toEqual(['suggestion-before', 'suggestion-target'])
  })

  it('restores a person and an onsite slot at their original positions', () => {
    const state = createDemoState()
    state.people = [person('person-before'), person('person-target'), person('person-after')]
    state.externalAuditPrep.onsiteSlots = [slot('slot-before'), slot('slot-target'), slot('slot-after')]

    const withoutPerson = movePersonToTrash(state, 'person-target', 'trash-person', '2026-09-24T01:00:00.000Z')
    const withoutSlot = moveOnsiteSlotToTrash(withoutPerson, 'slot-target', 'trash-slot', '2026-09-24T01:00:00.000Z')
    expect(withoutSlot.people.map((item) => item.id)).toEqual(['person-before', 'person-after'])
    expect(withoutSlot.externalAuditPrep.onsiteSlots.map((item) => item.id)).toEqual(['slot-before', 'slot-after'])

    const restoredSlot = restoreTrashRecord(withoutSlot, 'trash-slot')
    const restoredPerson = restoreTrashRecord(restoredSlot.state, 'trash-person')
    expect(restoredSlot.ok).toBe(true)
    expect(restoredPerson.ok).toBe(true)
    expect(restoredPerson.state.people.map((item) => item.id)).toEqual(['person-before', 'person-target', 'person-after'])
    expect(restoredPerson.state.externalAuditPrep.onsiteSlots.map((item) => item.id)).toEqual(['slot-before', 'slot-target', 'slot-after'])
  })

  it('restores custom checklist items in place and does not alter submitted audits', () => {
    const state = createDemoState()
    const audit = state.workspace.audits[0]
    audit.status = '執行中'
    audit.items = [checklistItem('item-before', 1), checklistItem('item-target', 2), checklistItem('item-after', 3)]

    const removed = moveChecklistItemToTrash(state, audit.id, 'item-target', 'trash-checklist', '2026-09-24T01:00:00.000Z')
    expect(removed.workspace.audits[0].items.map((item) => item.id)).toEqual(['item-before', 'item-after'])
    const restored = restoreTrashRecord(removed, 'trash-checklist')
    expect(restored.ok).toBe(true)
    expect(restored.state.workspace.audits[0].items.map((item) => item.id)).toEqual(['item-before', 'item-target', 'item-after'])

    const submitted = structuredClone(state)
    submitted.workspace.audits[0].status = '已回報'
    const unchanged = moveChecklistItemToTrash(submitted, audit.id, 'item-target', 'trash-submitted', '2026-09-24T01:00:00.000Z')
    expect(unchanged).toBe(submitted)
  })

  it('permanently removes generated NCR data but keeps a minimal no-resync marker', () => {
    const state = createDemoState()
    state.workspace.ncrs = [{ ...ncr('generated-ncr'), sourceAuditId: 'audit-1', checklistItemId: 'item-1' }]
    const inTrash = moveCompanyRecordToTrash(state, 'ncr', 'generated-ncr', 'jiurun', 'trash-generated', '2026-09-24T01:00:00.000Z')
    const cleared = permanentlyDeleteTrashRecord(inTrash, 'trash-generated')

    expect(cleared.trash).toEqual([])
    expect(isGeneratedRecordPermanentlyDeleted(cleared, 'ncr', 'jiurun', 'generated-ncr', 2026)).toBe(true)
    expect(cleared.permanentlyDeletedGeneratedRecords).toEqual([
      { kind: 'ncr', recordId: 'generated-ncr', companyId: 'jiurun', year: 2026 },
    ])
  })
})
