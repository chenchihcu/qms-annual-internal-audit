import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDemoState } from '../../data/demoData'
import { buildExportWorkbookSmoke, buildAnnualPlanSheet, buildNcrSheet, buildAllFormsWorkbook, buildPrepSheet, buildRiskSheet, buildStandardSheet } from '../formExport'
import { sheetToCsv, writeWorkbook } from '../simpleXlsx'

describe('form export smoke', () => {
  it('builds multi-sheet workbook with QR-28-01 and QR-28-03', () => {
    const state = createDemoState()
    const wb = buildExportWorkbookSmoke(state, 'jiurun')
    expect(wb.SheetNames).toContain('QR-28-01')
    expect(wb.SheetNames).toContain('QR-28-03')
  })

  it('annual plan sheet has header row matching UI columns', () => {
    const state = createDemoState()
    const ws = buildAnnualPlanSheet(state.companies.jiurun, state.companySettings.jiurun)
    const rows = ws.rows
    const header = rows.find((r) => r[0] === '項次')
    expect(header).toBeDefined()
    expect(header).toContain('QP')
    expect(header).toContain('12')
  })

  it('NCR sheet includes demo NCR row', () => {
    const state = createDemoState()
    const ws = buildNcrSheet(state.companies.jiurun, state.companySettings.jiurun)
    const text = sheetToCsv(ws)
    expect(text).toContain('NCR-2026-001')
    expect(text).toContain('QR-28-03')
  })

  it('writes a valid OOXML zip signature and release fixture', () => {
    const workbook = buildAllFormsWorkbook(createDemoState(), 'jiurun')
    const bytes = writeWorkbook(workbook)
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(bytes.length).toBeGreaterThan(1000)
    const artifactDir = resolve('artifacts', 'release')
    mkdirSync(artifactDir, { recursive: true })
    writeFileSync(resolve(artifactDir, 'xlsx-smoke.xlsx'), bytes)
  })

  it('builds risk assessment sheet from plan rows', () => {
    const state = createDemoState()
    const ws = buildRiskSheet(state.companies.jiurun)
    const text = sheetToCsv(ws)
    expect(text).toContain('QR-02-01')
    expect(text).toContain('QP')
  })

  it('includes risk sheet in full workbook export', () => {
    const workbook = buildAllFormsWorkbook(createDemoState(), 'jiurun')
    expect(workbook.SheetNames).toContain('QR-02-01')
    expect(workbook.SheetNames).toContain('適用標準')
    expect(workbook.SheetNames).toContain('人員合格名單')
    expect(workbook.SheetNames).toContain('稽核前準備')
    expect(workbook.SheetNames).not.toContain('外稽當日行程')
  })

  it('exports one shared certificate record separately from standard applicability', () => {
    const profile = createDemoState().companyAuditProfiles.jiurun
    profile.certificateScope = '精密零件設計與製造'
    profile.certificateReference = 'CERT-001'

    const rows = buildStandardSheet(profile, '稽核工作區').rows
    const standardHeader = rows.find((row) => row[0] === '標準')
    const certificate = rows.find((row) => row[0] === '證書範圍')

    expect(standardHeader).toEqual(['標準', '版本', '適用性', '適用依據引用'])
    expect(certificate).toEqual(['證書範圍', '精密零件設計與製造', '證書編號／引用', 'CERT-001'])
    expect(rows.filter((row) => row[0] === '證書範圍')).toHaveLength(1)
    expect(rows.filter((row) => row[0] === '證書編號／引用')).toHaveLength(0)
  })

  it('exports preparation rows with unique display numbers and matches completion by stable item id', () => {
    const state = createDemoState()
    const correctiveReport = state.externalAuditPrep.items.find((item) => item.id === 'prep-2-b')!
    correctiveReport.completed = true
    correctiveReport.remark = '矯正報告備註'
    const auditReport = state.externalAuditPrep.items.find((item) => item.id === 'prep-2-c')!
    auditReport.completed = false
    auditReport.remark = '稽核報告備註'

    const rows = buildPrepSheet(state).rows.filter((row) => typeof row[0] === 'number')
    expect(rows.map((row) => row[0])).toEqual(Array.from({ length: 23 }, (_, index) => index + 1))

    const correctiveRow = rows.find((row) => String(row[1]).includes('QR-28-03'))
    const auditRow = rows.find((row) => String(row[1]).includes('QR-28-07'))
    expect(correctiveRow).toEqual([3, 'QR-28-03 稽核矯正報告', '稽核員', '是', '矯正報告備註'])
    expect(auditRow).toEqual([4, 'QR-28-07 內外部稽核報告書', '稽核員', '', '稽核報告備註'])
  })

  it('keeps worksheet names unique for repeated audit events', () => {
    const state = createDemoState()
    const duplicate = { ...state.companies.jiurun.audits[0], id: 'event-repeat', auditDate: '2026-04-01' }
    state.companies.jiurun.audits.push(duplicate)
    const workbook = buildAllFormsWorkbook(state, 'jiurun')
    expect(new Set(workbook.SheetNames).size).toBe(workbook.SheetNames.length)
    expect(workbook.SheetNames.filter((name) => name.startsWith('02_QP-28')).length).toBe(2)
  })
})
