import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const origin = 'https://as9100qms.netlify.app'
const index = await readFile('dist/index.html', 'utf8')
const bundle = index.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1]
if (!bundle) throw new Error('Built index has no entry bundle')

const response = await fetch(`${origin}/`, { cache: 'no-store' })
const remoteIndex = await response.text()
if (!response.ok || !remoteIndex.includes(bundle)) {
  throw new Error(`Production asset mismatch: HTTP ${response.status}, expected ${bundle}`)
}

const browser = await chromium.launch({ headless: true })
const tabs = [
  '稽核總覽',
  '利害關係人',
  '方案風險',
  '人員合格名單',
  '年度稽核計畫',
  '查檢表',
  '觀察事項',
  '不符合',
  '第三方建議',
  '待改善追蹤',
  '外稽準備',
  '系統設定',
]
const widths = [375, 768, 1280, 1536]
const findings = []
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    page.on('pageerror', (error) => findings.push(`${width}:pageerror:${error.message}`))
    page.on('console', (message) => { if (message.type() === 'error') findings.push(`${width}:console:${message.text()}`) })
    await page.goto(`${origin}/#tab=dashboard`, { waitUntil: 'networkidle' })
    const mobile = width < 1024
    for (const tab of tabs) {
      if (mobile) await page.getByRole('button', { name: '開啟導覽' }).click()
      await page.getByRole('button', { name: tab, exact: true }).click()
      await page.getByText('正在載入頁面…', { exact: true }).waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
      if (await page.getByText(`${tab} 無法顯示`, { exact: true }).count()) findings.push(`${width}:${tab}:error-boundary`)
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)) findings.push(`${width}:${tab}:overflow`)
    }
    await context.close()
  }
} finally {
  await browser.close()
}

const result = { origin, bundle, widths, pages: tabs.length, findings }
console.log(JSON.stringify(result, null, 2))
if (findings.length) process.exitCode = 1
