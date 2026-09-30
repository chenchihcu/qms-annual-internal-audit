import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'src')
const skip = new Set(['singleWorkspaceMigration.test.ts', 'sharedPlan.test.ts', 'useAuditStore.migration.test.ts'])

const replacements = [
  [/createDemoState\(\)\.companies\.jiurun/g, 'createDemoState().workspace'],
  [/createDemoState\(\)\.companySettings\.jiurun/g, 'createDemoState().settings'],
  [/createDemoState\(\)\.companyAuditProfiles\.jiurun/g, 'createDemoState().auditProfile'],
  [/demo\.companies\.jiurun/g, 'demo.workspace'],
  [/demo\.companySettings\.jiurun/g, 'demo.settings'],
  [/state\.companies\.jiurun/g, 'state.workspace'],
  [/state\.companySettings\.jiurun/g, 'state.settings'],
  [/state\.companyAuditProfiles\.jiurun/g, 'state.auditProfile'],
  [/removed\.companies\.jiurun/g, 'removed.workspace'],
  [/submitted\.companies\.jiurun/g, 'submitted.workspace'],
  [/restored\.companies\.jiurun/g, 'restored.workspace'],
  [/base\.companies\.jiurun/g, 'base.workspace'],
  [/next\.companySettings\.jiurun/g, 'next.settings'],
  [/stored\.companyAuditProfiles\[[^\]]+\]/g, 'stored.auditProfile'],
  [/state\.companyAuditProfiles\[companyId\]/g, 'state.auditProfile'],
  [/yearArchives\['2024'\]\.companies\.jiurun/g, "yearArchives['2024'].workspace"],
  [/removed\.yearArchives\['2024'\]\.companies/g, "removed.yearArchives['2024'].workspace"],
  [/restored\.state\.yearArchives\['2024'\]\.companies/g, "restored.state.yearArchives['2024'].workspace"],
  [/expect\(restored\.version\)\.toBe\(14\)/g, 'expect(restored.version).toBe(15)'],
  [/saved\.companies\?\.\[saved\.activeCompanyId\]/g, 'saved.workspace'],
]

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(test|smoke)\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

for (const file of walk(root)) {
  if (skip.has(path.basename(file))) continue
  let text = fs.readFileSync(file, 'utf8')
  const before = text
  for (const [re, rep] of replacements) {
    text = text.replace(re, rep)
  }
  if (text !== before) fs.writeFileSync(file, text)
}

console.log('test fixes applied')
