import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDemoState } from '../../data/demoData'
import { buildExportWorkbookSmoke, buildAnnualPlanSheet, buildNcrSheet, buildAllFormsWorkbook, buildRiskSheet } from '../formExport'
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
    const ws = buildAnnualPlanSheet(state.companies.jiurun, state.settings)
    const rows = ws.rows
    const header = rows.find((r) => r[0] === '項次')
    expect(header).toBeDefined()
    expect(header).toContain('QP')
    expect(header).toContain('12')
  })

  it('NCR sheet includes demo NCR row', () => {
    const state = createDemoState()
    const ws = buildNcrSheet(state.companies.jiurun, state.settings)
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
