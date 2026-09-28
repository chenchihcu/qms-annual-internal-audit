import { describe, expect, it } from 'vitest'
import { createDemoState, migrateToV8 } from '../../data/demoData'
import { migrateState } from '../migrate'
import {
  applyWorkspaceConflictChoice,
  migrateToSingleWorkspace,
  validateSingleWorkspaceState,
} from '../singleWorkspaceMigration'

function legacyState() {
  const state = migrateState(migrateToV8(createDemoState()))
  state.version = 13
  return state
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('single-workspace migration', () => {
  it('unions compatible plan months and leaves conflicting fields in the review queue', () => {
    const state = legacyState()
    const first = clone(state.companies.jiurun.planRows[0])
    const second = clone(first)
    first.owner = '品保主管'
    first.months = Array(12).fill(null)
    first.months[1] = '擬定'
    second.id = 'legacy-plan-copy'
    second.owner = '製造主管'
    second.months = Array(12).fill(null)
    second.months[3] = '擬定'
    state.companies.jiurun.planRows = [first]
    state.companies.zhenglongxing.planRows = [second]

    const migrated = migrateToSingleWorkspace(state)
    const [row] = migrated.companies.jiurun.planRows
    const ownerConflict = migrated.workspaceMigrationConflicts?.find(
      (conflict) => conflict.target.kind === 'plan' && conflict.target.field === 'owner',
    )

    expect(validateSingleWorkspaceState(migrated)).toBe(true)
    expect(migrated.companies.jiurun.planRows).toHaveLength(1)
    expect(row.months[1]).toBe('擬定')
    expect(row.months[3]).toBe('擬定')
    expect(ownerConflict?.candidates?.map((candidate) => candidate.value)).toEqual(['品保主管', '製造主管'])
    expect(applyWorkspaceConflictChoice(migrated, ownerConflict!, 1).companies.jiurun.planRows[0].owner)
      .toBe('製造主管')
  })

  it('does not guess between different checklist judgments', () => {
    const state = legacyState()
    const left = clone(state.companies.jiurun.audits[0])
    const right = clone(left)
    left.items[0].judgment = '符合'
    right.items[0].judgment = '不符'
    state.companies.jiurun.audits = [left]
    state.companies.zhenglongxing.audits = [right]

    const migrated = migrateToSingleWorkspace(state)
    const item = migrated.companies.jiurun.audits[0].items[0]
    const conflict = migrated.workspaceMigrationConflicts?.find(
      (entry) => entry.target.kind === 'checklist' && entry.target.field === 'judgment',
    )

    expect(item.judgment).toBeNull()
    expect(conflict?.candidates?.map((candidate) => candidate.value)).toEqual(['符合', '不符'])
    expect(applyWorkspaceConflictChoice(migrated, conflict!, 1).companies.jiurun.audits[0].items[0].judgment)
      .toBe('不符')
  })

  it('reassigns colliding record IDs and keeps audit and NCR links on the correct records', () => {
    const state = legacyState()
    const leftObservation = {
      id: 'shared-observation', year: 2026, qpCode: 'QP-01', departmentId: 'dept-1',
      department: '製造部', process: '製程管理', content: '左側觀察', description: '', status: 'open' as const,
      ncrId: 'shared-ncr', sourceAuditId: 'left-audit', sourceChecklistItemId: 'left-item',
    }
    const rightObservation = {
      ...leftObservation,
      content: '右側觀察',
      sourceAuditId: 'right-audit',
      sourceChecklistItemId: 'right-item',
    }
    const leftNcr = {
      id: 'shared-ncr', ncrNumber: 'NCR-L', qpCode: 'QP-01', departmentId: 'dept-1',
      department: '製造部', process: '製程管理', description: '左側不符合', date: '2026-01-01',
      status: '開立' as const, rootCause: '', correctiveAction: '', verificationEvidence: '',
      observationId: 'shared-observation', sourceAuditId: 'left-audit', checklistItemId: 'left-item',
    }
    const rightNcr = {
      ...leftNcr,
      ncrNumber: 'NCR-R',
      description: '右側不符合',
      sourceAuditId: 'right-audit',
      checklistItemId: 'right-item',
    }
    const baseAudit = clone(state.companies.jiurun.audits[0])
    const auditFor = (id: string, itemId: string, sourceNcrId: string) => ({
      ...baseAudit,
      id,
      items: [{ id: itemId, category: '管理', no: 1, content: '查檢項目', judgment: null, description: '', sourceNcrId }],
    })
    state.companies.jiurun.observations = [leftObservation]
    state.companies.zhenglongxing.observations = [rightObservation]
    state.companies.jiurun.ncrs = [leftNcr]
    state.companies.zhenglongxing.ncrs = [rightNcr]
    state.companies.jiurun.audits = [auditFor('left-audit', 'left-item', 'shared-ncr')]
    state.companies.zhenglongxing.audits = [auditFor('right-audit', 'right-item', 'shared-ncr')]

    const migrated = migrateToSingleWorkspace(state)
    const workspace = migrated.companies.jiurun
    const migratedRightNcr = workspace.ncrs.find((record) => record.ncrNumber === 'NCR-R')
    const migratedRightObservation = workspace.observations.find((record) => record.content === '右側觀察')
    const migratedRightAudit = workspace.audits.find((audit) => audit.id === 'right-audit')

    expect(workspace.ncrs.map((record) => record.id)).toEqual(['shared-ncr', 'shared-ncr-merged-2'])
    expect(workspace.observations.map((record) => record.id)).toEqual(['shared-observation', 'shared-observation-merged-2'])
    expect(migratedRightNcr?.observationId).toBe(migratedRightObservation?.id)
    expect(migratedRightObservation?.ncrId).toBe(migratedRightNcr?.id)
    expect(migratedRightAudit?.items[0].sourceNcrId).toBe(migratedRightNcr?.id)
  })

  it('merges duplicate people and remaps assignments and audit-team references', () => {
    const state = legacyState()
    const leftPerson = clone(state.people[0])
    leftPerson.id = 'person-left'
    leftPerson.name = '陳稽核員'
    leftPerson.employeeNumber = 'E-100'
    leftPerson.affiliations = [{ id: 'aff-left', companyId: 'jiurun', departmentId: 'dept-1' }]
    leftPerson.qualifications = []
    leftPerson.appointments = []
    const rightPerson = clone(leftPerson)
    rightPerson.id = 'person-right'
    rightPerson.affiliations = [{ id: 'aff-right', companyId: 'zhenglongxing', departmentId: 'dept-1' }]
    state.people = [leftPerson, rightPerson]

    state.annualPersonnelAssignments = [
      { id: 'assignment-left', year: 2026, companyId: 'jiurun', personId: leftPerson.id, role: 'annual_escort' },
      { id: 'assignment-right', year: 2026, companyId: 'zhenglongxing', personId: rightPerson.id, role: 'annual_escort' },
    ]
    const leftAudit = clone(state.companies.jiurun.audits[0])
    leftAudit.id = 'person-left-audit'
    leftAudit.team = {
      leadAuditorPersonId: leftPerson.id,
      auditorPersonIds: [],
      escortPersonIds: [],
      impartialityConfirmed: true,
      impartialityNote: '',
    }
    const rightAudit = clone(leftAudit)
    rightAudit.id = 'person-right-audit'
    rightAudit.team = { ...leftAudit.team!, leadAuditorPersonId: rightPerson.id }
    state.companies.jiurun.audits = [leftAudit]
    state.companies.zhenglongxing.audits = [rightAudit]

    const migrated = migrateToSingleWorkspace(state)
    const canonicalId = migrated.people[0].id

    expect(migrated.people).toHaveLength(1)
    expect(migrated.annualPersonnelAssignments).toHaveLength(1)
    expect(migrated.annualPersonnelAssignments[0].personId).toBe(canonicalId)
    expect(migrated.companies.jiurun.audits.find((audit) => audit.id === 'person-right-audit')?.team?.leadAuditorPersonId)
      .toBe(canonicalId)
  })

  it('records a differing source year once and keeps the older workspace archived', () => {
    const state = legacyState()
    state.companySettings.zhenglongxing.auditYear = 2025

    const migrated = migrateToSingleWorkspace(state)
    const yearConflicts = migrated.workspaceMigrationConflicts?.filter(
      (conflict) => conflict.target.kind === 'settings' && conflict.target.field === 'auditYear',
    ) ?? []

    expect(yearConflicts).toHaveLength(1)
    expect(migrated.yearArchives['2025']?.companies.jiurun).toBeDefined()
    expect(migrated.companySettings.jiurun.auditYear).toBe(2026)
  })

  it('does not point profile conflicts at the removed audit basics screen', () => {
    const state = legacyState()
    state.companyAuditProfiles.jiurun.certificateScope = '左側範圍'
    state.companyAuditProfiles.zhenglongxing.certificateScope = '右側範圍'
    state.companyAuditProfiles.jiurun.auditProcedureVersion = 'A'
    state.companyAuditProfiles.zhenglongxing.auditProcedureVersion = 'B'

    const migrated = migrateToSingleWorkspace(state)
    const summaries = (migrated.workspaceMigrationConflicts ?? []).map((conflict) => `${conflict.title}\n${conflict.summary}`)

    expect(summaries.some((text) => text.includes('稽核基本資料'))).toBe(false)
    expect(summaries.some((text) => text.includes('設定頁不再編輯證書範圍與引用'))).toBe(true)
    expect(summaries.some((text) => text.includes('程序與紀錄'))).toBe(true)
  })
})
