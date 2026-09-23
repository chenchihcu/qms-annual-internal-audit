import { chromium } from 'playwright'

const url = 'http://127.0.0.1:43123/'
const browser = await chromium.launch({ headless: true })
const widths = [320, 375, 768, 1280, 1536]
const tabLabels = ['儀表板', '設定', '風險評估', '年度計畫', '程序稽核', '不符合', '觀察事項', '建議追蹤', '外部稽核準備']
const oldCopy = [
  '此分頁發生錯誤',
  '表格可左右滑動',
  '手動新增 NCR',
  '第三方稽核建議事項一覽表',
  '查檢表觀察判定',
  '目前編輯公司',
  '目前分頁',
]
const errors = []
const results = []

for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${width}:pageerror:${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${width}:console:${msg.text()}`)
  })
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('qms-annual-internal-audit')) localStorage.removeItem(key)
    }
  })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(500)

  const title = await page.title()
  const widthResults = []

  async function navigateTab(label) {
    if (width >= 1024) {
      const tab = page.getByRole('button', { name: label, exact: true })
      const count = await tab.count()
      if (count !== 1) throw new Error(`expected one desktop tab button for ${label}, got ${count}`)
      await tab.click({ timeout: 5000 })
    } else {
      const select = page.locator('#mobile-tab')
      const count = await select.count()
      if (count !== 1) throw new Error(`expected one mobile tab select, got ${count}`)
      await select.selectOption({ label })
    }
    await page.waitForTimeout(250)
    const text = await page.locator('body').innerText()
    const rootHTML = await page.locator('#root').innerHTML().catch(() => '')
    const stale = oldCopy.filter((phrase) => text.includes(phrase))
    const errBox = await page.getByText('頁面載入失敗', { exact: false }).count()
    return {
      label,
      errBox,
      rootEmpty: !rootHTML || rootHTML.trim().length < 20,
      stale,
      sample: text.slice(0, 180).replace(/\s+/g, ' '),
    }
  }

  for (const label of tabLabels) {
    try {
      widthResults.push(await navigateTab(label))
    } catch (e) {
      widthResults.push({ label, error: String(e), errBox: -1 })
    }
  }

  const widthResult = { width, title, tabs: widthResults }
  if (width === 1280) {
    const printTargets = [
      { label: '年度計畫', required: ['QR-28-01', 'QR-28-04', 'QR-28-05'] },
      { label: '程序稽核', required: ['QR-28-02'] },
      { label: '不符合', required: ['QR-28-03'] },
      { label: '風險評估', required: ['QR-02-01'] },
      { label: '外部稽核準備', required: ['外部稽核前準備事項（管理代表及相關部門確認）'] },
    ]
    widthResult.print = []
    for (const target of printTargets) {
      await page.emulateMedia({ media: 'screen' })
      await navigateTab(target.label)
      await page.emulateMedia({ media: 'print' })
      const printText = await page.locator('body').innerText()
      widthResult.print.push({
        label: target.label,
        missing: target.required.filter((phrase) => !printText.includes(phrase)),
      })
    }
    await page.emulateMedia({ media: 'screen' })
  }
  results.push(widthResult)
  await context.close()
}

console.log(JSON.stringify({
  widths,
  errors,
  results,
}, null, 2))

await browser.close()
const failed = results.some(({ tabs }) => tabs.some((tab) =>
  tab.errBox > 0 || tab.error || tab.rootEmpty || tab.stale?.length,
)) || results.some(({ print }) => print?.some((page) => page.missing.length))
if (failed || errors.some(e => /Unhandled|Cannot read|Audit entry/.test(e))) {
  process.exit(2)
}
