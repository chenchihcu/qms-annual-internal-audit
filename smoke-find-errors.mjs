import { chromium } from 'playwright'
const url='http://127.0.0.1:43123/'
const browser=await chromium.launch({headless:true})
const page=await browser.newPage()
const errors=[]
page.on('pageerror', e=>errors.push('page:'+e.message))
page.on('console', m=>{ if(m.type()==='error') errors.push('console:'+m.text()) })
await page.goto(url,{waitUntil:'networkidle',timeout:30000})
await page.evaluate(()=>{ for(const k of Object.keys(localStorage)) if(k.startsWith('qms-annual-internal-audit')) localStorage.removeItem(k) })
await page.reload({waitUntil:'networkidle'})
await page.waitForTimeout(700)
const rootLen=(await page.locator('#root').innerHTML()).trim().length
const findings=[]
if(rootLen<20) findings.push('首屏 #root 空白')
const tabs=['稽核總覽','標準','程序','方案風險與優先順序','年度稽核計畫','稽核員能力與任命','稽核執行與證據','不符合與矯正措施','觀察事項與追蹤','改善機會與建議','外部稽核前準備與序位','系統設定']
for(const label of tabs){
  try{
    await page.getByRole('button',{name:label}).first().click({timeout:4000})
    await page.waitForTimeout(500)
    const errBox=await page.locator('text=此分頁發生錯誤').count()
    const text=await page.locator('body').innerText()
    if(errBox>0) findings.push(`${label}: 分頁錯誤邊界觸發 — ${text.match(/此分頁發生錯誤：[^\n]+/)?.[0]||'未知'}`)
  }catch(e){ findings.push(`${label}: 無法點選 (${String(e).slice(0,80)})`) }
}
// check vite err log keywords via page only
console.log(JSON.stringify({rootLen, errors: errors.slice(0,20), findings},null,2))
await browser.close()
process.exit(findings.length||errors.length?2:0)
