import { describe, it, expect } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  backupRoundTrip,
  parseBackupJson,
  serializeBackup,
  validateAppState,
  BACKUP_FORMAT,
} from '../backup'

describe('backup round-trip', () => {
  it('serializes envelope and restores full state', () => {
    const demo = createDemoState()
    const restored = backupRoundTrip(demo)
    expect(restored.version).toBe(7)
    expect(restored.people).toEqual(demo.people)
    expect(restored.companies.jiurun.audits.length).toBe(demo.companies.jiurun.audits.length)
    expect(restored.externalAuditPrep).toBeDefined()
    expect(restored.companySettings.jiurun.auditYear).toBe(demo.companySettings.jiurun.auditYear)
    expect(restored.companyRelationships.length).toBeGreaterThan(0)
  })

  it('accepts legacy plain AppState JSON without envelope', () => {
    const demo = createDemoState()
    const legacy = JSON.stringify({ ...demo, version: 6, settings: demo.companySettings.jiurun })
    const restored = parseBackupJson(legacy)
    expect(restored.version).toBe(7)
    expect(restored.companies.zhenglongxing.planRows.length).toBeGreaterThan(0)
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
    expect(restored.version).toBe(7)
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
    const newer = { ...createDemoState(), version: 8 }
    expect(() => parseBackupJson(JSON.stringify(newer))).toThrow('拒絕降版還原')
  })
})
