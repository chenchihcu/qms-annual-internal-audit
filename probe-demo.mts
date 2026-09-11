import { createDemoState } from './src/data/demoData.ts'
const s = createDemoState()
const rows = s.companies.jiurun.planRows
console.log('rows', rows.length)
for (const row of rows.slice(0, 5)) {
  console.log(row.id, row.months, row.months.map((m: unknown) => typeof m + ':' + JSON.stringify(m)))
}
const bad = rows.filter((r) => r.months.some((m: unknown) => m != null && typeof m !== 'string'))
console.log('bad', bad.length)
