import { chromium } from 'playwright'

const origin = process.argv[2] ?? 'http://127.0.0.1:43999'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const dialogs = []
page.on('dialog', async (dialog) => {
  dialogs.push(dialog.message())
  await dialog.dismiss()
})
const result = { errors: [], steps: [], observations: [] }
page.on('pageerror', (error) => result.errors.push(`pageerror:${error.message}`))
page.on('console', (message) => { if (message.type() === 'error') result.errors.push(`console:${message.text()}`) })

async function open(id) {
  await page.goto(`${origin}/#tab=${id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  const body = await page.locator('body').innerText()
  if (body.includes('無法顯示')) result.errors.push(`${id}:error-boundary`)
}

await open('plan')
await page.getByRole('button', { name: '預覽自動編排', exact: true }).click()
result.steps.push({ step: 'plan-preview', visible: await page.getByText('自動編排預覽', { exact: true }).count() > 0 })
await page.getByRole('button', { name: '取消', exact: true }).click()
await page.getByRole('button', { name: '預覽自動編排', exact: true }).click()
await page.getByRole('button', { name: '套用預覽', exact: true }).click()
const monthButton = page.locator('table tbody tr').first().locator('button').first()
const monthBefore = await monthButton.innerText()
await monthButton.click()
result.steps.push({ step: 'plan-month-cycle', before: monthBefore, after: await monthButton.innerText() })

await open('risk')
const firstRisk = page.locator('details').first()
await firstRisk.locator('summary').click()
const riskKey = await firstRisk.getAttribute('data-risk-key')
if (!riskKey) result.errors.push('risk:missing-stable-key')
const riskCard = riskKey ? page.locator(`details[data-risk-key="${riskKey}"]`) : firstRisk
const inherentGroup = riskCard.getByRole('radiogroup', { name: '固有風險（1–5）', exact: true })
const riskBefore = await inherentGroup.getByRole('radio', { name: '4', exact: true }).getAttribute('aria-checked')
await inherentGroup.getByRole('radio', { name: '4', exact: true }).click()
await page.waitForTimeout(250)
const riskAfter = await inherentGroup.getByRole('radio', { name: '4', exact: true }).getAttribute('aria-checked')
const riskStorage = await page.evaluate(({ activeCompanyId, riskKey: key }) => {
  const state = JSON.parse(localStorage.getItem('qms-annual-internal-audit-v6') || '{}')
  const company = state.companies?.[activeCompanyId]
  const plan = company?.planRows?.find((row) => row.id === key)
  const saved = company?.procedureRisks?.find(
    (item) => item.qpCode === plan?.qpCode && item.departmentId === plan?.departmentId,
  )
  return saved?.inherentRisk
}, { activeCompanyId: await page.evaluate(() => JSON.parse(localStorage.getItem('qms-annual-internal-audit-v6') || '{}').activeCompanyId), riskKey })
result.steps.push({ step: 'risk-edit', before: riskBefore, after: riskAfter, stored: riskStorage })

await open('audit')
const startButton = page.getByRole('button', { name: '開始稽核', exact: true })
const startDisabled = await startButton.isDisabled()
result.steps.push({ step: 'audit-start-validation', disabled: startDisabled, blockers: await page.locator('text=阻擋：').allTextContents() })
if (!startDisabled) await startButton.click()

await open('ncr')
const ncrRow = page.locator('tbody tr').first()
if (await ncrRow.count()) {
  await ncrRow.getByRole('combobox').selectOption('結案')
  result.steps.push({ step: 'ncr-close-guard', alert: dialogs.at(-1) ?? null })
  const rowInputs = ncrRow.locator('input')
  await rowInputs.nth(0).fill('CA-2026-01')
  await rowInputs.nth(1).fill('EV-2026-01')
  await rowInputs.nth(2).fill('品質主管')
  await rowInputs.nth(3).fill('2026-09-16')
  await ncrRow.getByRole('combobox').selectOption('結案')
  result.steps.push({ step: 'ncr-close-complete', status: await ncrRow.getByRole('combobox').inputValue() })
}

await open('suggestions')
const suggestionRow = page.locator('tbody tr').first()
if (await suggestionRow.count()) {
  await suggestionRow.locator('textarea').fill('流程操作測試')
  result.steps.push({ step: 'suggestion-edit', value: await suggestionRow.locator('textarea').inputValue() })
}

await open('prep')
const prepRow = page.locator('tbody tr').first()
if (await prepRow.count()) {
  const checkbox = prepRow.locator('input[type=checkbox]').first()
  const prepBefore = await checkbox.isChecked()
  await checkbox.setChecked(!prepBefore)
  result.steps.push({ step: 'prep-toggle', before: prepBefore, after: await checkbox.isChecked() })
}

await open('standard')
const standardInputCount = await page.locator('input').evaluateAll((elements) => elements.filter((element) => element.value === 'ISO 9001' || element.value === 'AS9100').length)
result.observations.push({ issue: 'standard-field-readonly', editableStandardInputCount: standardInputCount })
result.observations.push({ issue: 'local-print-duplicate', count: await page.getByRole('button', { name: /列印/ }).count() })

await page.setViewportSize({ width: 375, height: 900 })
await open('observations')
const observationBody = await page.locator('body').innerText()
result.observations.push({ issue: 'cross-year-single-workspace', body: observationBody.slice(0, 500), oldBulkSection: await page.getByText('跨年度追蹤匯入', { exact: true }).count(), consolidatedSection: await page.getByText('跨年度追蹤', { exact: true }).count() })

console.log(JSON.stringify(result, null, 2))
await browser.close()
if (result.errors.length) process.exitCode = 2
