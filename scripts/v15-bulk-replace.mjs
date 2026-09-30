import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'src')
const skip = new Set([
  'singleWorkspaceMigration.ts',
  'workspaceSchemaV15.ts',
  'migrate.ts',
  'sharedPlan.ts',
  'demoData.ts',
  'backup.ts',
  'types/index.ts',
])

const replacements = [
  [/patchCompany\(state, state\.activeCompanyId,/g, 'patchWorkspace(state,'],
  [/patchCompany\(s, s\.activeCompanyId,/g, 'patchWorkspace(s,'],
  [/patchCompany\(next, next\.activeCompanyId,/g, 'patchWorkspace(next,'],
  [/state\.companies\[state\.activeCompanyId\]/g, 'state.workspace'],
  [/s\.companies\[s\.activeCompanyId\]/g, 's.workspace'],
  [/next\.companies\[next\.activeCompanyId\]/g, 'next.workspace'],
  [/state\.companies\.jiurun/g, 'state.workspace'],
  [/state\.companySettings\[state\.activeCompanyId\]/g, 'state.settings'],
  [/s\.companySettings\[s\.activeCompanyId\]/g, 's.settings'],
  [/state\.companySettings\.jiurun/g, 'state.settings'],
  [/state\.companyAuditProfiles\[state\.activeCompanyId\]/g, 'state.auditProfile'],
  [/s\.companyAuditProfiles\[s\.activeCompanyId\]/g, 's.auditProfile'],
  [/state\.companyAuditProfiles\.jiurun/g, 'state.auditProfile'],
  [/archive\.companies\[[^\]]+\]/g, 'archive.workspace'],
  [/yearArchives\[[^\]]+\]\.companies\[[^\]]+\]/g, (m) => m.replace('.companies', '.workspace').replace(/\[[^\]]+\]$/, '.workspace')],
  [/\.yearArchives\[year\]\.companies\[[^\]]+\]/g, '.yearArchives[year].workspace'],
  [/s\.activeCompanyId/g, 'WORKSPACE_COMPANY_ID'],
  [/state\.activeCompanyId/g, 'WORKSPACE_COMPANY_ID'],
  [/next\.activeCompanyId/g, 'WORKSPACE_COMPANY_ID'],
]

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

for (const file of walk(root)) {
  if (skip.has(path.basename(file))) continue
  if (file.endsWith('types\\index.ts') || file.endsWith('types/index.ts')) continue
  let text = fs.readFileSync(file, 'utf8')
  const before = text
  for (const [re, rep] of replacements) {
    text = typeof rep === 'function' ? text.replace(re, rep) : text.replace(re, rep)
  }
  if (text !== before) fs.writeFileSync(file, text)
}

console.log('done')
