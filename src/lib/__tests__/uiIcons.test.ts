import { describe, expect, it } from 'vitest'
import { ALL_TABS, TAB_GROUPS } from '../navigation'
import {
  BADGE_ICONS,
  TAB_GROUP_ICONS,
  TAB_GROUP_KEYS,
  TAB_ICONS,
  badgeIconFor,
} from '../uiIcons'
import { PATHS } from '../../components/ui/Icon'

describe('uiIcons', () => {
  it('defines icons for every tab and group', () => {
    for (const tab of ALL_TABS) {
      expect(tab.icon).toBe(TAB_ICONS[tab.id])
      expect(PATHS[tab.icon]).toBeTruthy()
    }
    for (const group of TAB_GROUPS) {
      expect(group.icon).toBeTruthy()
      expect(PATHS[group.icon]).toBeTruthy()
      expect(TAB_GROUP_KEYS[group.label]).toBeTruthy()
      expect(group.icon).toBe(TAB_GROUP_ICONS[TAB_GROUP_KEYS[group.label]])
    }
  })

  it('maps badge labels to known icon paths', () => {
    const labels = ['符合', '不符', '觀察', '高', '中', '低', '開立', '矯正中', '結案', '規劃中', '執行中', '已回報', 'NCR', '建議', '待追蹤', '已結案', '已轉 NCR', '系統稽核', '製程稽核', '型態稽核']
    for (const label of labels) {
      const icon = badgeIconFor(label)
      expect(icon).toBe(BADGE_ICONS[label])
      expect(icon && PATHS[icon]).toBeTruthy()
    }
    expect(badgeIconFor('2026年')).toBeUndefined()
  })
})
