import { chromium } from 'playwright'
const url = 'http://127.0.0.1:43123/'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (msg) => { if (msg.type()==='error') errors.push('console:'+msg.text()) })
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('qms-annual-internal-audit')) localStorage.removeItem(k)
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const rootEmpty = (await page.locator('#root').innerHTML()).trim().length < 20
const tabs = []
for (const label of ['稽核總覽','標準','程序','方案風險與優先順序','年度稽核計畫','稽核員能力與任命','稽核執行與證據','不符合與矯正措施','觀察事項與追蹤','改善機會與建議','外部稽核前準備與序位','系統設定']) {
  try {
    await page.getByRole('button', { name: label }).first().click({ timeout: 5000 })
    await page.waitForTimeout(600)
    const text = await page.locator('body').innerText()
    const errBox = await page.locator('text=此分頁發生錯誤').count()
    tabs.push({ label, errBox, hasExport: /匯出|Excel|備份|還原/.test(text), sample: text.replace(/\s+/g,' ').slice(0,120) })
  } catch (e) {
    tabs.push({ label, error: String(e).slice(0,200) })
  }
}
console.log(JSON.stringify({ rootEmpty, errors, tabs }, null, 2))
await browser.close()
const fail = rootEmpty || errors.some(e=>/Unhandled|TabErrorBoundary|Cannot read|is not defined/.test(e)) || tabs.some(t=>t.errBox>0||t.error)
process.exit(fail?2:0)
