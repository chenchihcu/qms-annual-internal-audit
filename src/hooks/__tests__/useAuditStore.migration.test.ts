import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  buildDemoLegacySeed,
  createDemoState,
  migrateToV8,
  migrateToV6,
  migrateToV7,
  LEGACY_STORAGE_KEY_V8,
  LEGACY_STORAGE_KEY_V7,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY_V6,
} from '../../data/demoData'
import { ncrNumberLabel } from '../../lib/ncr'
import { useAuditStore } from '../useAuditStore'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

function createCurrentDemoState() {
  return createDemoState()
}

describe('migrateToV7', () => {
  it('preserves state and exposes per-company settings', () => {
    const demo = migrateToV8(buildDemoLegacySeed())
    const migrated = migrateToV7(migrateToV6({ ...demo, version: 6, settings: demo.companySettings.jiurun }))
    expect(migrated.version).toBe(7)
    expect(migrated.companySettings.jiurun.auditYear).toBe(demo.companySettings.jiurun.auditYear)
    expect(migrated.companySettings.zhenglongxing.auditYear).toBe(demo.companySettings.zhenglongxing.auditYear)
    expect(migrated.companyRelationships.length).toBeGreaterThan(0)
    expect(typeof migrated.externalAuditPrep.internalAuditComplete).toBe('boolean')
    expect(typeof migrated.externalAuditPrep.managementReviewComplete).toBe('boolean')
    expect(migrated.people).toBeDefined()
    expect(migrated.externalAuditPrep).toBeDefined()
    expect(migrated.companies.jiurun.audits.length).toBeGreaterThan(0)
  })

  it('upgrades v4-shaped state to version 7', () => {
    const demo = migrateToV8(buildDemoLegacySeed())
    const v4Like = { ...demo, version: 4 as const, settings: demo.companySettings.jiurun }
    const migrated = migrateToV7(migrateToV6(v4Like))
    expect(migrated.version).toBe(7)
    expect(migrated.externalAuditPrep).toBeDefined()
  })

  it('keeps legacy names pending without inferring qualifications', () => {
    const demo = migrateToV8(buildDemoLegacySeed())
    const legacy = { ...demo, version: 5, people: undefined, annualPersonnelAssignments: undefined, companyAuditProfiles: undefined, yearArchives: undefined, settings: demo.companySettings.jiurun } as unknown as Parameters<typeof migrateToV6>[0]
    const migrated = migrateToV7(migrateToV6(legacy))
    expect(migrated.people.length).toBeGreaterThan(0)
    expect(migrated.people.every((person) => person.qualifications.length === 0)).toBe(true)
    expect(migrated.people.some((person) => person.notes.includes('待配對'))).toBe(true)
  })
})

describe('localStorage load and single-workspace migration', () => {
  it('loads a validated v15 workspace directly', () => {
    const demo = createCurrentDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))

    const { result } = renderHook(() => useAuditStore())
    expect(result.current.state.settings.auditYear).toBe(demo.settings.auditYear)
    expect(result.current.state.version).toBe(15)
    expect(result.current.state.company.audits.length).toBeGreaterThan(0)
  })

  it('auto-writes v15 from v7 legacy key and keeps the source key', () => {
    const demo = migrateToV8(buildDemoLegacySeed())
    demo.version = 7
    demo.dataSource = 'user'
    delete demo.trash
    delete demo.permanentlyDeletedGeneratedRecords
    demo.companies.jiurun.ncrs[0].description = '既有 v7 使用者描述'
    const raw = JSON.stringify(demo)
    localStorage.setItem(LEGACY_STORAGE_KEY_V7, raw)

    const { result } = renderHook(() => useAuditStore())
    expect(result.current.state.version).toBe(15)
    expect(result.current.state.company.ncrs[0].description).toBe('既有 v7 使用者描述')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { version: number }
    expect(stored.version).toBe(15)
    expect(localStorage.getItem(LEGACY_STORAGE_KEY_V7)).toBe(raw)
  })

  it.each([
    ['v4', 'qms-annual-internal-audit-v4', 4],
    ['v5', 'qms-annual-internal-audit-v5', 5],
    ['v6', LEGACY_STORAGE_KEY_V6, 6],
    ['v8', LEGACY_STORAGE_KEY_V8, 8],
  ])('auto-writes v15 from %s without removing its source key', (_label, key, version) => {
    const demo = { ...migrateToV8(buildDemoLegacySeed()), version }
    const raw = JSON.stringify(demo)
    localStorage.setItem(key, raw)

    const { result } = renderHook(() => useAuditStore())
    expect(result.current.state.version).toBe(15)
    expect(result.current.state.company.audits.length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(15)
    expect(localStorage.getItem(key)).toBe(raw)
  })

  it('auto-writes v15 from v1 legacy key', () => {
    const demo = createDemoState()
    const legacy = {
      version: 1,
      settings: { ...demo.settings, auditYear: 2024 },
      departments: demo.workspace.departments,
      planRows: demo.workspace.planRows,
      audits: demo.workspace.audits,
      ncrs: demo.workspace.ncrs,
      observations: demo.workspace.observations,
    }
    const raw = JSON.stringify(legacy)
    localStorage.setItem('qms-annual-internal-audit-v1', raw)

    const { result } = renderHook(() => useAuditStore())
    expect(result.current.state.version).toBe(15)
    expect(result.current.state.settings.auditYear).toBe(2024)
    expect(result.current.state.company.audits.length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(15)
    expect(localStorage.getItem('qms-annual-internal-audit-v1')).toBe(raw)
  })

  it('does not leave a partial v15 key when persistence fails', () => {
    const demo = migrateToV8(buildDemoLegacySeed())
    const raw = JSON.stringify(demo)
    localStorage.setItem(LEGACY_STORAGE_KEY_V8, raw)
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === STORAGE_KEY) throw new Error('quota exceeded')
      return originalSetItem.call(this, key, value)
    })

    const { result } = renderHook(() => useAuditStore())
    expect(result.current.storageWarning).toContain('新版資料寫入失敗')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_STORAGE_KEY_V8)).toBe(raw)
  })

  it('preserves corrupt stored JSON and blocks persistence', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')

    const { result } = renderHook(() => useAuditStore())
    expect(result.current.state.company.audits).toHaveLength(0)
    expect(result.current.storageWarning).toContain('原始瀏覽器資料已保留')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{not-json')
  })

  it('refuses a newer storage version without overwriting it', () => {
    const newer = { ...createCurrentDemoState(), version: 16 }
    const raw = JSON.stringify(newer)
    localStorage.setItem(STORAGE_KEY, raw)

    const { result } = renderHook(() => useAuditStore())
    expect(result.current.storageWarning).toContain('拒絕降版載入')
    expect(result.current.state.company.audits).toHaveLength(0)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })
})

describe('getOrCreateAudit', () => {
  it('returns stub without throwing when dept and entry are missing', () => {
    const { result } = renderHook(() => useAuditStore())

    let audit: ReturnType<typeof result.current.getOrCreateAudit> | undefined
    expect(() => {
      audit = result.current.getOrCreateAudit('QP-INVALID', 'dept-missing')
    }).not.toThrow()

    expect(audit).toBeDefined()
    expect(audit!.qpCode).toBe('QP-INVALID')
    expect(audit!.items).toEqual([])
  })

  it('reuses a persisted audit with a legacy ID for the same procedure and department', () => {
    const state = createCurrentDemoState()
    const sourceAudit = state.workspace.audits[0]
    const persistedAudit = {
      ...sourceAudit,
      id: 'audit-qp03-single-workspace',
      qpCode: 'QP-03',
      department: '品保部',
      departmentId: 'dept-qa',
    }
    state.workspace.audits = [persistedAudit]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    const { result } = renderHook(() => useAuditStore())
    const loadedAudit = result.current.state.workspace.audits[0]
    let resolvedAudit: ReturnType<typeof result.current.getOrCreateAudit> | undefined
    act(() => {
      resolvedAudit = result.current.getOrCreateAudit('QP-03', 'dept-qa')
    })

    expect(resolvedAudit).toBe(loadedAudit)
    expect(result.current.state.workspace.audits).toEqual([persistedAudit])
  })

  it('creates audit for valid template entry', () => {
    const { result } = renderHook(() => useAuditStore())

    let audit: ReturnType<typeof result.current.getOrCreateAudit> | undefined
    act(() => {
      audit = result.current.getOrCreateAudit('QP-28', 'dept-qa')
    })

    expect(audit).toBeDefined()
    expect(audit!.departmentId).toBe('dept-qa')
    expect(audit!.items.length).toBeGreaterThan(0)
  })

  it('refreshes pending-import placeholder for 開發工程 QP-11', () => {
    const { result } = renderHook(() => useAuditStore())

    act(() => {
      result.current.updateAudit({
        id: 'audit-QP-11-dept-eng',
        qpCode: 'QP-11',
        departmentId: 'dept-eng',
        department: '開發工程',
        process: '新產品規劃管理程序',
        documents: 'QP-11',
        notifyDate: '',
        auditDate: '',
        departmentManager: '工程部經理',
        auditors: '李稽核',
        auditCategory: '系統稽核',
        items: [
          {
            id: 'chk-pending',
            category: '待匯入',
            no: 1,
            content: '（QP-11 查檢項目待匯入）',
            judgment: null,
            description: '',
          },
        ],
      })
    })

    let audit: ReturnType<typeof result.current.getOrCreateAudit> | undefined
    act(() => {
      audit = result.current.getOrCreateAudit('QP-11', 'dept-eng')
    })

    expect(audit!.items.length).toBe(7)
    expect(audit!.items.some((item) => item.category === '待匯入')).toBe(false)
  })
})

describe('year datasets', () => {
  it('restores the original year instead of clearing it', () => {
    const { result } = renderHook(() => useAuditStore())
    const originalCount = result.current.state.company.audits.length
    act(() => result.current.switchAuditYear(2027))
    expect(result.current.state.settings.auditYear).toBe(2027)
    expect(result.current.state.company.audits).toHaveLength(0)
    act(() => result.current.switchAuditYear(2026))
    expect(result.current.state.company.audits).toHaveLength(originalCount)
  })

  it('archives one shared workspace when switching year', () => {
    const { result } = renderHook(() => useAuditStore())
    const currentAudits = result.current.state.company.audits.length
    const prepBefore = result.current.state.externalAuditPrep.items[0].completed
    act(() => result.current.switchAuditYear(2027))
    expect(result.current.state.company.audits).toHaveLength(0)
    expect(result.current.state.yearArchives['2026']?.workspace?.audits).toHaveLength(currentAudits)
    expect(result.current.state.externalAuditPrep.items[0].completed).toBe(prepBefore)
  })
})

describe('audit event records', () => {
  it('keeps prior-year observations editable and tracks each carry-forward year once', () => {
    const { result } = renderHook(() => useAuditStore())
    act(() => result.current.addObservation({
      year: 2026, qpCode: 'QP-28', departmentId: 'dept-qa', department: '品質部', process: '品質管理',
      content: '第三方觀察事項', description: '檢視紀錄', status: 'open', sourceType: 'third_party_audit',
      sourceReference: 'EXT-2026-1', occurrenceDate: '2026-05-10', followUps: [],
    }))
    const id = result.current.state.company.observations.at(-1)!.id
    act(() => result.current.switchAuditYear(2027))
    const jiurun2026 = result.current.state.yearArchives['2026']?.workspace
    expect(jiurun2026).toBeDefined()
    const priorNcr = jiurun2026!.ncrs.find((item) => item.status !== '結案')
    expect(priorNcr).toBeDefined()
    act(() => result.current.carryForwardNCR(priorNcr!.id, priorNcr!.qpCode, priorNcr!.departmentId))
    const carriedNcrItem = result.current.state.company.audits.flatMap((audit) => audit.items).find((item) => item.sourceNcrId === priorNcr!.id)
    expect(carriedNcrItem).toBeDefined()
    expect(carriedNcrItem?.content).toContain(ncrNumberLabel(priorNcr!.ncrNumber))
    expect(carriedNcrItem?.content).not.toContain(priorNcr!.ncrNumber)
    expect(result.current.state.yearArchives['2026']?.workspace?.ncrs.find((item) => item.id === priorNcr!.id)?.ncrNumber).toBe(priorNcr!.ncrNumber)
    act(() => result.current.addObservationFollowUp(id, '2027-01-10', '第一次追蹤'))
    act(() => result.current.carryForwardObservation(id, 'QP-28', 'dept-qa'))
    act(() => result.current.carryForwardObservation(id, 'QP-28', 'dept-qa'))
    const prior = result.current.state.yearArchives['2026']?.workspace?.observations.find((item) => item.id === id)
    expect(prior).toBeDefined()
    if (!prior) throw new Error('missing prior observation')
    expect(prior.followUps).toHaveLength(1)
    expect(prior.carryForwards).toHaveLength(1)
    expect(prior.carryForwards?.[0].year).toBe(2027)
    expect(result.current.state.company.audits.flatMap((audit) => audit.items).filter((item) => item.carriedFromId === id)).toHaveLength(1)
    act(() => result.current.updateObservation(id, { status: 'closed' }))
    expect(result.current.state.yearArchives['2026']?.workspace?.observations.find((item) => item.id === id)?.status).toBe('open')
    act(() => result.current.updateObservation(id, { status: 'closed', closedAt: '2027-02-01', closeEvidence: 'CAPA-102' }))
    expect(result.current.state.yearArchives['2026']?.workspace?.observations.find((item) => item.id === id)?.status).toBe('closed')
    const revisions = result.current.state.yearArchives['2026']?.workspace?.observations.find((item) => item.id === id)?.revisions
    expect(revisions).toHaveLength(1)
    expect(revisions?.[0].before.status).toBe('open')
    expect(revisions?.[0].after.closeEvidence).toBe('CAPA-102')
    act(() => result.current.switchAuditYear(2026))
    expect(result.current.state.company.observations.find((item) => item.id === id)?.followUps?.[0].note).toBe('第一次追蹤')
  })

    it('uses the selected audit year in ids for newly created events', () => {
      const { result } = renderHook(() => useAuditStore())
      act(() => result.current.switchAuditYear(2027))

      let id = ''
      act(() => {
        id = result.current.createAuditEvent('QP-28', 'dept-qa', '2027-05-01')
      })

      const audit = result.current.state.company.audits.find((item) => item.id === id)
      expect(id).toMatch(/^audit-2027-QP-28-dept-qa-/)
      expect(audit?.year).toBe(2027)
    })

    it('creates independent events for the same procedure and department', () => {
    const { result } = renderHook(() => useAuditStore())
    let first = ''
    let second = ''
    act(() => {
      first = result.current.createAuditEvent('QP-28', 'dept-qa', '2026-05-01')
      second = result.current.createAuditEvent('QP-28', 'dept-qa', '2026-08-01')
    })
    expect(first).not.toBe(second)
    expect(result.current.state.company.audits.filter((item) => item.id === first || item.id === second)).toHaveLength(2)
  })

  it('creates a linked observation record from an audit judgment', () => {
    const { result } = renderHook(() => useAuditStore())
    const audit = result.current.state.company.audits[0]
    const item = audit.items[0]
    act(() => result.current.updateChecklistItem(audit.id, item.id, { judgment: '觀察', description: '追蹤量測紀錄' }))
    const observation = result.current.state.company.observations.find((record) => record.sourceChecklistItemId === item.id)
    expect(observation?.sourceAuditId).toBe(audit.id)
    expect(observation?.sourceType).toBe('internal_audit')
    act(() => result.current.convertObservationToNCR(observation!.id))
    const converted = result.current.state.company.observations.find((record) => record.id === observation!.id)
    const linkedNcr = result.current.state.company.ncrs.find((record) => record.id === converted?.convertedNcrId)
    expect(linkedNcr?.sourceAuditId).toBe(audit.id)
    expect(linkedNcr?.evidenceSnapshot).toBe(observation?.sourceReference)
  })

  it('blocks incomplete starts and freezes only the matching qualification in the team snapshot', () => {
    const { result } = renderHook(() => useAuditStore())
    let auditId = ''
    act(() => { auditId = result.current.createAuditEvent('QP-28', 'dept-qa', '2026-06-01') })
    const sourceAudit = result.current.state.company.audits.find((item) => item.id === auditId)!
    act(() => { result.current.updateCompanyAuditProfile('jiurun', { auditProcedureCode: '', formalRecordLocation: '' }) })
    const incompleteStart = result.current.startAudit(sourceAudit.id)
    expect(incompleteStart.canStart).toBe(false)
    expect(incompleteStart.errors).toEqual(expect.arrayContaining(['稽核程序代碼尚未填寫', '正式紀錄保存位置尚未填寫']))

    let leadId = ''
    let escortId = ''
    act(() => {
      leadId = result.current.addPerson({
        name: '合格主任', employeeNumber: 'LA-001', type: 'internal', active: true, notes: '',
        affiliations: [{ id: 'aff-lead', companyId: 'jiurun', departmentId: 'dept-admin', effectiveFrom: '2026-01-01' }],
        appointments: [],
        qualifications: [
          {
            id: 'qualification-unrelated', role: 'internal_lead_auditor', companyIds: ['jiurun'],
            standardVersions: ['ISO 9001:2015'], procedureScopes: ['QP-01'], departmentScopes: ['dept-admin'],
            documentTitle: '不相關資格', documentNumber: 'WRONG-001', documentLocation: 'DMS', assessedBy: '管理代表',
            assessmentDate: '2026-01-01', effectiveFrom: '2026-01-01', validityMode: 'fixed', effectiveTo: '2026-12-31',
          },
          {
            id: 'qualification-matching', role: 'internal_lead_auditor', companyIds: ['jiurun'],
            standardVersions: ['ISO 9001:2015'], procedureScopes: ['QP-28'], departmentScopes: ['dept-qa'],
            documentTitle: '主任資格核准單', documentNumber: 'LA-Q-001', documentLocation: 'DMS', assessedBy: '管理代表',
            assessmentDate: '2026-01-01', effectiveFrom: '2026-01-01', validityMode: 'fixed', effectiveTo: '2026-12-31',
          },
        ],
      })
      escortId = result.current.addPerson({
        name: '陪稽人員', employeeNumber: 'ESC-001', type: 'internal', active: true, notes: '',
        affiliations: [{ id: 'aff-escort', companyId: 'jiurun', departmentId: 'dept-qa', effectiveFrom: '2026-01-01' }],
        appointments: [],
        qualifications: [{
          id: 'qualification-escort', role: 'internal_auditor', companyIds: ['jiurun'], standardVersions: ['ISO 9001:2015'],
          procedureScopes: ['QP-28'], departmentScopes: ['dept-qa'], documentTitle: '不應帶入的陪稽資格', documentNumber: 'ESC-Q-001',
          documentLocation: 'DMS', assessedBy: '管理代表', assessmentDate: '2026-01-01', effectiveFrom: '2026-01-01',
          validityMode: 'fixed', effectiveTo: '2026-12-31',
        }],
      })
    })
    act(() => {
      result.current.updateCompanyAuditProfile('jiurun', {
        applicableStandards: [
          { name: 'ISO 9001', version: '2015', confirmationStatus: 'confirmed', evidenceReference: '證書 QMS-001' },
          { name: 'AS9100', version: '2016 (Rev D)', confirmationStatus: 'pending', evidenceReference: '' },
        ],
        auditProcedureCode: 'QP-28',
        auditProcedureVersion: 'QP-28 Rev.6',
        formalRecordLocation: 'DMS/QP-28',
      })
      result.current.updateAudit({
        ...sourceAudit,
        auditDate: '2026-06-01',
        status: '規劃中',
        team: {
          leadAuditorPersonId: leadId,
          auditorPersonIds: [],
          escortPersonIds: [escortId],
          impartialityConfirmed: false,
          impartialityNote: '',
        },
      })
    })

    let startResult: ReturnType<typeof result.current.startAudit> | undefined
    act(() => { startResult = result.current.startAudit(sourceAudit.id) })
    expect(startResult?.canStart).toBe(true)
    const started = result.current.state.company.audits.find((item) => item.id === sourceAudit.id)!
    expect(started.status).toBe('執行中')
    expect(started.standardSnapshot).toEqual(['ISO 9001:2015'])
    expect(started.procedureCodeSnapshot).toBe('QP-28')
    expect(started.procedureVersion).toBe('QP-28 Rev.6')
    expect(started.formalRecordLocationSnapshot).toBe('DMS/QP-28')
    const lead = started.teamSnapshot?.members.find((member) => member.role === 'lead')
    const escort = started.teamSnapshot?.members.find((member) => member.role === 'escort')
    expect(lead?.qualificationReference).toBe('主任資格核准單 LA-Q-001')
    expect(lead?.qualificationScope).toContain('QP-28')
    expect(escort?.qualificationReference).toBe('')
    expect(escort?.qualificationScope).toContain('陪同／協調')

    const frozenSnapshot = JSON.stringify(started.teamSnapshot)
    act(() => result.current.updatePerson(leadId, { name: '主任改名後' }))
    expect(result.current.startAudit(sourceAudit.id).canStart).toBe(false)
    expect(JSON.stringify(result.current.state.company.audits.find((item) => item.id === sourceAudit.id)?.teamSnapshot)).toBe(frozenSnapshot)

    act(() => result.current.updateAudit({ ...started, auditDate: '2026-07-01', reportReference: 'REPORT-001' }))
    const stillRunning = result.current.state.company.audits.find((item) => item.id === sourceAudit.id)!
    expect(stillRunning.auditDate).toBe('2026-06-01')
    expect(stillRunning.reportReference).toBe('REPORT-001')

    stillRunning.items.forEach((item) => {
      act(() => result.current.updateChecklistItem(sourceAudit.id, item.id, {
        judgment: '符合',
        objectiveEvidence: '測試證據',
      }))
    })
    act(() => result.current.updateAudit({ ...stillRunning, status: '已回報', reportReference: 'REPORT-001' }))
    expect(result.current.state.company.audits.find((item) => item.id === sourceAudit.id)?.status).toBe('已回報')
    const originalContent = result.current.state.company.audits.find((item) => item.id === sourceAudit.id)!.items[0].content
    act(() => result.current.updateChecklistItem(sourceAudit.id, started.items[0].id, { content: '不應改寫歷史' }))
    expect(result.current.state.company.audits.find((item) => item.id === sourceAudit.id)!.items[0].content).toBe(originalContent)
  })

  it('does not carry forward suggestions into a reported audit event', () => {
    const { result } = renderHook(() => useAuditStore())
    let auditId = ''
    act(() => { auditId = result.current.createAuditEvent('QP-28', 'dept-qa', '2026-06-01') })
    const audit = result.current.state.company.audits.find((item) => item.id === auditId)!
    act(() => {
      result.current.updateAudit({
        ...audit,
        auditDate: '2026-06-01',
        team: {
          leadAuditorPersonId: result.current.state.people[0]?.id,
          auditorPersonIds: [result.current.state.people[0]?.id].filter(Boolean) as string[],
          escortPersonIds: [],
          impartialityConfirmed: true,
          impartialityNote: '陪稽安排',
        },
      })
    })
    act(() => result.current.startAudit(auditId))
    act(() => {
      const started = result.current.state.company.audits.find((item) => item.id === auditId)!
      started.items.forEach((item) => {
        result.current.updateChecklistItem(auditId, item.id, {
          judgment: '符合',
          objectiveEvidence: '測試證據',
        })
      })
      result.current.updateAudit({ ...started, status: '已回報', reportReference: 'RPT-LOCK' })
    })
    const beforeCount = result.current.state.company.audits.find((item) => item.id === auditId)!.items.length
    const sugId = result.current.state.company.suggestions[0]?.id
    expect(sugId).toBeTruthy()
    act(() => result.current.carryForwardSuggestion(sugId!, 'QP-28', 'dept-qa'))
    const afterCount = result.current.state.company.audits.find((item) => item.id === auditId)!.items.length
    expect(afterCount).toBe(beforeCount)
  })
})
