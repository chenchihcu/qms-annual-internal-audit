import { chromium } from 'playwright'

const origin = 'http://127.0.0.1:43999'
const browser = await chromium.launch({ headless: true })
const result = { errors: [], checks: [] }

for (const width of [375, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  page.on('pageerror', (error) => result.errors.push(`${width}:pageerror:${error.message}`))
  page.on('console', (message) => { if (message.type() === 'error') result.errors.push(`${width}:console:${message.text()}`) })
  await page.goto(`${origin}/#tab=procedure`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const body = await page.locator('body').innerText()
  result.checks.push({
    width,
    formCount: await page.locator('#procedure-settings-form').count(),
    purposeSection: await page.getByText('為什麼需要這一頁？', { exact: true }).count(),
    sourceSection: await page.getByText('查檢表來源與覆蓋範圍', { exact: true }).count(),
    flowSection: await page.getByText('流程銜接', { exact: true }).count(),
    navStandard: await page.getByRole('button', { name: '標準', exact: true }).count(),
    navProcedure: await page.getByRole('button', { name: '程序', exact: true }).count(),
    navSystem: await page.getByRole('button', { name: '系統設定', exact: true }).count(),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2),
    bodySample: body.slice(0, 180).replace(/\s+/g, ' '),
  })
  await page.screenshot({ path: `artifacts/v6-visual/procedure-page-${width}.png`, fullPage: true })
  await page.getByRole('link', { name: '標準', exact: true }).click()
  await page.waitForTimeout(200)
  result.checks.push({ width, check: 'procedure-to-standard-link', url: page.url(), standardForm: await page.locator('#standards-form').count() })
  await page.close()
}

console.log(JSON.stringify(result, null, 2))
await browser.close()
if (result.errors.length || result.checks.some((item) => item.overflow || item.formCount === 0 || item.purposeSection === 0 || item.sourceSection === 0 || item.flowSection === 0)) process.exitCode = 2
