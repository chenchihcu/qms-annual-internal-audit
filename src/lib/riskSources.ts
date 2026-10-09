import type { RiskSourceEvent, RiskSourceKind, RiskSourceLinkStatus, RiskSourceTarget } from '../types'
import { isReasonFilled } from './reasonOptions'

export interface RiskSourceEventDraft {
  kind: RiskSourceKind
  externalReference: string
  date: string
  summary: string
  targets: RiskSourceTarget[]
}

export type RiskSourceDraftErrors = Partial<Record<'externalReference' | 'date' | 'summary' | 'targets', string>>

export function targetKey(target: Pick<RiskSourceTarget, 'qpCode' | 'departmentId'>): string {
  return `${target.qpCode}|${target.departmentId}`
}

export function effectiveLinkStatus(target: RiskSourceTarget): RiskSourceLinkStatus {
  return target.linkStatus ?? 'confirmed'
}

/** 判定不適用的關聯須選理由；點選計入或待確認不需填寫。 */
export function linkReasonMissing(target: RiskSourceTarget): boolean {
  return target.linkStatus === 'not_applicable' && !isReasonFilled(target.linkReason)
}

export interface RiskSourceValidationContext {
  existing: RiskSourceEvent[]
  auditYear: number
  today: string
  /** 計畫列鍵（qpCode|departmentId）；受影響對象須在年度計畫內才能連動風險指數。 */
  planKeys: string[]
}

/**
 * 外部來源登錄防呆：必填外部編號／日期／摘要／受影響 QP｜部門；
 * 日期不得晚於今天、不得早於評估期間（前一年度 1/1）；同類別外部編號不可重複（作廢者除外）。
 */
export function validateRiskSourceDraft(
  draft: RiskSourceEventDraft,
  context?: RiskSourceValidationContext,
): RiskSourceDraftErrors {
  const errors: RiskSourceDraftErrors = {}
  const reference = draft.externalReference.trim()
  if (!reference) errors.externalReference = '請填外部紀錄編號，供回查原始紀錄。'
  if (!draft.date) errors.date = '請填發生或核定日期。'
  if (draft.targets.length === 0) errors.targets = '請至少勾選一個受影響的 QP｜部門。'
  else if (draft.targets.some(linkReasonMissing)) errors.targets = '判定不適用的關聯須選理由。'
  if (!context) return errors

  if (reference && context.existing.some((event) =>
    !event.voidedAt && event.kind === draft.kind && event.externalReference.trim().toLowerCase() === reference.toLowerCase())) {
    errors.externalReference = '同類別已有相同外部編號；如需更正請先作廢原紀錄。'
  }
  const periodStart = `${context.auditYear - 1}-01-01`
  if (draft.date && draft.date > context.today) errors.date = '日期不可晚於今天。'
  else if (draft.date && draft.date < periodStart) errors.date = `早於評估期間（${periodStart} 起），不會計入風險。`
  if (draft.targets.some((target) => !context.planKeys.includes(`${target.qpCode}|${target.departmentId}`))) {
    errors.targets = '受影響對象不在本年度計畫列，無法連動風險指數。'
  }
  return errors
}

/** 盤點聲明防呆：日期必填且不可晚於今天。 */
export function validateCoverageDraft(checkedThrough: string, today: string): string | null {
  if (!checkedThrough) return '請選擇日期。'
  if (checkedThrough > today) return '日期不可晚於今天。'
  return null
}

export function applyAddRiskSource(
  events: RiskSourceEvent[],
  draft: RiskSourceEventDraft,
  id: string,
  now: string,
): RiskSourceEvent[] {
  return [
    ...events,
    {
      id,
      kind: draft.kind,
      externalReference: draft.externalReference.trim(),
      date: draft.date,
      summary: draft.summary.trim(),
      targets: draft.targets.map((target) => ({
        qpCode: target.qpCode,
        departmentId: target.departmentId,
        linkType: target.linkType ?? 'primary',
        linkStatus: target.linkStatus ?? 'confirmed',
        linkReason: target.linkReason?.trim() || undefined,
        linkUpdatedAt: now,
      })),
      createdAt: now,
    },
  ]
}

/** 作廢取代刪除：保留原紀錄與理由，推導時排除。 */
export function applyVoidRiskSource(
  events: RiskSourceEvent[],
  id: string,
  reason: string,
  now: string,
): RiskSourceEvent[] {
  const trimmed = reason.trim()
  if (!trimmed) return events
  return events.map((event) =>
    event.id === id && !event.voidedAt ? { ...event, voidedAt: now, voidReason: trimmed, updatedAt: now } : event,
  )
}

/** 變更單一關聯的確認狀態；判定不適用須選理由，否則不變更。 */
export function applyRiskSourceLinkStatus(
  events: RiskSourceEvent[],
  eventId: string,
  key: string,
  status: RiskSourceLinkStatus,
  reason: string,
  now: string,
): RiskSourceEvent[] {
  const trimmed = reason.trim()
  if (status === 'not_applicable' && !isReasonFilled(trimmed)) return events
  return events.map((event) => {
    if (event.id !== eventId || event.voidedAt) return event
    return {
      ...event,
      updatedAt: now,
      targets: event.targets.map((target) =>
        targetKey(target) === key
          ? { ...target, linkStatus: status, linkReason: trimmed || target.linkReason, linkUpdatedAt: now }
          : target,
      ),
    }
  })
}
