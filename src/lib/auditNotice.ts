import type { ProcedureAudit } from '../types'

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 標記已通知：若通知日期空白則設為今日，並設定 notifySent */
export function markAuditNotified(audit: ProcedureAudit, today = todayIsoDate()): ProcedureAudit {
  return {
    ...audit,
    notifyDate: audit.notifyDate.trim() !== '' ? audit.notifyDate : today,
    notifySent: true,
  }
}

export function normalizeAuditNotice(audit: ProcedureAudit): ProcedureAudit {
  return {
    ...audit,
    notifySent: audit.notifySent ?? false,
  }
}
