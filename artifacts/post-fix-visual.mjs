import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
for (const width of [375, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  for (const id of ['plan', 'observations', 'settings']) {
    await page.goto(`http://127.0.0.1:43999/#tab=${id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `artifacts/v6-visual/postfix-${width}-${id}.png`, fullPage: true })
  }
  await page.close()
}
await browser.close()
