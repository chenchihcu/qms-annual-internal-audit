import { createDemoState, STORAGE_KEY } from './src/data/demoData.ts'
import { PROCEDURE_PLAN_TEMPLATE } from './src/data/procedurePlan.ts'
import seed from './src/data/checklists.seed.json'

const s = createDemoState()
const co = s.companies.jiurun
const raw = (seed as any).proceduresRaw as Array<{procedureCode:string; department:string}>

console.log('STORAGE_KEY', STORAGE_KEY)
console.log('version', s.version)
console.log('prepItems', s.externalAuditPrep?.items?.length)
console.log('planRows', co.planRows.length)
console.log('audits', co.audits.length)
console.log('departments', co.departments.map(d=>d.id).join(','))

const demoAudits = co.audits.map(a => `${a.qpCode}|${a.departmentId}`)
console.log('demoAudits', demoAudits.join(' ; '))

let alignFail = 0
for (const a of co.audits) {
  const entry = PROCEDURE_PLAN_TEMPLATE.find(e => e.qpCode===a.qpCode && e.departmentId===a.departmentId)
    ?? PROCEDURE_PLAN_TEMPLATE.find(e => e.qpCode===a.qpCode)
  if (!entry) { console.log('NO_ENTRY', a.qpCode, a.departmentId); alignFail++ }
  else if (entry.departmentId !== a.departmentId) console.log('FALLBACK_ENTRY', a.qpCode, a.departmentId, '->', entry.departmentId)
}
for (const row of co.planRows) {
  const dept = co.departments.find(d => d.id===row.departmentId)
  if (!dept) { console.log('PLAN_ROW_NO_DEPT', row.id); alignFail++ }
  const badMonth = row.months.some(m => m != null && typeof m !== 'string')
  if (badMonth) { console.log('BAD_MONTHS', row.id, row.months); alignFail++ }
}

const needed = [['QP-28','dept-qa'],['QP-16','dept-qa'],['QP-20','dept-admin']]
for (const [qp,deptId] of needed) {
  const ok = PROCEDURE_PLAN_TEMPLATE.some(e => e.qpCode===qp && e.departmentId===deptId)
  console.log('NEED', qp, deptId, ok)
  if (!ok) alignFail++
}

console.log('seedFinalized', (seed as any).import?.finalized)
console.log('rawCount', raw?.length)
console.log('ALIGN_FAIL', alignFail)
