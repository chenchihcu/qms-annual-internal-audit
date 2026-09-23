import { chromium } from 'playwright'
const url='http://127.0.0.1:43123/'
const browser=await chromium.launch({headless:true})
const page=await browser.newPage()
const errors=[]
const findings=[]
page.on('pageerror', e=>errors.push(e.message))
page.on('console', m=>{ if(m.type()==='error') errors.push('c:'+m.text()) })
await page.goto(url,{waitUntil:'networkidle',timeout:30000})
await page.evaluate(()=>{ for(const k of Object.keys(localStorage)) if(k.startsWith('qms-annual-internal-audit')) localStorage.removeItem(k) })
await page.reload({waitUntil:'networkidle'})
await page.waitForTimeout(600)
if ((await page.locator('#root').innerHTML()).trim().length<20) findings.push('root empty')

const tabs=['稽核總覽','標準','程序','方案風險與優先順序','年度稽核計畫','稽核員能力與任命','稽核執行與證據','不符合與矯正措施','觀察事項與追蹤','改善機會與建議','外部稽核前準備與序位','系統設定']
for (const label of tabs) {
  await page.getByRole('button',{name:label}).first().click({timeout:5000})
  await page.waitForTimeout(450)
  if (await page.locator('text=此分頁發生錯誤').count()) findings.push('tab crash '+label)
}
for (const company of ['正隆興精密','九潤精密']) {
  await page.getByRole('button',{name:company}).first().click({timeout:5000})
  await page.waitForTimeout(400)
  await page.getByRole('button',{name:'稽核總覽'}).first().click()
  await page.waitForTimeout(400)
  if (await page.locator('text=此分頁發生錯誤').count()) findings.push('company crash '+company)
  const body=await page.locator('body').innerText()
  if (!body.includes(company.replace('精密','')) && !body.includes(company)) {
    // soft
  }
}
await page.getByRole('button',{name:'系統設定'}).first().click()
await page.waitForTimeout(500)
const settingsText=await page.locator('body').innerText()
const need=['備份','還原','匯出']
for (const n of need) if (!settingsText.includes(n)) findings.push('settings missing '+n)
if (settingsText.includes('re-import')||settingsText.includes('再匯入')||settingsText.includes('查檢表 re-import')||settingsText.includes('上傳')) {
  findings.push('INFO has import UI')
} else {
  findings.push('GAP no checklist re-import UI on local')
}
console.log(JSON.stringify({errors, findings, settingsHasBackup: settingsText.includes('備份')},null,2))
await browser.close()
process.exit((errors.length||findings.some(f=>f.startsWith('tab')||f.startsWith('company')||f.startsWith('root')||f.startsWith('settings')))?2:0)
