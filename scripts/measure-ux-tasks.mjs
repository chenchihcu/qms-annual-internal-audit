// UX interaction metrics for the representative tasks T1–T6 (UI/UX plan §8).
// Each task runs in a fresh, isolated browser context on 127.0.0.1:43124 (demo data).
// Setup (seeding localStorage, opening the start page) is not counted.
//
// Counting convention (mouse user, shortest scripted path):
//   clicks          button/link/checkbox press; native <select> = 2 (open + choose);
//                   focusing a text field = 1 unless it is already focused
//   textEntries     each field typed into
//   duplicateText   same text typed into more than one field
//   transitions     changes of the `tab` value in location.hash
// Usage: node scripts/measure-ux-tasks.mjs [--label baseline] [--out path.json]
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:43124/'
const STORAGE_KEY = 'qms-annual-internal-audit-v15'
const NAV_NAME = '依稽核流程的表單導覽'

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const label = argValue('--label') ?? 'run'
const outPath = argValue('--out')
let commit = 'unknown'
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {
  // Metrics stay usable outside a Git checkout.
}

function createMeter(page) {
  const metrics = { clicks: 0, textEntries: 0, duplicateText: 0, transitions: 0 }
  const typed = new Map()
  const currentTab = () => page.evaluate(() => (
    new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tab') ?? 'dashboard'
  ))
  async function track(action) {
    const before = await currentTab()
    await action()
    await page.waitForTimeout(120)
    if (await currentTab() !== before) metrics.transitions += 1
  }
  return {
    metrics,
    click: (locator) => track(async () => {
      metrics.clicks += 1
      await locator.click()
    }),
    select: (locator, value) => track(async () => {
      metrics.clicks += 2
      await locator.selectOption(value)
    }),
    fill: (locator, text) => track(async () => {
      const focused = await locator.evaluate((element) => element === document.activeElement)
      if (!focused) metrics.clicks += 1
      metrics.textEntries += 1
      const seen = (typed.get(text) ?? 0) + 1
      typed.set(text, seen)
      if (seen > 1) metrics.duplicateText += 1
      await locator.fill(text)
    }),
  }
}

async function openPage(browser, hash, mutate) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(4000)
  await page.goto(`${BASE}#tab=dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), STORAGE_KEY)
  if (mutate) {
    await page.evaluate(({ key, source }) => {
      const state = JSON.parse(localStorage.getItem(key))
      new Function('state', source)(state)
      localStorage.setItem(key, JSON.stringify(state))
    }, { key: STORAGE_KEY, source: `(${mutate.toString()})(state)` })
  }
  await page.goto(`${BASE}${hash}`, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  return { context, page }
}

const readState = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)
const nav = (page, name) => page.getByRole('navigation', { name: NAV_NAME }).getByRole('button', { name, exact: true })
const alertTexts = async (page) => {
  const items = await page.getByRole('alert').locator('li').allTextContents()
  return items.length ? items : page.getByRole('alert').allTextContents()
}

async function confirmIfAsked(page, meter) {
  const dialog = page.getByRole('alertdialog')
  if (await dialog.count() === 0) return false
  // ConfirmDialog renders cancel first, an optional secondary action, then confirm last.
  await meter.click(dialog.getByRole('button').last())
  return true
}

const MEASURE_KEY = 'qms-measure-audit-key'

// Seeds the largest in-progress demo audit with `count` unjudged items (runs in the page).
function seedRunningAudit(count) {
  return new Function('state', `
    const audit = state.workspace.audits
      .filter((item) => item.status === '執行中')
      .sort((a, b) => b.items.length - a.items.length)[0]
    if (!audit) throw new Error('no running audit in demo data')
    const source = audit.items
    // Pad by cloning when the demo audit has fewer items; per-item UI behaviour is identical.
    audit.items = Array.from({ length: ${count} }, (_, index) => {
      const item = source[index % source.length]
      return {
        ...item,
        id: index < source.length ? item.id : item.id + '-measure-' + index,
        no: index + 1,
        judgment: null, description: '', objectiveEvidence: '', notApplicableReason: '',
      }
    })
    audit.reportReference = ''
    localStorage.setItem('${MEASURE_KEY}', audit.qpCode + '|' + audit.departmentId)
  `)
}

const seededAuditKey = (page) => page.evaluate((key) => localStorage.getItem(key), MEASURE_KEY)

async function runTask(name, browser, body) {
  const started = Date.now()
  try {
    const result = await body(browser)
    return { task: name, ...result, ms: Date.now() - started }
  } catch (error) {
    return { task: name, completed: false, error: String(error.message ?? error).split('\n')[0], ms: Date.now() - started }
  }
}

const tasks = {}
const browser = await chromium.launch({ headless: true })

tasks.T1 = await runTask('從年度計畫開啟已排程 QP 並開始稽核', browser, async () => {
  const { context, page } = await openPage(browser, '#tab=dashboard')
  const meter = createMeter(page)
  let confirmOnStart = false
  try {
    await meter.click(nav(page, '年度稽核計畫'))
    await meter.click(page.getByRole('link', { name: 'QP-03 品保部 查檢表', exact: true }))
    await meter.fill(page.getByLabel('稽核日期', { exact: true }), '2026-02-15')
    const start = page.getByRole('button', { name: '開始稽核', exact: true })
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (await start.count() === 0) break
      await meter.click(start)
      const location = page.getByLabel('正式紀錄保存位置', { exact: true })
      if (await location.count() > 0 && await location.isVisible()) {
        await meter.fill(location, '品保部 QMS 檔案櫃')
        await meter.click(page.getByRole('button', { name: '確認儲存', exact: true }))
      }
      confirmOnStart = (await confirmIfAsked(page, meter)) || confirmOnStart
      await page.waitForTimeout(200)
    }
    const state = await readState(page)
    const audit = state.workspace.audits.find((item) => item.qpCode === 'QP-03' && item.departmentId === 'dept-qa')
    const completed = audit?.status === '執行中'
    return { completed, confirmOnStart, blockers: completed ? [] : (await alertTexts(page)).flatMap((text) => text.split('\n')), ...meter.metrics }
  } finally {
    await context.close()
  }
})

tasks.T2 = await runTask('10 項全符合＋客觀證據＋完成回報', browser, async () => {
  const { context, page } = await openPage(browser, '#tab=audit', seedRunningAudit(10))
  const meter = createMeter(page)
  try {
    const key = await seededAuditKey(page)
    await page.getByLabel('查檢表', { exact: true }).selectOption(key)
    await page.waitForTimeout(300)
    const judgments = page.getByLabel('判定', { exact: true })
    const items = await judgments.count()
    for (let index = 0; index < items; index += 1) {
      await meter.select(judgments.nth(index), '符合')
      await meter.fill(page.getByLabel('客觀證據', { exact: true }).nth(index), `T2 客觀證據 ${index + 1}`)
    }
    await meter.fill(page.getByLabel('正式紀錄編號', { exact: true }), 'QR-28-02-MEASURE')
    await meter.click(page.getByRole('button', { name: '完成回報', exact: true }))
    const confirmOnReport = await confirmIfAsked(page, meter)
    await page.waitForTimeout(200)
    const [qpCode, departmentId] = key.split('|')
    const audit = (await readState(page)).workspace.audits.find((item) => item.qpCode === qpCode && item.departmentId === departmentId)
    return { completed: audit?.status === '已回報', items, confirmOnReport, ...meter.metrics }
  } finally {
    await context.close()
  }
})

tasks.T3 = await runTask('查檢不符 → NCR 填到可結案', browser, async () => {
  const { context, page } = await openPage(browser, '#tab=audit', seedRunningAudit(1))
  const meter = createMeter(page)
  try {
    const key = await seededAuditKey(page)
    await page.getByLabel('查檢表', { exact: true }).selectOption(key)
    await page.waitForTimeout(300)
    const finding = 'T3 發現：抽查 3 份紀錄缺主管核准'
    await meter.select(page.getByLabel('判定', { exact: true }).first(), '不符')
    await meter.fill(page.getByLabel('客觀證據', { exact: true }).first(), 'T3 客觀證據：QR-09-01 三份')
    await meter.fill(page.getByLabel('發現說明', { exact: true }).first(), finding)
    const hint = page.getByRole('button', { name: /前往不符合/ })
    const ncrNumber = ((await hint.textContent()) ?? '').match(/NCR-\d{4}-\d{3}(?:（\d+）|\(\d+\))?/)?.[0]
    if (!ncrNumber) throw new Error('NCR hint not found')
    await meter.click(hint)
    const save = page.getByRole('button', { name: '存檔', exact: true })
    if (await save.count() === 0) {
      await meter.click(page.getByRole('button', { name: `${ncrNumber} QR-28-03 報告`, exact: true }))
    }
    const field = (suffix) => page.getByLabel(`${ncrNumber} ${suffix}`, { exact: true })
    await meter.fill(field('不符合事項'), finding)
    await meter.fill(field('原因分析'), 'T3 原因：核准流程未納入表單')
    await meter.fill(field('矯正措施'), 'T3 矯正：表單增加核准欄並教育訓練')
    await meter.fill(page.getByLabel('矯正措施引用', { exact: true }), 'QR-12-01-T3')
    await meter.fill(field('追蹤結果'), 'T3 追蹤：抽查 5 份皆有核准')
    await meter.fill(page.getByLabel('效果確認引用', { exact: true }), 'QR-12-02-T3')
    const verifier = page.getByLabel('效果確認人', { exact: true })
    const option = await verifier.evaluate((element) => [...element.options].find((item) => item.value && item.value !== '__custom__')?.value)
    if (option) {
      await meter.select(verifier, option)
    } else {
      // No qualified candidate in demo data: the only UI path is 其他（手填） + typing a name.
      await meter.select(verifier, '__custom__')
      await meter.fill(page.getByLabel('效果確認人', { exact: true }), '品保部經理')
    }
    await meter.fill(page.getByLabel('效果確認日', { exact: true }), '2026-03-20')
    await meter.select(page.getByLabel('狀態', { exact: true }), '結案')
    await meter.click(save)
    await page.waitForTimeout(200)
    const ncr = (await readState(page)).workspace.ncrs.find((item) => item.description === finding || item.findingSnapshot === finding || item.ncrNumber === ncrNumber.replace(/[（(].*$/, ''))
    return { completed: ncr?.status === '結案', ncrNumber, saveAlerts: await alertTexts(page), ...meter.metrics }
  } finally {
    await context.close()
  }
})

tasks.T4 = await runTask('待改善追蹤篩選後逐筆開啟 3 筆並返回', browser, async () => {
  const { context, page } = await openPage(browser, '#tab=followups')
  const meter = createMeter(page)
  try {
    const chipName = '建議'
    const chip = page.getByRole('button', { name: new RegExp(`^${chipName}`) })
    await meter.click(chip.first())
    const rows = page.getByRole('region', { name: '待改善追蹤一覽' }).locator('tbody tr')
    const total = await rows.count()
    const opened = Math.min(3, total)
    let filterKept = true
    for (let index = 0; index < opened; index += 1) {
      await meter.click(rows.nth(index).getByRole('button').first())
      await meter.click(nav(page, '待改善追蹤'))
      const pressed = await chip.first().getAttribute('aria-pressed')
      if (pressed !== 'true') {
        filterKept = false
        await meter.click(chip.first())
      }
    }
    await rows.first().getByRole('button').first().click()
    await page.waitForTimeout(150)
    await page.goBack().catch(() => {})
    await page.waitForTimeout(300)
    const backTab = await page.evaluate(() => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tab'))
    return { completed: opened > 0, opened, filterKept, browserBackReturns: backTab === 'followups', ...meter.metrics }
  } finally {
    await context.close()
  }
})

tasks.T5 = await runTask('方案風險存檔全部未存檔列', browser, async () => {
  const { context, page } = await openPage(browser, '#tab=risk')
  const meter = createMeter(page)
  try {
    let saved = 0
    const firstEnabledSave = async () => {
      for (const candidate of await page.getByRole('button', { name: '存檔', exact: true }).all()) {
        if (await candidate.isEnabled()) return candidate
      }
      return undefined
    }
    for (let pageGuard = 0; pageGuard < 20; pageGuard += 1) {
      for (let rowGuard = 0; rowGuard < 60; rowGuard += 1) {
        const candidate = await firstEnabledSave()
        if (!candidate) break
        await meter.click(candidate)
        saved += 1
      }
      const next = page.getByRole('button', { name: /下一頁$/ })
      if (await next.count() === 0 || !await next.first().isEnabled()) break
      await meter.click(next.first())
    }
    const unsavedBanner = await page.getByText(/尚有 \d+ 列方案風險未按/).count()
    return { completed: unsavedBanner === 0, savedRows: saved, ...meter.metrics }
  } finally {
    await context.close()
  }
})

tasks.T6 = {
  task: '不可逆動作需確認',
  confirmOnStart: tasks.T1.confirmOnStart ?? false,
  confirmOnReport: tasks.T2.confirmOnReport ?? false,
}

await browser.close()

const counted = ['T1', 'T2', 'T3', 'T4', 'T5'].map((key) => tasks[key])
const totals = counted.reduce((sum, item) => ({
  clicks: sum.clicks + (item.clicks ?? 0),
  textEntries: sum.textEntries + (item.textEntries ?? 0),
  transitions: sum.transitions + (item.transitions ?? 0),
  duplicateText: sum.duplicateText + (item.duplicateText ?? 0),
}), { clicks: 0, textEntries: 0, transitions: 0, duplicateText: 0 })
const report = {
  label,
  commit,
  measuredAt: new Date().toISOString(),
  convention: 'clicks incl. select=2 and unfocused-field focus; setup excluded',
  totals: { ...totals, interactions: totals.clicks + totals.textEntries },
  tasks,
}
const json = JSON.stringify(report, null, 2)
console.log(json)
if (outPath) writeFileSync(outPath, `${json}\n`, 'utf8')
