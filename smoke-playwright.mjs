import { chromium } from 'playwright'

const url = 'http://127.0.0.1:43123/'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror:' + e.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('console:' + msg.text())
})

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(800)

// clear old storage and reload to force v5 demo
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('qms-annual-internal-audit')) localStorage.removeItem(k)
  }
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

const title = await page.title()
const bodyText = await page.locator('body').innerText()
const hasCrash = /此分頁發生錯誤|Unhandled|Cannot read properties|白屏/.test(bodyText)
const rootHTML = await page.locator('#root').innerHTML().catch(() => '')
const rootEmpty = !rootHTML || rootHTML.trim().length < 20

async function clickTab(label) {
  const tab = page.getByRole('button', { name: label }).or(page.getByText(label, { exact: true }))
  await tab.first().click({ timeout: 5000 })
  await page.waitForTimeout(700)
  const text = await page.locator('body').innerText()
  const errBox = await page.locator('text=此分頁發生錯誤').count()
  return { label, errBox, sample: text.slice(0, 180).replace(/\s+/g, ' ') }
}

const tabs = []
for (const label of ['儀表板', '年度計畫', '程序稽核', '稽核前準備']) {
  try {
    tabs.push(await clickTab(label))
  } catch (e) {
    tabs.push({ label, error: String(e), errBox: -1 })
  }
}

console.log(JSON.stringify({
  title,
  rootEmpty,
  hasCrash,
  bodySample: bodyText.slice(0, 250).replace(/\s+/g, ' '),
  errors,
  tabs,
}, null, 2))

await browser.close()
if (rootEmpty || hasCrash || errors.some(e => /Unhandled|Cannot read|Audit entry/.test(e)) || tabs.some(t => t.errBox > 0 || t.error)) {
  process.exit(2)
}
