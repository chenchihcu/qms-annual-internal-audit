import { chromium } from 'playwright'

const tabs = [
  ['dashboard', '稽核總覽'],
  ['standard', '標準'],
  ['procedure', '程序'],
  ['risk', '方案風險與優先順序'],
  ['plan', '年度稽核計畫'],
  ['personnel', '稽核員能力與任命'],
  ['audit', '稽核執行與證據'],
  ['ncr', '不符合與矯正措施'],
  ['observations', '觀察事項與追蹤'],
  ['suggestions', '改善機會與建議'],
  ['prep', '外部稽核前準備與序位'],
  ['system-settings', '系統設定'],
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const result = []

for (const [id, label] of tabs) {
  await page.goto(`http://127.0.0.1:43123/#tab=${id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  const controls = await page.locator('button, input, select, textarea, a').evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type') ?? '',
      name: element.getAttribute('aria-label') || element.getAttribute('title') || (element.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 80),
      placeholder: element.getAttribute('placeholder') ?? '',
      labelledBy: element.getAttribute('aria-labelledby') ?? '',
      value: 'value' in element ? String(element.value) : '',
    })))
  const buttons = controls.filter((control) => control.tag === 'button')
  const unnamed = controls.filter((control) => ['input', 'select', 'textarea'].includes(control.tag) && !control.name && !control.labelledBy && !control.placeholder)
  const buttonCounts = Object.entries(Object.groupBy(buttons, (button) => button.name))
    .filter(([, items]) => items.length > 1)
    .map(([name, items]) => ({ name, count: items.length }))
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  result.push({ id, label, buttonCounts, unnamed, overflow })
}

console.log(JSON.stringify(result, null, 2))
await browser.close()
