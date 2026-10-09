/** 方案風險各類理由一律用選單；只有「其他」需補一行說明，存成「其他：說明」。 */
export const OTHER_REASON = '其他'

export const OVERRIDE_REASONS = ['系統紀錄不完整（已有外部紀錄）', '調查結論與系統歸屬不同', '同一事件重複計數', OTHER_REASON] as const
export const UNAVAILABLE_REASONS = ['外部系統無法查詢', '紀錄尚未彙整', OTHER_REASON] as const
export const NOT_APPLICABLE_REASONS = ['調查確認非此程序責任', '重複關聯', OTHER_REASON] as const

export function splitReason(value: string | undefined, options: readonly string[]): { option: string; detail: string } {
  const text = value?.trim() ?? ''
  if (!text) return { option: '', detail: '' }
  if (options.includes(text) && text !== OTHER_REASON) return { option: text, detail: '' }
  const detail = text.startsWith(`${OTHER_REASON}：`) ? text.slice(OTHER_REASON.length + 1) : text
  return { option: OTHER_REASON, detail }
}

export function joinReason(option: string, detail: string): string {
  if (!option) return ''
  return option === OTHER_REASON ? `${OTHER_REASON}：${detail}` : option
}

/** 已選理由；選「其他」時須有說明。 */
export function isReasonFilled(value: string | undefined): boolean {
  const text = value?.trim() ?? ''
  return text !== '' && text !== `${OTHER_REASON}：` && text !== OTHER_REASON
}
