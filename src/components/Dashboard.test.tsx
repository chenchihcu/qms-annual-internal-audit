import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDemoState } from '../data/demoData'
import { projectSharedPlan } from '../lib/sharedPlan'
import { Dashboard } from './Dashboard'

describe('儀表板共用計畫投影', () => {
  it('稽核重點只列目前公司適用程序並顯示共用計畫的負責人', () => {
    const demo = createDemoState()
    const row = demo.sharedPlanRows!.find((plan) => plan.qpCode === 'QP-05' && plan.departmentId === 'dept-qa')!
    const view = render(<Dashboard state={{ ...demo, company: demo.companies.jiurun }} onNavigate={() => {}} />)
    const focus = () => within(screen.getByRole('region', { name: '稽核重點表' }))
    expect(focus().getByText('QP-05')).toBeTruthy()

    const state = projectSharedPlan(demo, demo.sharedPlanRows!.map((plan) =>
      plan.id === row.id
        ? { ...plan, department: '共同品保組', owner: '共同受稽核負責人', applicableCompanies: ['zhenglongxing'] }
        : plan,
    ))
    view.rerender(<Dashboard state={{ ...state, company: state.companies.jiurun }} onNavigate={() => {}} />)
    expect(focus().queryByText('QP-05')).toBeNull()
    view.rerender(<Dashboard state={{ ...state, company: state.companies.zhenglongxing }} onNavigate={() => {}} />)
    const procedureRow = focus().getByText('QP-05').closest('tr')!
    expect(within(procedureRow).getByText('共同品保組')).toBeTruthy()
    expect(within(procedureRow).getByText('共同受稽核負責人')).toBeTruthy()
  })
})
