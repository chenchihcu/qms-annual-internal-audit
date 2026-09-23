import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'))
const packageLock = JSON.parse(await readFile(new URL('./package-lock.json', import.meta.url), 'utf8'))
const requested = packageJson.devDependencies?.playwright
const locked = packageLock.packages?.['node_modules/playwright']

if (!requested || !locked) throw new Error('Playwright dependency metadata is missing')
if (packageLock.packages?.['node_modules/xlsx']) throw new Error('Vulnerable xlsx dependency remains in package-lock.json')

const targetVersion = '1.55.1'
if (locked.version !== targetVersion) {
  throw new Error(`Playwright lock version ${locked.version} does not match required ${targetVersion}`)
}
const metadata = {}
for (const name of ['playwright', 'playwright-core']) {
  const response = await fetch(`https://registry.npmjs.org/${name}/${targetVersion}`)
  if (!response.ok) throw new Error(`Unable to fetch ${name}@${targetVersion}: HTTP ${response.status}`)
  const entry = await response.json()
  metadata[name] = {
    version: entry.version,
    resolved: entry.dist.tarball,
    integrity: entry.dist.integrity,
    dependencies: entry.dependencies ?? {},
    optionalDependencies: entry.optionalDependencies ?? {},
  }
}

console.log(JSON.stringify({ requested, lockedVersion: locked.version, targetVersion, metadata }, null, 2))
