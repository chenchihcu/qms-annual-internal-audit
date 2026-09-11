import type { ChecklistItem } from '../types'

/** Seed items: no origin (legacy), origin seed, or not custom/carryforward categories */
export function isSeedChecklistItem(item: ChecklistItem): boolean {
  if (item.origin === 'custom' || item.origin === 'carryforward') return false
  if (item.origin === 'seed') return true
  if (item.sourceYear || item.carriedFromId) return false
  if (item.category === '自訂' || item.category === '跨年追蹤' || item.category === '第三方建議') {
    return false
  }
  if (item.category === '待匯入') return false
  return true
}
