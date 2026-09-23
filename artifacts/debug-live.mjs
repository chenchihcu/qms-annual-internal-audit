import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
for (const id of ['plan', 'observations']) {
  await page.goto(`http://127.0.0.1:43999/#tab=${id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  console.log(JSON.stringify({
    id,
    url: page.url(),
    mainText: (await page.locator('main').innerText()).slice(0, 1200),
    anchors: await page.locator('a').evaluateAll((elements) => elements.map((element) => ({ text: element.textContent?.trim(), href: element.getAttribute('href') }))),
    headings: await page.locator('h2,h3').allTextContents(),
  }, null, 2))
}
await browser.close()
