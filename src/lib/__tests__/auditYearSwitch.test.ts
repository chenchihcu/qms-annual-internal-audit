import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { buildYearSwitchDescription } from '../auditYearSwitch'

describe('buildYearSwitchDescription', () => {
  it('says a new year keeps plan rows and clears the month schedule', () => {
    const state = createDemoState()
    const text = buildYearSwitchDescription(state, 2030)
    expect(text).toContain('2030 年台帳：計畫列保留並清空月格，查檢事件與追蹤紀錄需重新建立')
    expect(text).not.toContain('空白年度台帳')
    expect(text).not.toContain('計畫與事件需重新建立')
  })

  it('says an archived year is restored', () => {
    const state = createDemoState()
    state.yearArchives['2031'] = {
      companies: { jiurun: state.companies.jiurun },
      companySettings: { jiurun: state.companySettings.jiurun },
    }
    expect(buildYearSwitchDescription(state, 2031)).toContain('將還原 2031 年已封存的計畫與事件')
  })
})
