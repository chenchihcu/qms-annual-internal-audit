import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer, preview } from 'vite'

const root = process.cwd()
let dev
let prod
try {
  dev = await createServer({ root, server: { host: '127.0.0.1', port: 43123, strictPort: true } })
  await dev.listen()
} catch (error) {
  if (!String(error).includes('Port 43123 is already in use')) throw error
}
try {
  prod = await preview({ root, preview: { host: '127.0.0.1', port: 43124, strictPort: true } })
} catch (error) {
  if (!String(error).includes('Port 43124 is already in use')) throw error
}
await mkdir('artifacts/v6-visual', { recursive: true })

const browser = await chromium.launch({ headless: true })
const tabs = ['稽核總覽', '標準', '程序', '方案風險與優先順序', '年度稽核計畫', '稽核員能力與任命', '稽核執行與證據', '不符合與矯正措施', '觀察事項與追蹤', '改善機會與建議', '外部稽核前準備與序位', '系統設定']
const widths = [375, 768, 1280, 1536]
const findings = []
const errors = []

async function openTab(page, label, mobile) {
  if (mobile) {
    await page.getByRole('button', { name: '開啟導覽' }).click()
  }
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByText('正在載入頁面…', { exact: true }).waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(120)
}

const RISK_GROUP_TITLES = ['歷史結果', '現況壓力', '時間']
const RISK_FACTOR_LABELS = ['固有風險（1–5）', '上次內稽 NCR（1–5）', '上次第三方稽核 NCR（1–5）', '未結／逾期 NCR（1–5）', '客戶抱怨（1–5）', '重大變更（1–5）', '距上次稽核（1–5）']

async function verifyExpandedRiskCard(page, width, { fullFactors = false, interaction = false } = {}) {
  await page.locator('details').first().locator('summary').click()
  for (const groupTitle of RISK_GROUP_TITLES) {
    if (!await page.getByText(groupTitle, { exact: true }).count()) findings.push(`${width}:risk-group-missing:${groupTitle}`)
  }
  const factors = fullFactors ? RISK_FACTOR_LABELS : ['固有風險（1–5）']
  for (const factor of factors) {
    if (!await page.getByRole('radiogroup', { name: factor, exact: true }).count()) findings.push(`${width}:risk-factor-missing:${factor}`)
  }
  if (interaction) {
    const complaintGroup = page.getByRole('radiogroup', { name: '客戶抱怨（1–5）', exact: true })
    if (!await complaintGroup.count()) {
      findings.push(`${width}:risk-interaction-missing:客戶抱怨（1–5）`)
    } else {
      await complaintGroup.getByRole('radio', { name: '4', exact: true }).click()
      await page.waitForTimeout(150)
      const checked = await complaintGroup.getByRole('radio', { name: '4', exact: true }).getAttribute('aria-checked')
      if (checked !== 'true') findings.push(`${width}:risk-interaction-not-checked:客戶抱怨`)
      if (await page.getByRole('button', { name: '客戶抱怨', exact: true }).count()) findings.push(`${width}:risk-chip-still-visible:客戶抱怨`)
    }
  }
  await page.screenshot({ path: `artifacts/v6-visual/${width}-方案風險與優先順序-展開.png`, fullPage: true })
}

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  page.on('pageerror', (error) => errors.push(`${width}:pageerror:${error.message}`))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`${width}:console:${message.text()}`) })
  await page.goto('http://127.0.0.1:43123/#tab=dashboard', { waitUntil: 'networkidle' })
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('qms-annual-internal-audit')) localStorage.removeItem(key) })
  await page.reload({ waitUntil: 'networkidle' })
  const mobile = width < 1024
  await page.keyboard.press('Tab')
  const keyboardFocus = await page.evaluate(() => {
    const element = document.activeElement
    const style = element instanceof HTMLElement ? getComputedStyle(element) : null
    return { tag: element?.tagName, outline: style?.outlineStyle, boxShadow: style?.boxShadow, label: element?.getAttribute('aria-label') }
  })
  if (keyboardFocus.tag !== 'BUTTON' || (keyboardFocus.outline === 'none' && keyboardFocus.boxShadow === 'none')) findings.push(`${width}:keyboard-focus:${JSON.stringify(keyboardFocus)}`)
  for (const label of tabs) {
    await openTab(page, label, mobile)
    if (await page.getByText(`${label} 無法顯示`, { exact: true }).count()) findings.push(`${width}:${label}:error-boundary`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
    if (overflow) findings.push(`${width}:${label}:body-overflow`)
    if (['稽核執行與證據', '觀察事項與追蹤', '方案風險與優先順序', '稽核員能力與任命', '標準', '程序', '系統設定'].includes(label)) {
      await page.screenshot({ path: `artifacts/v6-visual/${width}-${label}.png`, fullPage: true })
    }
    if (label === '方案風險與優先順序') {
      const riskRows = await page.locator('details').count()
      if (riskRows < 28) findings.push(`${width}:risk-row-count:${riskRows}`)
      if (width === 1280) {
        await verifyExpandedRiskCard(page, width, { fullFactors: true })
      } else if (width === 375) {
        await verifyExpandedRiskCard(page, width, { interaction: true })
      }
    }
  }
  if (mobile) await page.getByRole('button', { name: '開啟導覽' }).click()
  await page.getByRole('button', { name: '回到稽核總覽', exact: true }).click()
  if (!page.url().includes('tab=dashboard')) findings.push(`${width}:home-button-route`)
  await openTab(page, '稽核員能力與任命', mobile)
  await page.getByRole('button', { name: '新增人員' }).click()
  if (!await page.getByText('新增人員與資格', { exact: true }).count()) findings.push(`${width}:person-form-missing`)
  if (width === 375) {
    await page.getByLabel('姓名 *').fill('未儲存測試')
    await page.screenshot({ path: 'artifacts/v6-visual/375-稽核員能力與任命-長表單.png', fullPage: true })
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('button', { name: '取消', exact: true }).click()
    if (!await page.getByText('新增人員與資格', { exact: true }).count()) findings.push('375:person-dirty-dismiss-lost-form')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '取消', exact: true }).click()
    if (await page.getByText('新增人員與資格', { exact: true }).count()) findings.push('375:person-dirty-accept-kept-form')
  } else if (width === 1280) {
    await page.getByLabel('姓名 *').fill('資格修訂測試員')
    await page.getByLabel('人員編號').fill('QA-E2E-001')
    await page.getByLabel('責任單位').last().selectOption('dept-qa')
    await page.getByLabel('任職／服務生效日').fill('2026-01-01')
    await page.getByLabel('標準與版本（逗號分隔）').fill('ISO 9001:2015')
    await page.getByLabel('可稽核程序（QP，逗號分隔）').fill('QP-28')
    await page.getByLabel('可稽核單位／陪同範圍').fill('dept-qa')
    await page.getByLabel('正式文件名稱').fill('稽核資格核准單')
    await page.getByLabel('文件編號').fill('QA-Q-001')
    await page.getByLabel('評定／確認人').fill('管理代表')
    await page.getByLabel('評定日期').fill('2026-01-01')
    await page.getByLabel('生效日期').fill('2026-01-01')
    await page.getByText('有效期間', { exact: true }).locator('..').locator('select').selectOption('fixed')
    await page.getByText('到期日', { exact: true }).locator('..').locator('input').fill('2026-12-31')
    await page.getByRole('button', { name: '儲存', exact: true }).click()
    const row = page.locator('tr', { hasText: '資格修訂測試員' })
    if (!await row.count()) findings.push('1280:person-save-row-missing')
    await row.getByRole('button', { name: '編輯', exact: true }).click()
    await page.getByLabel('文件編號').fill('QA-Q-002')
    await page.getByRole('button', { name: '儲存', exact: true }).click()
    const revision = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('qms-annual-internal-audit-v6') || '{}')
      const person = state.people?.find((item) => item.name === '資格修訂測試員')
      return {
        count: person?.qualifications?.length,
        superseded: person?.qualifications?.filter((item) => item.supersededAt).length,
        currentNumber: person?.qualifications?.find((item) => !item.supersededAt)?.documentNumber,
      }
    })
    if (revision.count !== 2 || revision.superseded !== 1 || revision.currentNumber !== 'QA-Q-002') findings.push(`1280:qualification-revision:${JSON.stringify(revision)}`)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '匯出名單', exact: true }).click()
    const download = await downloadPromise
    await download.saveAs('artifacts/release/personnel-list.xlsx')
    await openTab(page, '觀察事項與追蹤', mobile)
    await page.getByRole('button', { name: '登錄觀察事項', exact: true }).click()
    await page.getByLabel('來源事件／報告編號').fill('CB-2026-OBS-01')
    await page.getByLabel('發生日').fill('2026-08-20')
    await page.getByLabel('程序 QP').fill('QP-28')
    await page.getByLabel('責任單位').selectOption('dept-qa')
    await page.getByLabel('觀察事項', { exact: true }).fill('第三方逐次追蹤測試')
    await page.getByLabel('處理要求／說明').fill('補充受控紀錄')
    await page.getByRole('button', { name: '儲存紀錄', exact: true }).click()
    const observation = page.locator('article', { hasText: '第三方逐次追蹤測試' })
    if (!await observation.count()) findings.push('1280:third-party-observation-save')
    await observation.getByLabel('追蹤日期').fill('2026-08-25')
    await observation.getByLabel('新增本次追蹤紀錄').fill('2026-08-25 已補件')
    await observation.getByRole('button', { name: '加入時間軸', exact: true }).click()
    await observation.getByRole('button', { name: '編輯紀錄', exact: true }).click()
    await observation.getByLabel('結案日期').fill('2026-08-26')
    await observation.getByLabel('結案證據／紀錄').fill('DMS-CLOSE-001')
    await observation.getByRole('button', { name: '儲存修改', exact: true }).click()
    await observation.getByRole('button', { name: '結案', exact: true }).click()
    if (!await observation.getByText('已結案', { exact: true }).count()) findings.push('1280:third-party-observation-close')
    await openTab(page, '年度稽核計畫', mobile)
    await page.getByLabel('稽核年度').fill('2027')
    await openTab(page, '觀察事項與追蹤', mobile)
    const archivedObservation = page.locator('article', { hasText: '第三方逐次追蹤測試' })
    if (!await archivedObservation.count()) findings.push('1280:prior-year-observation-hidden')
    await archivedObservation.getByRole('button', { name: '重新開啟', exact: true }).click()
    await archivedObservation.getByLabel('追蹤日期').fill('2027-01-10')
    await archivedObservation.getByLabel('新增本次追蹤紀錄').fill('跨年再次查證')
    await archivedObservation.getByRole('button', { name: '加入時間軸', exact: true }).click()
    if (!await archivedObservation.getByText('跨年再次查證').count()) findings.push('1280:prior-year-follow-up-missing')
    await page.getByRole('button', { name: '帶入 2027 年查檢表', exact: true }).last().click()
    const archivedRecord = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('qms-annual-internal-audit-v6') || '{}')
      return state.yearArchives?.['2026']?.companies?.jiurun?.observations?.find((item) => item.content === '第三方逐次追蹤測試')
    })
    if (archivedRecord?.followUps?.length !== 2 || archivedRecord?.carryForwards?.[0]?.year !== 2027) findings.push(`1280:prior-year-ledger-not-persisted:${JSON.stringify(archivedRecord)}`)
  } else {
    await page.getByRole('button', { name: '取消', exact: true }).click()
  }
  await page.close()
}

const previewPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await previewPage.goto('http://127.0.0.1:43124/#tab=system-settings', { waitUntil: 'networkidle' })
for (const label of ['稽核總覽', '年度稽核計畫', '稽核執行與證據', '標準', '程序', '系統設定']) {
  await previewPage.getByRole('button', { name: label, exact: true }).click()
  if (await previewPage.getByText(`${label} 無法顯示`, { exact: true }).count()) findings.push(`preview:${label}:error-boundary`)
}
await previewPage.close()

await browser.close()
if (dev) await dev.close()
if (prod) await new Promise((resolve) => prod.httpServer.close(resolve))
console.log(JSON.stringify({ widths, tabCount: tabs.length, findings, errors }, null, 2))
if (findings.length || errors.length) process.exitCode = 2
