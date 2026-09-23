import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

await page.goto('http://127.0.0.1:43999/#tab=observations', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const bulk = page.getByRole('button', { name: '匯入全部待追蹤項目', exact: true })
const before = await page.getByText(/已帶入 2026 年/).count()
await bulk.click()
await page.waitForTimeout(250)
const after = await page.getByText(/已帶入 2026 年/).count()
const carryLabels = await page.locator('button').allTextContents()
const bulkEnabled = await bulk.isEnabled()

await page.goto('http://127.0.0.1:43999/#tab=system-settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const printButtons = await page.getByRole('button', { name: /列印/ }).filter({ visible: true }).count()
const standardInput = await page.locator('input').evaluateAll((elements) => elements.filter((element) => element.value === 'ISO 9001' || element.value === 'AS9100').length)

console.log(JSON.stringify({ errors, bulkEnabled, before, after, carryLabels: carryLabels.filter((label) => label.includes('帶入')), printButtons, standardInput }, null, 2))
await browser.close()
if (errors.length || !bulkEnabled || after < before) process.exitCode = 2
