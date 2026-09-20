import { countPrepProgress, evaluatePrepSequence } from './externalAuditPrep'
import { countOpenFollowups } from './followupQueue'
import { resolveLeadAuditorPersonId } from './personnel'
import { scoreProcedureAudit } from './scoring'
import type { AppState, CompanyId, TabId } from '../types'
import { companySettingsFor, DEFAULT_SCORING_RULES } from '../types'

export type PdcaPhase = 'P' | 'D' | 'C' | 'A' | 'overview' | 'system'

export interface WorkflowGap {
  message: string
  tab?: TabId
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

function profileFor(state: AppState, companyId: CompanyId) {
  return state.companyAuditProfiles[companyId]
}

function companyFor(state: AppState, companyId: CompanyId = state.activeCompanyId) {
  return state.companies[companyId]
}

export function procedureSourceReady(state: AppState, companyId: CompanyId = state.activeCompanyId): boolean {
  const profile = profileFor(state, companyId)
  return Boolean(
    profile.auditProcedureCode.trim()
      && profile.auditProcedureVersion.trim()
      && profile.auditProcedureVersion !== '待確認'
      && profile.formalRecordLocation.trim(),
  )
}

export function standardReady(state: AppState, companyId: CompanyId = state.activeCompanyId): boolean {
  const profile = profileFor(state, companyId)
  const confirmed = profile.applicableStandards.filter((s) => s.confirmationStatus === 'confirmed')
  if (confirmed.length === 0) return false
  if (!confirmed.every((s) => s.evidenceReference.trim())) return false
  if (!profile.certificateScope.trim()) return false
  if (!profile.certificateReference.trim()) return false
  return true
}

export function stakeholdersReady(state: AppState, companyId: CompanyId = state.activeCompanyId): boolean {
  const co = companyFor(state, companyId)
  if (co.departments.length === 0) return false
  return co.departments.every((dept) => dept.stakeholders.length >= 1)
}

export function riskPersistedForAllRows(state: AppState, companyId: CompanyId = state.activeCompanyId): boolean {
  const co = companyFor(state, companyId)
  return co.planRows.every((row) =>
    co.procedureRisks?.some(
      (r) => r.qpCode === row.qpCode && r.departmentId === row.departmentId && r.inherentRisk >= 1,
    ),
  )
}

export function planScheduled(state: AppState, companyId: CompanyId = state.activeCompanyId): boolean {
  const co = companyFor(state, companyId)
  const settings = companySettingsFor(state, companyId)
  if (!settings.planWindowStart?.trim() || !settings.planWindowEnd?.trim()) return false
  if (!settings.leadAuditor?.trim()) return false
  const hasMonth = co.planRows.some((row) => row.months.some(Boolean))
  return hasMonth
}

export function leadAuditorAppointed(state: AppState, companyId: CompanyId = state.activeCompanyId): boolean {
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

export function auditStarted(state: AppState, companyId: CompanyId = state.activeCompanyId): boolean {
  const co = companyFor(state, companyId)
  return co.audits.some((a) => a.status === '執行中' || a.status === '已回報')
}

export function prepComplete(state: AppState): boolean {
  const progress = countPrepProgress(state.externalAuditPrep, state.companyRelationships)
  if (progress.done < progress.total) return false
  const warnings = evaluatePrepSequence({
    prep: state.externalAuditPrep,
    companies: state.companies,
    companySettings: state.companySettings,
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

export function getPdcaOverview(state: AppState, companyId: CompanyId = state.activeCompanyId): PdcaOverview {
  const co = companyFor(state, companyId)
  const planGaps: WorkflowGap[] = []
  if (!standardReady(state, companyId)) planGaps.push({ message: '適用標準與證書依據未完整', tab: 'standard' })
  if (!procedureSourceReady(state, companyId)) planGaps.push({ message: '程序來源三欄未齊全', tab: 'procedure' })
  if (!stakeholdersReady(state, companyId)) planGaps.push({ message: '部門利害關係人尚未全部標註', tab: 'stakeholders' })
  if (!riskPersistedForAllRows(state, companyId)) planGaps.push({ message: '方案風險尚未全部存檔', tab: 'risk' })
  if (!leadAuditorAppointed(state, companyId)) planGaps.push({ message: '主任稽核員任命未完成', tab: 'personnel' })
  if (!planScheduled(state, companyId)) planGaps.push({ message: '年度計畫月格或窗口未排定', tab: 'plan' })

  const doGaps: WorkflowGap[] = []
  const started = co.audits.filter((a) => a.status === '執行中' || a.status === '已回報')
  const planning = co.audits.filter((a) => !a.status || a.status === '規劃中')
  const reported = co.audits.filter((a) => a.status === '已回報')
  if (started.length === 0) doGaps.push({ message: '尚無已開始的稽核事件', tab: 'schedule' })
  const inProgress = co.audits.filter((a) => a.status === '執行中')
  if (inProgress.length > 0) {
    doGaps.push({ message: `${inProgress.length} 件執行中待回報`, tab: 'schedule' })
  }

  const checkGaps: WorkflowGap[] = []
  const openFollowups = countOpenFollowups(co)
  if (openFollowups > 0) {
    checkGaps.push({ message: `待追蹤 ${openFollowups} 件`, tab: 'followups' })
  }

  const actGaps: WorkflowGap[] = []
  const prepProgress = countPrepProgress(state.externalAuditPrep, state.companyRelationships)
  if (prepProgress.done < prepProgress.total) {
    actGaps.push({ message: `外部稽核前準備 ${prepProgress.done}/${prepProgress.total}`, tab: 'prep' })
  }
  const prepWarnings = evaluatePrepSequence({
    prep: state.externalAuditPrep,
    companies: state.companies,
    companySettings: state.companySettings,
    yearArchives: state.yearArchives,
  })
  if (prepWarnings.sequenceWarning) {
    actGaps.push({ message: '管審／內稽序位異常', tab: 'prep' })
  }

  const annualCloseGaps: WorkflowGap[] = []
  if (planGaps.length > 0) annualCloseGaps.push(...planGaps)
  if (started.length === 0) annualCloseGaps.push({ message: '年度內部稽核尚未開始', tab: 'schedule' })
  if (planning.length > 0 && co.planRows.some((r) => r.months.some(Boolean))) {
    annualCloseGaps.push({ message: `${planning.length} 件計畫事件尚未開始`, tab: 'schedule' })
  }
  if (inProgress.length > 0) annualCloseGaps.push({ message: `${inProgress.length} 件尚未完成回報`, tab: 'schedule' })
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
    case 'standard':
    case 'procedure':
    case 'stakeholders':
    case 'risk':
    case 'plan':
    case 'personnel':
      return 'P'
    case 'schedule':
    case 'audit':
      return 'D'
    case 'followups':
    case 'ncr':
    case 'observations':
    case 'suggestions':
      return 'C'
    case 'prep':
    case 'onsite':
      return 'A'
    case 'system-settings':
      return 'system'
    default:
      return 'overview'
  }
}

export function getTabWorkflowStatus(state: AppState, tab: TabId): TabWorkflowStatus {
  const companyId = state.activeCompanyId
  const co = companyFor(state, companyId)
  const profile = profileFor(state, companyId)
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

    case 'standard':
      if (!profile.applicableStandards.some((s) => s.confirmationStatus === 'confirmed')) {
        gaps.push({ message: '至少一項適用標準須標為已確認' })
      }
      const confirmed = profile.applicableStandards.filter((s) => s.confirmationStatus === 'confirmed')
      if (confirmed.some((s) => !s.evidenceReference.trim())) {
        gaps.push({ message: '已確認標準須填寫依據引用' })
      }
      if (!profile.certificateScope.trim()) gaps.push({ message: '證書範圍尚未填寫' })
      if (!profile.certificateReference.trim()) gaps.push({ message: '證書／依據編號尚未填寫' })
      ready = gaps.length === 0
      break

    case 'procedure':
      if (!profile.auditProcedureCode.trim()) gaps.push({ message: '稽核程序代碼尚未填寫' })
      if (!profile.auditProcedureVersion.trim() || profile.auditProcedureVersion === '待確認') {
        gaps.push({ message: '稽核程序版本尚未確認' })
      }
      if (!profile.formalRecordLocation.trim()) gaps.push({ message: '正式紀錄保存位置尚未填寫' })
      ready = gaps.length === 0
      break

    case 'stakeholders': {
      const total = co.departments.length
      const tagged = co.departments.filter((d) => d.stakeholders.length >= 1).length
      if (tagged < total) {
        gaps.push({ message: `利害關係人已標註 ${tagged}/${total}` })
      }
      ready = tagged === total
      break
    }

    case 'risk': {
      const total = co.planRows.length
      const savedCount = co.planRows.filter((row) =>
        co.procedureRisks?.some(
          (r) => r.qpCode === row.qpCode && r.departmentId === row.departmentId && r.inherentRisk >= 1,
        ),
      ).length
      if (savedCount < total) {
        gaps.push({ message: `固有風險已存檔 ${savedCount}/${total}` })
      }
      ready = savedCount === total
      break
    }

    case 'plan': {
      const planSettings = companySettingsFor(state, companyId)
      if (!planSettings.planWindowStart?.trim()) gaps.push({ message: '計畫窗口起始日尚未設定' })
      if (!planSettings.planWindowEnd?.trim()) gaps.push({ message: '計畫窗口結束日尚未設定' })
      if (!planSettings.leadAuditor?.trim()) gaps.push({ message: '主任稽核員尚未設定' })
      if (!co.planRows.some((row) => row.months.some(Boolean))) {
        gaps.push({ message: '至少須排定一個程序月格' })
      }
      ready = gaps.length === 0
      break
    }

    case 'personnel':
      if (!leadAuditorAppointed(state, companyId)) {
        gaps.push({ message: '現行公司尚無有效主任稽核員任命' })
      }
      ready = gaps.length === 0
      break

    case 'schedule': {
      if (co.audits.length === 0) {
        gaps.push({ message: '尚無可排程的稽核事件' })
      }
      ready = gaps.length === 0
      break
    }

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
      break
    }

    case 'ncr':
    case 'observations':
    case 'suggestions':
      ready = true
      const openNcr = co.ncrs.filter((n) => n.status !== '結案').length
      const openObs = co.observations.filter((o) => o.status === 'open').length
      const openSug = co.suggestions.filter((s) => s.status === 'open').length
      if (tab === 'ncr' && openNcr > 0) advisories.push({ message: `尚有 ${openNcr} 件未結案 NCR` })
      if (tab === 'observations' && openObs > 0) advisories.push({ message: `尚有 ${openObs} 件待追蹤觀察` })
      if (tab === 'suggestions' && openSug > 0) advisories.push({ message: `尚有 ${openSug} 件待追蹤建議` })
      break

    case 'onsite':
      ready = true
      if ((state.externalAuditPrep.onsiteSlots?.length ?? 0) === 0) {
        advisories.push({ message: '尚未排定外稽當日時段' })
      }
      break

    case 'prep': {
      const progress = countPrepProgress(state.externalAuditPrep, state.companyRelationships)
      if (progress.done < progress.total) {
        gaps.push({ message: `準備清單 ${progress.done}/${progress.total} 項完成` })
      }
      const warnings = evaluatePrepSequence({
        prep: state.externalAuditPrep,
        companies: state.companies,
        companySettings: state.companySettings,
        yearArchives: state.yearArchives,
      })
      if (warnings.sequenceWarning) gaps.push({ message: '管審／內稽序位異常' })
      if (warnings.ncrWarning) advisories.push({ message: warnings.messages[0] ?? '尚有未結案 NCR' })
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
