import { describe, it, expect, vi } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { movePersonToTrash } from '../trash'
import {
  backupRoundTrip,
  parseBackupJson,
  serializeBackup,
  validateAppState,
  describeRestorePreview,
  BACKUP_FORMAT,
  backupFilename,
} from '../backup'

describe('backup round-trip', () => {
  it('creates a unique timestamped filename for each local backup', () => {
    const state = createDemoState()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-09-25T15:00:01.234Z'))
      const first = backupFilename(state)
      vi.setSystemTime(new Date('2026-09-25T15:00:01.235Z'))
      const second = backupFilename(state)

      expect(first).toBe('QMS備份_2026_2026-09-25T15-00-01-234Z.json')
      expect(second).not.toBe(first)
    } finally {
      vi.useRealTimers()
    }
  })

  it('serializes envelope and restores full state', () => {
    const demo = createDemoState()
    const restored = backupRoundTrip(demo)
    expect(restored.version).toBe(14)
    expect(restored.people.map((person) => person.id)).toEqual(demo.people.map((person) => person.id))
    expect(restored.people.every((person) => person.affiliations.every((affiliation) => affiliation.companyId === 'jiurun'))).toBe(true)
    expect(restored.companies.jiurun.audits.length).toBeGreaterThan(demo.companies.jiurun.audits.length)
    expect(restored.companies.zhenglongxing.audits).toEqual([])
    expect(restored.externalAuditPrep).toBeDefined()
    expect(restored.companySettings.jiurun.auditYear).toBe(demo.companySettings.jiurun.auditYear)
    expect(restored.companyRelationships).toEqual([])
  })

  it('preserves recycle-bin contents through backup and restore', () => {
    const demo = createDemoState()
    const target = demo.people[0]
    const trashed = movePersonToTrash(demo, target.id, 'backup-trash-entry', '2026-09-24T01:00:00.000Z')
    const restored = parseBackupJson(serializeBackup(trashed))

    expect(restored.version).toBe(14)
    expect(restored.people.some((person) => person.id === target.id)).toBe(false)
    expect(restored.trash).toEqual(trashed.trash)
  })

  it('upgrades a v7 backup with existing user records and an empty recycle bin', () => {
    const demo = createDemoState()
    demo.version = 7
    demo.dataSource = 'user'
    delete demo.trash
    delete demo.permanentlyDeletedGeneratedRecords
    demo.companies.jiurun.ncrs[0].description = 'v7 使用者資料'

    const restored = parseBackupJson(JSON.stringify(demo))
    expect(restored.version).toBe(14)
    expect(restored.trash).toEqual([])
    expect(restored.companies.jiurun.ncrs[0].description).toBe('v7 使用者資料')
  })

  it('accepts legacy plain AppState JSON without envelope', () => {
    const demo = createDemoState()
    const legacy = JSON.stringify({ ...demo, version: 6, settings: demo.companySettings.jiurun })
    const restored = parseBackupJson(legacy)
    expect(restored.version).toBe(14)
    expect(restored.companies.jiurun.planRows.length).toBeGreaterThan(0)
    expect(restored.companies.zhenglongxing.planRows).toEqual([])
  })

  it('migrates a v1-shaped plain backup', () => {
    const demo = createDemoState()
    const legacy = {
      version: 1,
      settings: { ...demo.companySettings.jiurun, auditYear: 2024 },
      departments: demo.companies.jiurun.departments,
      planRows: demo.companies.jiurun.planRows,
      audits: demo.companies.jiurun.audits,
      ncrs: demo.companies.jiurun.ncrs,
      observations: demo.companies.jiurun.observations,
    }
    const restored = parseBackupJson(JSON.stringify(legacy))
    expect(restored.version).toBe(14)
    expect(restored.companySettings.jiurun.auditYear).toBe(2024)
    expect(restored.companies.jiurun.audits.length).toBe(demo.companies.jiurun.audits.length)
  })

  it('includes backup format metadata in envelope', () => {
    const demo = createDemoState()
    const parsed = JSON.parse(serializeBackup(demo)) as { _format: string; state: unknown }
    expect(parsed._format).toBe(BACKUP_FORMAT)
    expect(validateAppState(parsed.state)).toBe(true)
  })

  it('rejects invalid JSON and malformed state', () => {
    expect(() => parseBackupJson('{bad')).toThrow('JSON')
    expect(() => parseBackupJson('{"version":1}')).toThrow('不完整')
  })

  it('rejects a structurally valid backup from a newer version', () => {
    const newer = { ...createDemoState(), version: 15 }
    expect(() => parseBackupJson(JSON.stringify(newer))).toThrow('拒絕降版還原')
  })

  it('describeRestorePreview notes migration from older backup versions', () => {
    const demo = createDemoState()
    demo.version = 7
    demo.dataSource = 'user'
    delete demo.trash
    const restored = parseBackupJson(JSON.stringify(demo))
    const preview = describeRestorePreview(7, restored)
    expect(preview).toMatch(/2026 年度/)
    expect(preview).toMatch(/來源備份 v7/)
    expect(preview).toMatch(/覆寫/)
  })

  it('describeRestorePreview for v14 backup shows target version only', () => {
    const demo = createDemoState()
    const restored = backupRoundTrip(demo)
    const preview = describeRestorePreview(14, restored)
    expect(preview).toMatch(/備份版本 v14/)
    expect(preview).not.toMatch(/格式轉換/)
  })
})
