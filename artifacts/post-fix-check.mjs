import { chromium } from 'playwright'

const origin = 'http://127.0.0.1:43999'
const tabs = ['dashboard', 'standard', 'procedure', 'plan', 'risk', 'personnel', 'prep', 'audit', 'ncr', 'observations', 'suggestions', 'system-settings']
const browser = await chromium.launch({ headless: true })
const result = { errors: [], checks: [] }

for (const width of [375, 768, 1280, 1536]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  page.on('pageerror', (error) => result.errors.push(`${width}:pageerror:${error.message}`))
  page.on('console', (message) => { if (message.type() === 'error') result.errors.push(`${width}:console:${message.text()}`) })
  for (const id of tabs) {
    await page.goto(`${origin}/#tab=${id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const body = await page.locator('body').innerText()
    result.checks.push({ width, id, errorBoundary: body.includes('無法顯示'), overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) })
    if (id === 'plan') {
      const processForm = page.locator('#annual-plan-form')
      await processForm.waitFor({ state: 'visible' })
      result.checks.push({ width, id, check: 'annual-plan-single-form', formCount: await processForm.count(), annualYearInput: await page.getByLabel('稽核年度', { exact: true }).count(), planWindowStart: await page.getByLabel('計畫窗口起', { exact: true }).count(), planWindowEnd: await page.getByLabel('計畫窗口迄', { exact: true }).count(), leadAuditor: await page.getByLabel('主任稽核員', { exact: true }).count(), externalAuditDate: await page.getByLabel('外部稽核日期', { exact: true }).count(), managementReviewDate: await page.getByLabel('管理審查日期', { exact: true }).count() })
    }
    if (id === 'standard') {
      result.checks.push({ width, id, check: 'standard-single-form', formCount: await page.locator('#standards-form').count(), certificateScope: await page.getByLabel('證書範圍', { exact: true }).count(), fixedStandardInput: await page.locator('input').evaluateAll((elements) => elements.some((element) => element.value === 'ISO 9001' || element.value === 'AS9100')) })
    }
    if (id === 'procedure') {
      result.checks.push({ width, id, check: 'procedure-single-form', formCount: await page.locator('#procedure-settings-form').count(), procedureCode: await page.getByLabel('稽核程序代碼', { exact: true }).count(), procedureVersion: await page.getByLabel('程序版本', { exact: true }).count(), recordLocation: await page.getByLabel('正式紀錄保存位置', { exact: true }).count(), purposeSection: await page.getByText('為什麼需要這一頁？', { exact: true }).count(), lifecycleSection: await page.getByText('年度資料生命週期與追溯', { exact: true }).count() })
    }
    if (id === 'system-settings') {
      result.checks.push({ width, id, check: 'system-settings-single-form', formCount: await page.locator('#system-settings-form').count(), backup: await page.getByRole('button', { name: '備份', exact: true }).count(), exportAll: await page.getByRole('button', { name: /匯出九潤全部表單/ }).count(), visiblePrintButtons: await page.getByRole('button', { name: /列印/ }).filter({ visible: true }).count().catch(() => -1) })
    }
    if (id === 'observations') {
      const consolidatedHeading = page.getByText('跨年度追蹤', { exact: true })
      await consolidatedHeading.waitFor({ state: 'visible' })
      result.checks.push({ width, id, check: 'cross-year-single-workspace', oldBulkCardHeading: await page.getByText('跨年度追蹤匯入', { exact: true }).count(), consolidatedHeading: await consolidatedHeading.count() })
    }
    if (id === 'ncr' || id === 'personnel') {
      result.checks.push({ width, id, check: 'global-print-only', visiblePrintButtons: await page.getByRole('button', { name: /列印/ }).filter({ visible: true }).count().catch(() => -1) })
    }
  }
  await page.goto(`${origin}/#tab=audit`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(180)
  result.checks.push({ width, id: 'audit', check: 'desktop-control-names', eventSelector: await page.getByLabel('目前稽核事件').count(), notifyDate: await page.getByLabel('通知日期').count(), checklistContent: await page.getByLabel(/稽核內容 1/).count(), checklistDescription: await page.getByLabel(/內容說明 1/).count() })
  await page.screenshot({ path: `artifacts/v6-visual/postfix-${width}-程序稽核.png`, fullPage: true })
}

console.log(JSON.stringify(result, null, 2))
await browser.close()
if (result.errors.length || result.checks.some((item) => item.errorBoundary || item.overflow || (item.check === 'procedure-single-form' && (item.formCount === 0 || item.purposeSection === 0 || item.lifecycleSection === 0)))) process.exitCode = 2
