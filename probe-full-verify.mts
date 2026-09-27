import { createDemoState } from './src/data/demoData.ts'
import { PROCEDURE_PLAN_TEMPLATE } from './src/data/procedurePlan.ts'
import { createChecklistForProcedure, getSeedStats, isSeedFinalized } from './src/data/checklistLoader.ts'
import { backupFilename, describeBackup, parseBackupJson, serializeBackup } from './src/lib/backup.ts'
import { exportAnnualPlanExcel, exportAllFormsExcel, exportNcrExcel, exportAuditExcel } from './src/lib/formExport.ts'

const issues: string[] = []
const state = createDemoState()
const stats = getSeedStats()
if (!isSeedFinalized()) issues.push('seed not finalized')
if (stats.uniqueQpCodes < 28) issues.push(`QP ${stats.uniqueQpCodes}/28`)
if (stats.procedureEntries < 29) issues.push(`entries ${stats.procedureEntries}`)

for (const id of ['jiurun','zhenglongxing'] as const) {
  const co = state.companies[id]
  if (co.planRows.length !== 31) issues.push(`${id} planRows=${co.planRows.length}`)
  for (const row of co.planRows) {
    if (!co.departments.some(d => d.id === row.departmentId)) issues.push(`${id} missing dept ${row.id}`)
    if (!Array.isArray(row.months) || row.months.length !== 12) issues.push(`${id} months ${row.id}`)
    try {
      const items = createChecklistForProcedure(row.qpCode, row.department)
      if (!items.length) issues.push(`${id} empty checklist ${row.qpCode}`)
    } catch { issues.push(`${id} checklist throw ${row.qpCode}`) }
  }
  for (const a of co.audits) {
    const entry = PROCEDURE_PLAN_TEMPLATE.find(e => e.qpCode===a.qpCode && e.departmentId===a.departmentId)
      ?? PROCEDURE_PLAN_TEMPLATE.find(e => e.qpCode===a.qpCode)
    if (!entry) issues.push(`${id} audit orphan ${a.qpCode}`)
  }
}

try {
  const json = serializeBackup(state)
  const parsed = parseBackupJson(json)
  if (!parsed) issues.push('backup roundtrip fail')
  if (!backupFilename(state).endsWith('.json')) issues.push('backup filename')
  describeBackup(parsed as any)
} catch (e) { issues.push('backup throw '+e) }

try { exportAnnualPlanExcel(state,'jiurun') } catch(e){ issues.push('export plan '+e) }
try { exportAllFormsExcel(state,'jiurun') } catch(e){ issues.push('export all '+e) }
try { exportNcrExcel(state,'jiurun') } catch(e){ issues.push('export ncr '+e) }
try {
  const a = state.companies.jiurun.audits[0]
  if (a) exportAuditExcel(state,'jiurun',a)
} catch(e){ issues.push('export audit '+e) }

const fs = await import('node:fs')
const hasImport = fs.existsSync('src/lib/checklistImport.ts')
const hasAttach = fs.existsSync('src/lib/evidence') || fs.existsSync('src/components/Evidence')
console.log(JSON.stringify({ stats, prep: state.externalAuditPrep?.items?.length, hasImport, hasAttach, issues, issueCount: issues.length }, null, 2))
