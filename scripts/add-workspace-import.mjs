import fs from 'node:fs'
import path from 'node:path'

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

for (const file of walk(path.join(process.cwd(), 'src/components'))) {
  let text = fs.readFileSync(file, 'utf8')
  if (!text.includes('WORKSPACE_COMPANY_ID')) continue
  if (text.includes('singleWorkspaceMigration')) continue
  const rel = file.includes(`${path.sep}__tests__${path.sep}`)
    ? '../../lib/singleWorkspaceMigration'
    : '../lib/singleWorkspaceMigration'
  const imp = `import { WORKSPACE_COMPANY_ID } from '${rel}'\n`
  const firstImport = text.match(/^import .+\n/m)
  if (firstImport) text = text.replace(firstImport[0], firstImport[0] + imp)
  else text = imp + text
  text = text.replace(/\.companyAuditProfiles\[WORKSPACE_COMPANY_ID\]/g, '.auditProfile')
  text = text.replace(/state\.companyAuditProfiles/g, 'state.auditProfile')
  fs.writeFileSync(file, text)
}

console.log('done')
