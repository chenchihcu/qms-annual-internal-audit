import { countPrepProgress, evaluatePrepSequence, formatPrepYearMismatch } from './externalAuditPrep'
import { buildCarryForwardSummary, countOpenFollowups } from './followupQueue'
import { resolveLeadAuditorPersonId } from './personnel'
import { scoreProcedureAudit } from './scoring'
import { isRiskConfirmedForYear } from './risk'
import { isCoverageCurrent } from './riskSources'
import { localIsoDate } from './localDate'
import type { AppState, CompanyData, CompanyId, ProcedureAudit, TabId } from '../types'
import { companySettingsFor, DEFAULT_SCORING_RULES, RISK_COVERAGE_KIND_LABELS, type RiskCoverageKind } from '../types'
import { WORKSPACE_COMPANY_ID } from './singleWorkspaceMigration'
import type { NavigateOptions } from './navigation'

export function isPlanRowScheduled(row: { months: Array<unknown> }): boolean {
  return row.months.some(Boolean)
}

export function isAuditScheduledInPlan(co: CompanyData, audit: ProcedureAudit): boolean {
  const row = co.planRows.find(
    (item) => item.qpCode === audit.qpCode && item.departmentId === audit.departmentId,
  )
  return row ? isPlanRowScheduled(row) : false
}

export type PdcaPhase = 'P' | 'D' | 'C' | 'A' | 'overview' | 'system'

export interface WorkflowGap {
  message: string
  tab?: TabId
  /** 深連結參數（例：年度計畫 `recordId` 開到指定計畫列並展開）。 */
  options?: NavigateOptions
}

export interface TabWorkflowStatus {
  tab: TabId
  pdcaPhase: PdcaPhase
  ready: boolean
  gaps: WorkflowGap[]
  /** Informational gaps that do not block "next" */
  advisories: WorkflowGap[]
}

export interface PdcaOverview {
  plan: { ready: boolean; gaps: WorkflowGap[] }
  do: { ready: boolean; gaps: WorkflowGap[] }
  check: { ready: boolean; gaps: WorkflowGap[] }
  act: { ready: boolean; gaps: WorkflowGap[] }
  annualCloseReady: boolean
  annualCloseGaps: WorkflowGap[]
}

function profileFor(state: AppState, _companyId: CompanyId) {
  return state.auditProfile
}

function companyFor(state: AppState, _companyId: CompanyId = WORKSPACE_COMPANY_ID) {
  return state.workspace
}

export function procedureSourceReady(state: AppState, companyId: CompanyId = WORKSPACE_COMPANY_ID): boolean {
  const profile = profileFor(state, companyId)
  return Boolean(profile.formalRecordLocation?.trim())
}

export function standardReady(_state?: AppState, _companyId?: CompanyId): boolean {
  return true
}

/**
 * 需標註的部門＝在年度計畫中有列的部門：標籤只在計畫列明細編輯，
 * 沒有計畫列的部門（例：匯入或遷移資料）不阻擋，以免形成無法完成的缺口。
 */
function departmentsNeedingTags(co: CompanyData) {
  const planned = new Set(co.planRows.map((row) => row.departmentId))
  return co.departments.filter((dept) => planned.has(dept.id))
}

export function stakeholdersReady(state: AppState, companyId: CompanyId = WORKSPACE_COMPANY_ID): boolean {
  const co = companyFor(state, companyId)
  if (co.departments.length === 0) return false
  return departmentsNeedingTags(co).every((dept) => dept.stakeholders.length >= 1)
}

/** 第一個未標註部門的第一筆計畫列；標籤在年度計畫明細列編輯。 */
export function untaggedDepartmentPlanLink(co: CompanyData): NavigateOptions | undefined {
  for (const dept of co.departments) {
    if (dept.stakeholders.length >= 1) continue
    const row = co.planRows.find((item) => item.departmentId === dept.id)
    if (row) return { recordId: row.id }
  }
  return undefined
}

function stakeholderTagGap(co: CompanyData): WorkflowGap | null {
  if (co.departments.length === 0) {
    return { message: '部門利害關係人已標註 0/0（於計畫列明細編輯）', tab: 'plan' }
  }
  const needed = departmentsNeedingTags(co)
  const total = needed.length
  const tagged = needed.filter((d) => d.stakeholders.length >= 1).length
  if (tagged === total) return null
  return {
    message: `部門利害關係人已標註 ${tagged}/${total}（於計畫列明細編輯）`,
    tab: 'plan',
    options: untaggedDepartmentPlanLink(co),
  }
}

function riskConfirmedRowCount(state: AppState, companyId: CompanyId): { confirmed: number; total: number } {
  const co = companyFor(state, companyId)
  const year = companySettingsFor(state, companyId).auditYear
  const confirmed = co.planRows.filter((row) => isRiskConfirmedForYear(
    co.procedureRisks?.find((r) => r.qpCode === row.qpCode && r.departmentId === row.departmentId),
    year,
  )).length
  return { confirmed, total: co.planRows.length }
}

/** 方案風險就緒：每一計畫列都有本年度已確認或已核准的評估（只存檔草稿不算）。 */
const COVERAGE_KINDS: RiskCoverageKind[] = ['customer_complaint', 'major_change', 'third_party_audit']

/** 風險來源登錄缺口：各類別「已全部登錄」須涵蓋到今天，且無待確認關聯。分頁狀態與 PDCA 總覽共用。 */
export function riskSourceGaps(co: CompanyData, today: string = localIsoDate()): string[] {
  const gaps: string[] = []
  const coverage = co.riskSourceCoverage ?? {}
  for (const kind of COVERAGE_KINDS) {
    const declared = coverage[kind]
    if (!declared) gaps.push(`${RISK_COVERAGE_KIND_LABELS[kind]}尚未勾選「已全部登錄」`)
    else if (!isCoverageCurrent(declared, today)) gaps.push(`${RISK_COVERAGE_KIND_LABELS[kind]}「已全部登錄」只到 ${declared.checkedThrough}，需更新`)
  }
  const pending = (co.riskSourceEvents ?? [])
    .filter((event) => !event.voidedAt)
    .reduce((sum, event) => sum + event.targets.filter((target) => target.linkStatus === 'pending').length, 0)
  if (pending > 0) gaps.push(`關聯待確認 ${pending} 筆`)
  return gaps
}

export function riskPersistedForAllRows(state: AppState, companyId: CompanyId = WORKSPACE_COMPANY_ID): boolean {
  const { confirmed, total } = riskConfirmedRowCount(state, companyId)
  return confirmed === total
}

export function planScheduled(state: AppState, companyId: CompanyId = WORKSPACE_COMPANY_ID): boolean {
  const co = companyFor(state, companyId)
  const settings = companySettingsFor(state, companyId)
  if (!settings.planWindowStart?.trim() || !settings.planWindowEnd?.trim()) return false
  if (!leadAuditorAppointed(state, companyId)) return false
  const hasMonth = co.planRows.some((row) => row.months.some(Boolean))
  return hasMonth
}

export function leadAuditorAppointed(state: AppState, companyId: CompanyId = WORKSPACE_COMPANY_ID): boolean {
  const settings = companySettingsFor(state, companyId)
  const date = settings.planWindowEnd || `${settings.auditYear}-12-31`
  return Boolean(resolveLeadAuditorPersonId(
    state.people,
    companyId,
    settings.auditYear,
    state.annualPersonnelAssignments,
    date,
  ))
}

export function auditStarted(state: AppState, companyId: CompanyId = WORKSPACE_COMPANY_ID): boolean {
  const co = companyFor(state, companyId)
  return co.audits.some((a) => a.status === '執行中' || a.status === '已回報')
}

export function prepComplete(state: AppState): boolean {
  const progress = countPrepProgress(state.externalAuditPrep)
  if (progress.done < progress.total) return false
  const warnings = evaluatePrepSequence({
    prep: state.externalAuditPrep,
    workspace: state.workspace,
    settings: state.settings,
    yearArchives: state.yearArchives,
  })
  return !warnings.sequenceWarning
}

export function canCompleteAuditReport(
  audit: { reportReference?: string; items: Array<{ judgment: string | null }> },
  rules = DEFAULT_SCORING_RULES,
): { ready: boolean; gaps: string[] } {
  const gaps: string[] = []
  if (!audit.reportReference?.trim()) {
    gaps.push('須填寫正式紀錄編號')
  }
  const score = scoreProcedureAudit(audit as Parameters<typeof scoreProcedureAudit>[0], rules)
  if (score.breakdown.pending > 0) {
    gaps.push(`尚有 ${score.breakdown.pending} 項待判定`)
  }
  return { ready: gaps.length === 0, gaps }
}

export function getPdcaOverview(state: AppState, companyId: CompanyId = WORKSPACE_COMPANY_ID): PdcaOverview {
  const co = companyFor(state, companyId)
  const planGaps: WorkflowGap[] = []
  if (!standardReady(state, companyId)) planGaps.push({ message: '適用標準與證書依據未完整', tab: 'system-settings' })
  if (!procedureSourceReady(state, companyId)) planGaps.push({ message: '正式紀錄保存位置未指定', tab: 'system-settings' })
  if (!stakeholdersReady(state, companyId)) {
    planGaps.push({ message: '部門利害關係人尚未全部標註', tab: 'plan', options: untaggedDepartmentPlanLink(co) })
  }
  for (const message of riskSourceGaps(co)) planGaps.push({ message, tab: 'risk-sources' })
  if (!riskPersistedForAllRows(state, companyId)) planGaps.push({ message: '方案風險尚未全部確認', tab: 'risk' })
  if (!leadAuditorAppointed(state, companyId)) planGaps.push({ message: '主任稽核員任命未完成', tab: 'personnel' })
  if (!planScheduled(state, companyId)) planGaps.push({ message: '年度計畫月格或窗口未排定', tab: 'plan' })

  const doGaps: WorkflowGap[] = []
  const started = co.audits.filter((a) => a.status === '執行中' || a.status === '已回報')
  const planning = co.audits.filter(
    (a) => (!a.status || a.status === '規劃中') && isAuditScheduledInPlan(co, a),
  )
  const reported = co.audits.filter((a) => a.status === '已回報')
  if (started.length === 0) doGaps.push({ message: '尚無已開始的稽核事件', tab: 'audit' })
  const inProgress = co.audits.filter((a) => a.status === '執行中')
  if (inProgress.length > 0) {
    doGaps.push({ message: `${inProgress.length} 件執行中待回報`, tab: 'audit' })
  }

  const checkGaps: WorkflowGap[] = []
  const openFollowups = countOpenFollowups(co)
  if (openFollowups > 0) {
    checkGaps.push({ message: `待追蹤 ${openFollowups} 件`, tab: 'followups' })
  }

  const actGaps: WorkflowGap[] = []
  const prepProgress = countPrepProgress(state.externalAuditPrep)
  if (prepProgress.done < prepProgress.total) {
    actGaps.push({ message: `外部稽核前準備 ${prepProgress.done}/${prepProgress.total}`, tab: 'prep' })
  }
  const prepWarnings = evaluatePrepSequence({
    prep: state.externalAuditPrep,
    workspace: state.workspace,
    settings: state.settings,
    yearArchives: state.yearArchives,
  })
  if (prepWarnings.sequenceWarning) {
    actGaps.push({ message: '內稽／管審／外稽順序或日期異常', tab: 'prep' })
  }

  const annualCloseGaps: WorkflowGap[] = []
  if (planGaps.length > 0) annualCloseGaps.push(...planGaps)
  if (started.length === 0) annualCloseGaps.push({ message: '年度內部稽核尚未開始', tab: 'audit' })
  if (planning.length > 0) {
    annualCloseGaps.push({ message: `${planning.length} 件已排程事件尚未開始`, tab: 'audit' })
  }
  if (inProgress.length > 0) annualCloseGaps.push({ message: `${inProgress.length} 件尚未完成回報`, tab: 'audit' })
  if (openFollowups > 0) {
    annualCloseGaps.push({ message: '尚有未結改善追蹤項目', tab: 'followups' })
  }
  if (!prepComplete(state)) annualCloseGaps.push({ message: '外部稽核前準備未完成', tab: 'prep' })

  return {
    plan: { ready: planGaps.length === 0, gaps: planGaps },
    do: { ready: doGaps.length === 0 && reported.length > 0, gaps: doGaps },
    check: { ready: checkGaps.length === 0, gaps: checkGaps },
    act: { ready: actGaps.length === 0, gaps: actGaps },
    annualCloseReady: annualCloseGaps.length === 0,
    annualCloseGaps,
  }
}

function pdcaPhaseForTab(tab: TabId): PdcaPhase {
  switch (tab) {
    case 'dashboard': return 'overview'
    case 'risk-sources':
    case 'risk':
    case 'plan':
    case 'personnel':
      return 'P'
    case 'audit':
      return 'D'
    case 'followups':
    case 'ncr':
    case 'observations':
    case 'suggestions':
      return 'C'
    case 'prep':
      return 'A'
    case 'system-settings':
      return 'system'
    default:
      return 'overview'
  }
}

export function getTabWorkflowStatus(state: AppState, tab: TabId): TabWorkflowStatus {
  const companyId = WORKSPACE_COMPANY_ID
  const co = companyFor(state, companyId)
  const gaps: WorkflowGap[] = []
  const advisories: WorkflowGap[] = []
  let ready = true

  switch (tab) {
    case 'dashboard': {
      ready = true
      const overview = getPdcaOverview(state, companyId)
      if (overview.annualCloseReady) {
        advisories.push({ message: '年度結案條件已滿足，可切換新年並帶入待追蹤項目' })
      } else {
        overview.annualCloseGaps.slice(0, 4).forEach((gap) => advisories.push(gap))
      }
      break
    }

    case 'risk-sources': {
      for (const message of riskSourceGaps(co)) gaps.push({ message })
      ready = gaps.length === 0
      break
    }

    case 'risk': {
      const { confirmed, total } = riskConfirmedRowCount(state, companyId)
      if (confirmed < total) {
        gaps.push({ message: `方案風險已確認 ${confirmed}/${total}` })
      }
      ready = confirmed === total
      break
    }

    case 'plan': {
      const planSettings = companySettingsFor(state, companyId)
      if (!planSettings.planWindowStart?.trim()) gaps.push({ message: '計畫窗口起始日尚未設定' })
      if (!planSettings.planWindowEnd?.trim()) gaps.push({ message: '計畫窗口結束日尚未設定' })
      if (!leadAuditorAppointed(state, companyId)) {
        gaps.push({ message: '主任稽核員任命未完成', tab: 'personnel' })
      }
      if (!co.planRows.some((row) => row.months.some(Boolean))) {
        gaps.push({ message: '至少須排定一個程序月格' })
      }
      const tagGap = stakeholderTagGap(co)
      if (tagGap) gaps.push(tagGap)
      
      const openSug = co.suggestions.filter((s) => s.status === 'open').length
      if (openSug > 0) {
        advisories.push({ message: `有 ${openSug} 件第三方建議未結案，請於規劃時納入考量`, tab: 'suggestions' })
      }
      
      ready = gaps.length === 0
      break
    }

    case 'personnel':
      if (!leadAuditorAppointed(state, companyId)) {
        gaps.push({ message: '主任稽核員任命未完成' })
      }
      ready = gaps.length === 0
      break

    case 'audit':
      if (!auditStarted(state, companyId)) {
        gaps.push({ message: '至少須有一筆稽核事件已開始（執行中或已回報）' })
      }
      ready = gaps.length === 0
      break

    case 'followups': {
      ready = true
      const pending = countOpenFollowups(co)
      if (pending > 0) advisories.push({ message: `待追蹤 ${pending} 件` })
      const carryForward = buildCarryForwardSummary(state, companyId)
      if (carryForward.total > 0) {
        advisories.push({
          message: `跨年待帶入 ${carryForward.total} 件，至觀察事項帶入`,
          tab: 'observations',
        })
      }
      break
    }

    case 'ncr':
    case 'observations':
    case 'suggestions':
      ready = true
      break

    case 'prep': {
      const warnings = evaluatePrepSequence({
        prep: state.externalAuditPrep,
        workspace: state.workspace,
        settings: state.settings,
        yearArchives: state.yearArchives,
      })
      if (warnings.sequenceWarning) gaps.push({ message: '內稽／管審／外稽順序或日期異常' })
      if (warnings.ncrWarning) advisories.push({ message: warnings.messages[0] ?? '尚有未結案 NCR' })
      const yearMismatch = formatPrepYearMismatch(
        state.externalAuditPrep.year,
        state.settings.auditYear,
      )
      if (yearMismatch) advisories.push({ message: yearMismatch })
      ready = gaps.length === 0
      break
    }

    case 'system-settings':
      ready = true
      break
  }

  return { tab, pdcaPhase: pdcaPhaseForTab(tab), ready, gaps, advisories }
}

export function canProceedToNextTab(state: AppState, tab: TabId): boolean {
  return getTabWorkflowStatus(state, tab).ready
}
