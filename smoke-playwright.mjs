import { chromium } from 'playwright'

const url = 'http://127.0.0.1:43124/'
const browser = await chromium.launch({ headless: true })
console.log('browser_smoke progress=browser-launched url=127.0.0.1:43124')
const widths = [320, 375, 768, 1280, 1536]
const tabLabels = [
  '稽核總覽',
  '利害關係人',
  '風險來源登錄',
  '方案風險',
  '人員合格名單',
  '年度稽核計畫',
  '查檢表',
  '觀察事項',
  '不符合',
  '第三方建議',
  '待改善追蹤',
  '系統設定',
]
const oldCopy = [
  '此分頁發生錯誤',
  '目前編輯公司',
  '目前分頁',
]
const errors = []
const results = []

for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultTimeout(3000)
  page.on('pageerror', (e) => errors.push(`${width}:pageerror:${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${width}:console:${msg.text()}`)
  })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.waitForTimeout(500)
  console.log(`browser_smoke progress=page-loaded width=${width}`)

  const title = await page.title()
  const widthResults = []
  await openMobileNavIfNeeded()
  const nav = page.getByRole('navigation', { name: '依稽核流程的表單導覽' })
  const navLabels = (await nav.getByRole('button').allTextContents()).map((label) => label.trim())
  const staleNav = navLabels.filter((label) => ['標準', '程序', '稽核日程', '外稽當日行程'].includes(label))
  const missingNav = tabLabels.filter((label, index) => navLabels[index] !== label)
  if (navLabels.length !== tabLabels.length || staleNav.length || missingNav.length) {
    widthResults.push({
      label: '左側選單',
      error: `導覽不符：${JSON.stringify({ navLabels, staleNav, missingNav })}`,
      errBox: -1,
    })
  }

  async function openMobileNavIfNeeded() {
    if (width >= 1024) return
    const menu = page.locator('button[aria-controls="mobile-sidebar"]')
    if (await menu.count() === 1 && await menu.getAttribute('aria-expanded') !== 'true') {
      await menu.click({ timeout: 2000 })
      await page.waitForTimeout(200)
    }
  }

  async function navigateTab(label) {
    await openMobileNavIfNeeded()
    const tab = page.getByRole('button', { name: label, exact: true })
    const count = await tab.count()
    if (count !== 1) throw new Error(`expected exactly one tab button for ${label}, got ${count}`)
    await tab.click({ timeout: 2000 })
    const becameCurrent = await page.waitForFunction((expected) => {
      if (document.body.innerText.includes('正在載入頁面…')) return false
      const sidebarCurrent = [...document.querySelectorAll('button[aria-current="page"]')]
        .some((node) => (node.innerText || '').replace(/\s+/g, ' ').trim() === expected)
      if (!sidebarCurrent) return false
      return Boolean(document.querySelector(`form[aria-label="${expected}表單"], [aria-label="${expected}"]`))
    }, label, { timeout: 8000 }).then(() => true).catch(() => false)
    if (!becameCurrent) throw new Error(`expected ${label} to be the current page`)
    const text = await page.locator('body').innerText()
    const rootHTML = await page.locator('#root').innerHTML().catch(() => '')
    const stale = oldCopy.filter((phrase) => text.includes(phrase))
    const errBox = await page.getByText('無法顯示', { exact: false }).count()
    return {
      label,
      errBox,
      rootEmpty: !rootHTML || rootHTML.trim().length < 20,
      horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      stale,
      sample: text.slice(0, 180).replace(/\s+/g, ' '),
    }
  }

  // 外稽準備是查檢表的檢視模式：側欄只留「查檢表」，由檢視切換進入
  async function openPrepView() {
    await navigateTab('查檢表')
    const viewButton = page.getByRole('button', { name: /^外稽準備 \d+\/\d+$/ })
    if (await viewButton.count() !== 1) throw new Error('查檢表缺少唯一的「外稽準備」檢視切換')
    await viewButton.click({ timeout: 2000 })
    await page.getByRole('region', { name: '外部稽核前準備清單' }).waitFor({ state: 'visible', timeout: 5000 })
    const sidebarCurrent = await page.locator('button[aria-current="page"]').allTextContents()
    if (!sidebarCurrent.some((label) => label.trim() === '查檢表')) throw new Error('外稽準備檢視時側欄未標示查檢表')
    const text = await page.locator('body').innerText()
    return {
      label: '外稽準備（查檢表檢視）',
      errBox: await page.getByText('無法顯示', { exact: false }).count(),
      rootEmpty: false,
      horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      stale: oldCopy.filter((phrase) => text.includes(phrase)),
      sample: text.slice(0, 180).replace(/\s+/g, ' '),
    }
  }

  for (const label of tabLabels) {
    try {
      widthResults.push(await navigateTab(label))
    } catch (e) {
      widthResults.push({ label, error: String(e).split('\n').slice(0, 2).join(' '), errBox: -1 })
    }
  }
  try {
    widthResults.push(await openPrepView())
  } catch (e) {
    widthResults.push({ label: '外稽準備（查檢表檢視）', error: String(e).split('\n').slice(0, 2).join(' '), errBox: -1 })
  }

  const widthResult = { width, title, tabs: widthResults }
  if (width === 1280) {
    const printTargets = [
      { label: '年度稽核計畫', required: ['QR-28-01', 'QR-28-04', 'QR-28-05'] },
      { label: '查檢表', required: ['QR-28-02'] },
      { label: '不符合', required: ['QR-28-03'] },
      { label: '方案風險', required: ['QR-02-01'] },
      { label: '外稽準備', required: ['外部稽核前準備事項'] },
    ]
    widthResult.print = []
    for (const target of printTargets) {
      await page.emulateMedia({ media: 'screen' })
      if (target.label === '外稽準備') await openPrepView()
      else await navigateTab(target.label)
      await page.waitForFunction(
        (phrases) => phrases.some((phrase) => document.body.innerText.includes(phrase)),
        target.required,
        { timeout: 5000 },
      ).catch(() => {})
      await page.waitForTimeout(300)
      await page.emulateMedia({ media: 'print' })
      const printText = await page.locator('body').innerText()
      widthResult.print.push({
        label: target.label,
        missing: target.required.filter((phrase) => !printText.includes(phrase)),
      })
    }
    await page.emulateMedia({ media: 'screen' })

    let workflowStage = '年度計畫分頁'
    let personnelPermanentDeleteVerified = false
    let planScheduleVerified = false
    try {
      await navigateTab('年度稽核計畫')
      const planPagination = page.getByRole('navigation', { name: '年度稽核計畫分頁' })
      await planPagination.waitFor({ state: 'visible', timeout: 5000 })
      const planSummary = planPagination.locator('p')
      const firstPageSummary = await planSummary.innerText()
      const nextPlanPage = planPagination.getByRole('button', { name: '年度稽核計畫下一頁', exact: true })
      if (!await nextPlanPage.isEnabled()) throw new Error('年度計畫示範資料未提供可驗證的第二頁')
      await nextPlanPage.click()
      const secondPageSummary = await planSummary.innerText()
      if (firstPageSummary === secondPageSummary) throw new Error('年度計畫分頁切換後範圍未更新')
      await planPagination.getByRole('button', { name: '年度稽核計畫上一頁', exact: true }).click()

      workflowStage = '年度計畫月格排程保存'
      const planGrid = page.getByRole('region', { name: '年度稽核計畫月格表' })
      const planMonthButtons = planGrid.getByRole('button')
      const planMonthCount = await planMonthButtons.count()
      let emptyScheduledCellIndex = -1
      for (let index = 0; index < planMonthCount; index += 1) {
        const title = await planMonthButtons.nth(index).getAttribute('title')
        if (title?.startsWith('排程：空白')) {
          emptyScheduledCellIndex = index
          break
        }
      }
      if (emptyScheduledCellIndex < 0) throw new Error('目前年度計畫沒有可驗證的空白排程月格')
      const planMonthButton = planMonthButtons.nth(emptyScheduledCellIndex)
      const planMonthLabel = await planMonthButton.getAttribute('aria-label')
      const planMonthMatch = planMonthLabel?.match(/^(.+) (\d+) 月：/)
      if (!planMonthMatch) throw new Error('無法解析年度計畫月格的程序與月份')
      await planMonthButton.click()
      const monthMenu = page.getByRole('menu', { name: `${planMonthMatch[1]} ${planMonthMatch[2]} 月狀態` })
      await monthMenu.getByRole('menuitemradio', { name: '擬定', exact: true }).click()
      const changedPlanTitle = await planMonthButton.getAttribute('title')
      if (!changedPlanTitle?.startsWith('排程：擬定')) throw new Error('月格點擊後未寫入「擬定」排程')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('年度稽核計畫')
      const persistedPlanMonthButton = planGrid.locator(`button[aria-label^="${planMonthMatch[1]} ${planMonthMatch[2]} 月："]`)
      if (await persistedPlanMonthButton.count() !== 1) throw new Error('重載後無法唯一定位已排程月格')
      const persistedPlanTitle = await persistedPlanMonthButton.getAttribute('title')
      if (!persistedPlanTitle?.startsWith('排程：擬定')) throw new Error('年度計畫排程未在重載後保存')
      planScheduleVerified = true

      workflowStage = '人員新增與儲存'
      await navigateTab('人員合格名單')
      const personName = `Smoke驗收${Date.now()}`
      if (await page.getByRole('button', { name: '新增稽核員', exact: true }).count()) throw new Error('人員頁仍有舊的「新增稽核員」入口')
      await page.getByRole('button', { name: '新增人員', exact: true }).click()
      await page.getByLabel('姓名 *', { exact: true }).fill(personName)
      await page.getByRole('checkbox', { name: '內部稽核員', exact: true }).check()
      const departmentSelect = page.getByLabel('所屬單位 *', { exact: true })
      const departmentValue = await departmentSelect.locator('option').nth(1).getAttribute('value')
      if (!departmentValue) throw new Error('人員表單缺少可選部門')
      await departmentSelect.selectOption(departmentValue)
      await page.getByRole('button', { name: '儲存', exact: true }).click()
      await page.getByText('已儲存', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
      await page.waitForFunction(
        (name) => Object.keys(localStorage).some((key) => key.startsWith('qms-annual-internal-audit') && localStorage.getItem(key)?.includes(name)),
        personName,
        { timeout: 5000 },
      )

      async function findPersonRow() {
        const row = page.getByRole('row').filter({ hasText: personName })
        const next = page.getByRole('button', { name: '人員合格名單下一頁', exact: true })
        for (let pageIndex = 0; pageIndex < 30; pageIndex += 1) {
          if (await row.count()) {
            await row.first().waitFor({ state: 'visible', timeout: 5000 })
            return row.first()
          }
          if (!(await next.count()) || await next.isDisabled()) break
          await next.click()
        }
        throw new Error('人員名單找不到剛新增的人員')
      }

      workflowStage = '人員重載讀回'
      let personRow = await findPersonRow()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('人員合格名單')
      personRow = await findPersonRow()
      workflowStage = '人員回收與還原'
      await personRow.getByRole('button', { name: '移至回收區', exact: false }).click()
      await page.getByRole('button', { name: '移入回收區', exact: true }).click()
      await personRow.waitFor({ state: 'detached', timeout: 5000 })

      await navigateTab('系統設定')
      const trashSection = page.getByRole('radiogroup', { name: '系統設定區塊' }).getByRole('radio', { name: /回收區/ })
      await trashSection.locator('xpath=..').click()
      const trashedRow = page.getByRole('row').filter({ hasText: personName })
      await trashedRow.waitFor({ state: 'visible', timeout: 5000 })
      await trashedRow.getByRole('button', { name: /^還原/ }).click()
      await page.getByText('已還原至原年度與清單位置。', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })

      await navigateTab('人員合格名單')
      personRow = await findPersonRow()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('人員合格名單')
      personRow = await findPersonRow()

      workflowStage = '人員永久清除二次確認'
      await personRow.getByRole('button', { name: `移至回收區：${personName}`, exact: true }).click()
      await page.getByRole('button', { name: '移入回收區', exact: true }).click()
      await personRow.waitFor({ state: 'detached', timeout: 5000 })
      await navigateTab('系統設定')
      const permanentTrashSection = page.getByRole('radiogroup', { name: '系統設定區塊' }).getByRole('radio', { name: /回收區/ })
      await permanentTrashSection.locator('xpath=..').click()
      const permanentTrashRow = page.getByRole('row').filter({ hasText: personName })
      await permanentTrashRow.waitFor({ state: 'visible', timeout: 5000 })
      const permanentDeleteButton = permanentTrashRow.getByRole('button', { name: '永久清除', exact: false })
      await permanentDeleteButton.click()
      const firstPermanentDialog = page.getByRole('alertdialog')
      const permanentWarning = await firstPermanentDialog.innerText()
      if (!permanentWarning.includes(personName) || !permanentWarning.includes('永久清除後無法還原')) {
        throw new Error('永久清除確認未說明目標資料與不可還原結果')
      }
      await firstPermanentDialog.getByRole('button', { name: '取消', exact: true }).click()
      await firstPermanentDialog.waitFor({ state: 'detached', timeout: 5000 })
      await permanentTrashRow.waitFor({ state: 'visible', timeout: 5000 })
      await permanentDeleteButton.click()
      const confirmPermanentDialog = page.getByRole('alertdialog', { name: '永久清除這筆資料？' })
      await confirmPermanentDialog.getByRole('button', { name: '永久清除', exact: true }).click()
      await permanentTrashRow.waitFor({ state: 'detached', timeout: 5000 })
      await page.getByRole('status').filter({ hasText: '已永久清除。' }).waitFor({ state: 'visible', timeout: 5000 })
      await navigateTab('人員合格名單')
      if (await page.locator('#personnel-form tr').filter({ hasText: personName }).count() !== 0) {
        throw new Error('永久清除後人員仍出現在人員名單')
      }
      personnelPermanentDeleteVerified = true

      workflowStage = '人員 Excel 匯出'
      const downloadEvent = page.waitForEvent('download', { timeout: 10000 })
      await page.getByRole('button', { name: '匯出名單', exact: true }).click()
      const download = await downloadEvent
      const downloadFailure = await download.failure()
      if (downloadFailure) throw new Error(`人員名單匯出失敗：${downloadFailure}`)
      if (!download.suggestedFilename().endsWith('.xlsx')) throw new Error(`人員名單匯出副檔名錯誤：${download.suggestedFilename()}`)

      workflowStage = '稽核年度讀取'
      const yearField = page.getByRole('spinbutton')
      if (await yearField.count() !== 1) throw new Error('預期頁首只有一個稽核年度欄位')
      const auditYear = await yearField.evaluate((element) => Number(element.value))
      if (!Number.isInteger(auditYear) || auditYear < 1) throw new Error('無法讀取目前稽核年度')
      const workflowChecks = ['年度計畫分頁', '人員新增與儲存', '重載讀回', '移至回收區', '還原', '重載讀回', 'Excel 匯出']
      if (planScheduleVerified) workflowChecks.push('年度計畫月格排程保存與重載讀回')
      if (personnelPermanentDeleteVerified) workflowChecks.push('回收區永久清除取消保留與確認清除')

      workflowStage = '利害關係人標籤保存'
      await navigateTab('利害關係人')
      const stakeholderRows = page.locator('[data-stakeholder-dept]')
      if (await stakeholderRows.count() === 0) throw new Error('利害關係人頁沒有可編輯的部門資料列')
      const stakeholderRow = stakeholderRows.first()
      const stakeholderDepartmentId = await stakeholderRow.getAttribute('data-stakeholder-dept')
      if (!stakeholderDepartmentId) throw new Error('利害關係人資料列缺少部門識別')
      const stakeholderEditButton = stakeholderRow.getByRole('button', { name: /編輯 .+ 利害關係人與風險/ })
      if (await stakeholderEditButton.count() !== 1) throw new Error('第一筆利害關係人資料列沒有編輯按鈕')
      await stakeholderEditButton.click()
      const stakeholderDialog = page.getByRole('dialog')
      await stakeholderDialog.waitFor({ state: 'visible', timeout: 5000 })
      const unselectedTags = stakeholderDialog.locator('button[aria-pressed="false"]')
      if (await unselectedTags.count() === 0) throw new Error('第一筆利害關係人資料列沒有可編輯標籤')
      const stakeholderTag = unselectedTags.first()
      const stakeholderTagLabel = (await stakeholderTag.innerText()).trim()
      const stakeholderTagValue = stakeholderTagLabel.replace(/\s+·\s+\d+$/, '')
      await stakeholderTag.click()
      await page.waitForFunction(({ tag }) => {
        const dialog = document.querySelector('[role="dialog"]')
        const button = [...(dialog?.querySelectorAll('button') ?? [])]
          .find((item) => item.textContent?.trim() === tag)
        return button?.getAttribute('aria-pressed') === 'true'
      }, { tag: stakeholderTagLabel }, { timeout: 5000 })
      await stakeholderDialog.getByRole('button', { name: '關閉', exact: true }).click()
      await stakeholderDialog.waitFor({ state: 'hidden', timeout: 5000 })
      await page.waitForFunction(({ departmentId, tag }) => {
        const containsSelection = (value) => {
          if (Array.isArray(value)) return value.some(containsSelection)
          if (!value || typeof value !== 'object') return false
          if (value.id === departmentId && Array.isArray(value.stakeholders)) {
            return value.stakeholders.includes(tag)
          }
          return Object.values(value).some(containsSelection)
        }
        return Object.keys(localStorage)
          .filter((key) => key.startsWith('qms-annual-internal-audit'))
          .some((key) => {
            try {
              return containsSelection(JSON.parse(localStorage.getItem(key) ?? 'null'))
            } catch {
              return false
            }
          })
      }, { departmentId: stakeholderDepartmentId, tag: stakeholderTagValue }, { timeout: 5000 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('利害關係人')
      const persistedStakeholderRow = page.locator(`[data-stakeholder-dept="${stakeholderDepartmentId}"]`)
      if (!await persistedStakeholderRow.getByText(stakeholderTagValue, { exact: true }).count()) {
        throw new Error('重載後表格未顯示已儲存利害關係人標籤')
      }
      workflowChecks.push('利害關係人標籤編輯與重載讀回')

      workflowStage = '方案風險證據引用保存'
      await navigateTab('方案風險')
      const riskRegion = page.getByRole('region', { name: '程序風險評估一覽' })
      const riskRow = riskRegion.getByRole('row').nth(1)
      const riskCells = riskRow.getByRole('cell')
      const riskQpCode = (await riskCells.nth(0).innerText()).trim()
      const riskDepartment = (await riskCells.nth(1).innerText()).trim()
      if (!riskQpCode || !riskDepartment) throw new Error('方案風險第一筆資料缺少程序或部門識別')
      const riskEvidenceInput = riskRow.locator('input[aria-label$="證據引用"]')
      if (await riskEvidenceInput.count() !== 1) throw new Error('方案風險第一筆資料沒有唯一證據引用欄位')
      const riskEvidenceReference = `Smoke風險依據${Date.now()}`
      await riskEvidenceInput.fill(riskEvidenceReference)
      const saveRiskButton = riskRow.getByRole('button', { name: '存檔', exact: true })
      if (!await saveRiskButton.isEnabled()) throw new Error('修改風險依據後存檔按鈕仍停用')
      await saveRiskButton.click()
      await riskRow.getByRole('button', { name: '已存檔', exact: true }).waitFor({ state: 'visible', timeout: 5000 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('方案風險')
      const persistedRiskRow = riskRegion.getByRole('row').filter({ hasText: riskQpCode }).filter({ hasText: riskDepartment })
      if (await persistedRiskRow.count() !== 1) throw new Error('重載後無法唯一定位已儲存方案風險資料列')
      const persistedRiskEvidence = persistedRiskRow.locator('input[aria-label$="證據引用"]')
      if (await persistedRiskEvidence.count() !== 1) throw new Error('重載後方案風險證據引用欄位不唯一')
      if (await persistedRiskEvidence.inputValue() !== riskEvidenceReference) {
        throw new Error('方案風險證據引用未在重載後保存')
      }
      workflowChecks.push('方案風險證據引用存檔與重載讀回')

      workflowStage = 'NCR 新增與讀回'
      await navigateTab('不符合')
      await page.getByRole('button', { name: '手動新增 NCR', exact: true }).click()
      const ncrDescription = `Smoke不符合${Date.now()}`
      await page.getByLabel('描述', { exact: true }).fill(ncrDescription)
      const addNcr = page.getByRole('button', { name: '新增 NCR', exact: true })
      if (!await addNcr.isEnabled()) throw new Error('填寫 NCR 描述後新增按鈕仍停用')
      await addNcr.click()
      const ncrRow = page.getByRole('row').filter({ hasText: ncrDescription })
      await ncrRow.waitFor({ state: 'visible', timeout: 5000 })
      workflowChecks.push('NCR 新增與讀回')

      workflowStage = '待改善追蹤 NCR 深連結'
      const ncrRecordId = await ncrRow.getAttribute('data-ncr-id')
      if (!ncrRecordId) throw new Error('新增 NCR 缺少穩定紀錄 ID')
      const ncrFollowupLabel = (await ncrRow.locator('td').first().innerText()).trim() || ncrRecordId
      await navigateTab('待改善追蹤')
      const followupNcrLink = page.getByRole('button', { name: ncrFollowupLabel, exact: true })
      if (await followupNcrLink.count() !== 1) throw new Error('待改善追蹤無法唯一定位新增 NCR')
      await followupNcrLink.click()
      await page.waitForFunction((expectedId) => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        return params.get('tab') === 'ncr' && params.get('record') === expectedId
      }, ncrRecordId, { timeout: 5000 })
      const ncrReport = page.locator('.qr-ncr-report')
      await ncrReport.getByLabel(`${ncrFollowupLabel} 原因分析`, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
      workflowChecks.push('待改善追蹤 NCR 深連結定位與展開')

      const ncrStatus = ncrReport.getByLabel('狀態', { exact: true })
      if (await ncrStatus.count() !== 1) throw new Error('新增 NCR 未呈現唯一狀態欄位')
      await ncrStatus.selectOption('結案')
      await ncrReport.getByRole('button', { name: '存檔', exact: true }).click()
      const ncrCloseError = ncrReport.getByRole('alert')
      await ncrCloseError.waitFor({ state: 'visible', timeout: 5000 })
      const closeMessage = await ncrCloseError.innerText()
      for (const requiredField of ['矯正措施引用', '效果確認引用', '確認人', '確認日']) {
        if (!closeMessage.includes(requiredField)) throw new Error(`NCR 結案錯誤訊息未指出「${requiredField}」`)
      }
      const persistedNcrStatus = await page.evaluate((id) => {
        const stored = JSON.parse(localStorage.getItem('qms-annual-internal-audit-v15'))
        return stored.workspace.ncrs.find((record) => record.id === id)?.status
      }, ncrRecordId)
      if (persistedNcrStatus !== '開立') {
        throw new Error('NCR 必要結案欄位未完成時仍被標記為結案')
      }
      workflowChecks.push('NCR 結案必填防呆')
      const leaveDialogPromise = page.waitForEvent('dialog')
      const leaveAttempt = page.getByRole('button', { name: '觀察事項', exact: true }).click()
      const leaveDialog = await leaveDialogPromise
      if (!leaveDialog.message().includes('未存檔')) throw new Error('NCR 未存檔離開缺少確認訊息')
      await leaveDialog.dismiss()
      await leaveAttempt
      await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).get('tab') === 'ncr')
      workflowChecks.push('NCR 未存檔防護取消離開')
      page.once('dialog', (dialog) => dialog.accept())
      await ncrReport.getByRole('button', { name: '收合', exact: true }).click()


      workflowStage = '觀察事項新增與讀回'
      await navigateTab('觀察事項')
      await page.getByRole('button', { name: '登錄觀察事項', exact: true }).click()
      const observationText = `Smoke觀察${Date.now()}`
      await page.getByLabel('來源活動', { exact: true }).selectOption('third_party_audit')
      await page.getByLabel('來源事件／報告編號', { exact: true }).fill(`SMOKE-OBS-${Date.now()}`)
      await page.getByLabel('發生日', { exact: true }).fill(`${auditYear}-12-31`)
      await page.getByLabel('觀察事項', { exact: true }).fill(observationText)
      const saveObservation = page.getByRole('button', { name: '儲存紀錄', exact: true })
      if (!await saveObservation.isEnabled()) throw new Error('必填觀察資料完成後儲存按鈕仍停用')
      await saveObservation.click()
      await page.getByRole('status').filter({ hasText: '已儲存' }).waitFor({ state: 'visible', timeout: 5000 })
      await page.getByRole('button').filter({ hasText: observationText }).waitFor({ state: 'visible', timeout: 5000 })
      workflowChecks.push('觀察新增與讀回')

      const observationCard = page.locator('[id^="observation-"]').filter({ hasText: observationText })
      if (await observationCard.count() !== 1) throw new Error('新增觀察事項未呈現唯一紀錄卡片')
      const observationRecordId = (await observationCard.getAttribute('id'))?.replace('observation-', '')
      if (!observationRecordId) throw new Error('新增觀察事項缺少穩定紀錄 ID')
      workflowStage = '待改善追蹤觀察深連結'
      await navigateTab('待改善追蹤')
      await page.getByRole('button', { name: '觀察', exact: true }).click()
      const observationFollowupLink = page.getByRole('button', { name: observationText, exact: true })
      if (await observationFollowupLink.count() !== 1) throw new Error('待改善追蹤無法唯一定位新增觀察事項')
      await observationFollowupLink.click()
      await page.waitForFunction((expectedId) => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        return params.get('tab') === 'observations'
          && params.get('section') === 'current'
          && params.get('record') === expectedId
      }, observationRecordId, { timeout: 5000 })
      await page.waitForFunction((expectedId) => {
        const row = document.querySelector(`#observation-${expectedId}`)
        const toggle = row?.querySelector('button[aria-expanded]')
        const detail = document.getElementById(`observation-detail-${expectedId}`)
        return toggle?.getAttribute('aria-expanded') === 'true' && detail != null
      }, observationRecordId, { timeout: 5000 })
      workflowChecks.push('待改善追蹤觀察深連結定位與展開')
      const observationDetail = page.locator(`#observation-detail-${observationRecordId}`)
      await observationCard.getByRole('button', { name: '編輯／結案', exact: true }).click()
      const saveAndCloseObservation = observationDetail.getByRole('button', { name: '儲存並結案', exact: true })
      if (await saveAndCloseObservation.isEnabled()) throw new Error('缺少結案證據時觀察事項仍可結案')
      await observationDetail.getByLabel('結案證據／紀錄', { exact: true }).fill('Smoke隔離驗收結案證據')
      if (!await saveAndCloseObservation.isEnabled()) throw new Error('填入結案證據後仍無法結案觀察事項')
      await saveAndCloseObservation.click()
      await page.getByRole('button', { name: '已結案', exact: true }).click()
      await observationCard.getByText('已結案', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
      workflowChecks.push('觀察結案必填防呆與結案')

      workflowStage = '第三方建議新增與讀回'
      await navigateTab('第三方建議')
      await page.getByRole('button', { name: '登錄建議', exact: true }).click()
      const suggestionIssue = `Smoke建議${Date.now()}`
      await page.getByLabel('問題描述', { exact: true }).fill(suggestionIssue)
      const saveSuggestion = page.getByRole('button', { name: '儲存', exact: true })
      if (await saveSuggestion.count() !== 1 || !await saveSuggestion.isEnabled()) {
        throw new Error('填寫建議描述後儲存按鈕不可用或名稱不唯一')
      }
      await saveSuggestion.click()
      await page.getByRole('status').filter({ hasText: '已儲存' }).waitFor({ state: 'visible', timeout: 5000 })
      const suggestionRow = page.getByRole('row').filter({ hasText: suggestionIssue })
      await suggestionRow.waitFor({ state: 'visible', timeout: 5000 })
      const suggestionRecordId = await suggestionRow.getAttribute('data-suggestion-id')
      if (!suggestionRecordId) throw new Error('新增第三方建議缺少穩定紀錄 ID')
      workflowChecks.push('第三方建議新增與讀回')

      workflowStage = '待改善追蹤建議深連結'
      await navigateTab('待改善追蹤')
      await page.getByRole('button', { name: '建議', exact: true }).click()
      const suggestionFollowupLink = page.getByRole('button', { name: suggestionIssue, exact: true })
      if (await suggestionFollowupLink.count() !== 1) throw new Error('待改善追蹤無法唯一定位新增第三方建議')
      await suggestionFollowupLink.click()
      await page.waitForFunction((expectedId) => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        return params.get('tab') === 'suggestions' && params.get('record') === expectedId
      }, suggestionRecordId, { timeout: 5000 })
      const focusedSuggestion = page.locator(`[data-suggestion-id="${suggestionRecordId}"]`)
      await focusedSuggestion.waitFor({ state: 'visible', timeout: 5000 })
      const focusedSuggestionClass = await focusedSuggestion.getAttribute('class')
      if (!focusedSuggestionClass?.includes('ring-2')) throw new Error('第三方建議深連結未標示目標紀錄')
      workflowChecks.push('待改善追蹤建議深連結定位與標示')

      workflowStage = '三台帳本機保存'
      await page.waitForFunction(
        (recordNames) => Object.keys(localStorage)
          .filter((key) => key.startsWith('qms-annual-internal-audit'))
          .some((key) => recordNames.every((name) => localStorage.getItem(key)?.includes(name))),
        [ncrDescription, observationText, suggestionIssue],
        { timeout: 5000 },
      )
      workflowStage = '三台帳重載讀回'
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('不符合')
      await page.getByRole('row').filter({ hasText: ncrDescription }).waitFor({ state: 'visible', timeout: 5000 })
      await navigateTab('觀察事項')
      await page.getByRole('button').filter({ hasText: observationText }).waitFor({ state: 'visible', timeout: 5000 })
      await navigateTab('第三方建議')
      await page.getByRole('row').filter({ hasText: suggestionIssue }).waitFor({ state: 'visible', timeout: 5000 })
      workflowChecks.push('NCR／觀察／建議重載讀回')

      workflowStage = '外稽準備完成項保存'
      await openPrepView()
      const prepCheckboxes = page.locator('input[type="checkbox"][aria-label^="第 "]')
      if (await prepCheckboxes.count() === 0) throw new Error('外稽準備清單沒有可操作的完成項')
      const prepCheckbox = prepCheckboxes.first()
      const prepCheckboxLabel = await prepCheckbox.getAttribute('aria-label')
      if (!prepCheckboxLabel) throw new Error('外稽準備完成項沒有可存取名稱')
      const wasPrepCompleted = await prepCheckbox.evaluate((element) => element.checked)
      await prepCheckbox.setChecked(!wasPrepCompleted)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await openPrepView()
      const prepCheckboxAfterReload = page.getByLabel(prepCheckboxLabel, { exact: true })
      if (await prepCheckboxAfterReload.count() !== 1) throw new Error('重載後無法唯一找到外稽準備完成項')
      if (await prepCheckboxAfterReload.evaluate((element) => element.checked) !== !wasPrepCompleted) {
        throw new Error('外稽準備完成狀態未在重載後保存')
      }
      workflowChecks.push('外稽準備完成狀態保存與重載讀回')

      workflowStage = '系統設定 JSON 備份下載'
      await navigateTab('系統設定')
      if (await page.getByRole('heading', { name: '管理系統認證證書', exact: true }).count() !== 0
        || await page.getByRole('heading', { name: '稽核基本資料', exact: true }).count() !== 0
        || await page.getByLabel('證書編號／引用', { exact: true }).count() !== 0
        || await page.getByLabel('證書範圍', { exact: true }).count() !== 0) {
        throw new Error('設定頁仍顯示已移除的證書或稽核基本資料')
      }
      if (await page.getByRole('button', { name: /指定保存位置|變更保存位置/ }).count() !== 1) {
        throw new Error('程序與紀錄未保留正式紀錄保存位置指定功能')
      }
      if (await page.getByRole('radio', { name: '系統流程', exact: true }).count() !== 1) {
        throw new Error('系統設定沒有系統流程')
      }
      workflowChecks.push('設定頁只保留正式紀錄保存位置指定，不顯示已移除的證書表單')
      await page.getByRole('radio', { name: '備份與匯出', exact: true }).locator('xpath=..').click()
      const backupDownloadEvent = page.waitForEvent('download', { timeout: 10000 })
      await page.getByRole('button', { name: '下載完整備份', exact: true }).click()
      const backupDownload = await backupDownloadEvent
      const backupDownloadFailure = await backupDownload.failure()
      if (backupDownloadFailure) throw new Error(`完整 JSON 備份下載失敗：${backupDownloadFailure}`)
      if (!backupDownload.suggestedFilename().endsWith('.json')) {
        throw new Error(`完整備份副檔名錯誤：${backupDownload.suggestedFilename()}`)
      }
      workflowChecks.push('系統設定 JSON 備份下載')

      workflowStage = '系統設定備份還原防呆'
      const backupPath = await backupDownload.path()
      if (!backupPath) throw new Error('無法取得隔離瀏覽器備份檔以驗證還原流程')
      const restoreButton = page.getByRole('button', { name: '選擇備份檔還原', exact: true })
      if (!await restoreButton.isEnabled()) throw new Error('完成備份下載後還原按鈕仍停用')
      const restoreInput = page.locator('input[type="file"][accept=".json,application/json"]')
      if (await restoreInput.count() !== 1) throw new Error('系統設定備份還原檔案選擇器不唯一')
      const storageBeforeCancel = await page.evaluate(() => Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]))
      await restoreInput.setInputFiles(backupPath)
      const cancelRestoreDialog = page.getByRole('alertdialog', { name: '確定還原備份？' })
      await cancelRestoreDialog.waitFor({ state: 'visible', timeout: 5000 })
      if (!(await cancelRestoreDialog.innerText()).includes('目前工作區資料將被覆寫。')) {
        throw new Error('還原確認未說明目前工作區資料會被覆寫')
      }
      await cancelRestoreDialog.getByRole('button', { name: '取消', exact: true }).click()
      await cancelRestoreDialog.waitFor({ state: 'detached', timeout: 5000 })
      const storageAfterCancel = await page.evaluate(() => Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]))
      if (JSON.stringify(storageAfterCancel) !== JSON.stringify(storageBeforeCancel)) {
        throw new Error('取消還原後本機資料發生變更')
      }

      if (!await restoreButton.isEnabled()) throw new Error('取消還原後有效備份仍不可再次選取')
      await restoreInput.setInputFiles(backupPath)
      const confirmRestoreDialog = page.getByRole('alertdialog', { name: '確定還原備份？' })
      await confirmRestoreDialog.waitFor({ state: 'visible', timeout: 5000 })
      await confirmRestoreDialog.getByRole('button', { name: '確認還原', exact: true }).click()
      await page.getByRole('status').filter({ hasText: '還原成功' }).waitFor({ state: 'visible', timeout: 5000 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('不符合')
      await page.getByRole('row').filter({ hasText: ncrDescription }).waitFor({ state: 'visible', timeout: 5000 })
      await navigateTab('觀察事項')
      await page.getByRole('button').filter({ hasText: observationText }).waitFor({ state: 'visible', timeout: 5000 })
      await navigateTab('第三方建議')
      await page.getByRole('row').filter({ hasText: suggestionIssue }).waitFor({ state: 'visible', timeout: 5000 })
      workflowChecks.push('系統設定 JSON 還原確認、取消保留與重載讀回')

      workflowStage = '查檢開始、判定與完成回報鎖定'
      await page.evaluate(() => {
        const storageKey = 'qms-annual-internal-audit-v15'
        const raw = localStorage.getItem(storageKey)
        if (!raw) throw new Error('隔離測試資料不存在')
        const state = JSON.parse(raw)
        const profile = state.auditProfile
        const workspace = state.workspace
        const audit = workspace?.audits?.find((item) => item.qpCode === 'QP-28' && item.departmentId === 'dept-qa')
        if (!profile || !audit || !audit.items?.length) throw new Error('隔離測試查檢資料不完整')
        const workspaceCompanyId = state.people?.find((person) => person.affiliations?.length)?.affiliations?.[0]?.companyId ?? 'jiurun'

        profile.applicableStandards = [{
          name: 'ISO 9001',
          version: '2015',
          confirmationStatus: 'confirmed',
          evidenceReference: 'SMOKE-ONLY',
        }]
        profile.auditProcedureCode = 'QP-28'
        profile.auditProcedureVersion = 'SMOKE-ONLY'
        profile.formalRecordLocation = '隔離測試資料'

        const leadId = 'smoke-qualified-lead'
        state.people = state.people.filter((person) => person.id !== leadId)
        state.people.push({
          id: leadId,
          name: '隔離測試主任稽核員',
          employeeNumber: 'SMOKE-001',
          type: 'internal',
          affiliations: [{ id: 'smoke-affiliation', companyId: workspaceCompanyId, departmentId: 'dept-admin' }],
          qualifications: [{
            id: 'smoke-qualification',
            role: 'internal_lead_auditor',
            companyIds: [workspaceCompanyId],
            standardVersions: ['ISO 9001:2015'],
            procedureScopes: ['QP-28'],
            departmentScopes: ['dept-qa'],
            documentTitle: '隔離驗收資格',
            documentNumber: 'SMOKE-Q-001',
            documentLocation: '隔離測試資料',
            assessedBy: '隔離驗收',
            assessmentDate: '2026-09-24',
            effectiveFrom: '2026-01-01',
            validityMode: 'fixed',
            effectiveTo: '2026-12-31',
          }],
          appointments: [],
          active: true,
          notes: '僅供隔離瀏覽器流程驗收',
        })

        audit.status = '規劃中'
        audit.auditDate = '2026-09-24'
        audit.reportReference = ''
        audit.team = {
          leadAuditorPersonId: leadId,
          auditorPersonIds: [],
          escortPersonIds: [],
          impartialityConfirmed: true,
          impartialityNote: '隔離測試客觀性依據',
        }
        audit.items = audit.items.slice(0, 1).map((item) => ({
          ...item,
          judgment: null,
          description: '',
          objectiveEvidence: '',
          notApplicableReason: '',
        }))
        localStorage.setItem(storageKey, JSON.stringify(state))
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('查檢表')
      const auditSelector = page.getByLabel('查檢表', { exact: true })
      if (await auditSelector.count() !== 1) throw new Error('查檢表選擇器不唯一')
      await auditSelector.selectOption('QP-28|dept-qa')
      await page.getByRole('button', { name: '開始稽核', exact: true }).click()
      await page.getByRole('button', { name: '完成回報', exact: true }).waitFor({ state: 'visible', timeout: 5000 })

      const reportReference = page.getByLabel('正式紀錄編號', { exact: true })
      await page.getByRole('button', { name: '完成回報', exact: true }).click()
      await page.getByRole('alert').filter({ hasText: '須填寫正式紀錄編號' }).waitFor({ state: 'visible', timeout: 5000 })
      await reportReference.fill('SMOKE-QR-28-20260924')
      await page.getByRole('button', { name: '完成回報', exact: true }).click()
      await page.getByRole('alert').filter({ hasText: '尚有 1 項待判定' }).waitFor({ state: 'visible', timeout: 5000 })

      const judgment = page.getByLabel('判定', { exact: true })
      if (await judgment.count() !== 1) throw new Error('隔離查檢未呈現唯一判定欄位')
      await judgment.selectOption('符合')
      await page.getByLabel('客觀證據', { exact: true }).fill('隔離測試證據')
      await page.getByRole('button', { name: '完成回報', exact: true }).click()
      await page.getByText('已回報', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await navigateTab('查檢表')
      await page.getByLabel('查檢表', { exact: true }).selectOption('QP-28|dept-qa')
      await page.getByText('已回報', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
      if (await page.getByRole('button', { name: '完成回報', exact: true }).count() !== 0) {
        throw new Error('重載後已回報查檢仍可編輯或再次回報')
      }
      const lockedJudgment = page.getByLabel('判定', { exact: true })
      if (await lockedJudgment.count() !== 1 || !await lockedJudgment.isDisabled()) {
        throw new Error('重載後已回報查檢判定欄位未鎖定')
      }
      workflowChecks.push('查檢合格資格開始、正式編號與未判定防呆、完成回報鎖定及重載讀回')

      widthResult.workflow = { passed: true, checks: workflowChecks }
    } catch (e) {
      widthResult.workflow = { stage: workflowStage, error: String(e).split('\n').slice(0, 4).join(' ') }
    }
  }
  results.push(widthResult)
  await context.close()
}

const summary = results.map(({ width, title, tabs, print, workflow }) => ({
  width,
  title,
  pagesPassed: tabs.filter((tab) =>
    !tab.errBox && !tab.error && !tab.rootEmpty && !tab.stale?.length && !tab.horizontalOverflow,
  ).length,
  failures: tabs.filter((tab) =>
    tab.errBox > 0 || tab.error || tab.rootEmpty || tab.stale?.length || tab.horizontalOverflow,
  ).map(({ label, error, errBox, rootEmpty, horizontalOverflow, stale }) => ({
    label,
    error,
    errBox,
    rootEmpty,
    horizontalOverflow,
    stale,
  })),
  printFailures: print?.filter((page) => page.missing.length) ?? [],
  workflow,
}))
console.log(JSON.stringify({ widths, errors, summary }, null, 2))

await browser.close()
const failed = results.some(({ tabs }) => tabs.some((tab) =>
  tab.errBox > 0 || tab.error || tab.rootEmpty || tab.stale?.length || tab.horizontalOverflow,
)) || results.some(({ print }) => print?.some((page) => page.missing.length))
  || results.some(({ workflow }) => Boolean(workflow?.error))
if (failed || errors.some((e) => /Unhandled|Cannot read|Audit entry/.test(e))) {
  process.exit(2)
}
