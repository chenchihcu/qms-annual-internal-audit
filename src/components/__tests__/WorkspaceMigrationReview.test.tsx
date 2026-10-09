import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceMigrationReview } from '../WorkspaceMigrationReview'
import type { AuditStore } from '../../hooks/useAuditStore'
import type { WorkspaceMigrationConflict } from '../../types'

function makeStore(conflicts: WorkspaceMigrationConflict[]) {
  return {
    state: { workspaceMigrationConflicts: conflicts },
    resolveWorkspaceConflict: vi.fn(),
  } as unknown as AuditStore
}

describe('WorkspaceMigrationReview', () => {
  const conflict: WorkspaceMigrationConflict = {
    id: 'review-1',
    category: 'judgment',
    title: '品質政策 第 1 題：objectiveEvidence',
    summary: '兩份查檢紀錄的補充內容不同；請比對稽核證據後選擇保留內容。',
    target: { kind: 'checklist', auditId: 'a1', itemId: 'i1', field: 'objectiveEvidence' },
    candidates: [
      { source: '來源資料一', label: '來源資料一：品質政策公告照片', value: '品質政策公告照片' },
      { source: '來源資料二', label: '來源資料二：公布欄巡查紀錄', value: '公布欄巡查紀錄' },
    ],
  }

  it('並列兩份候選內容，標題顯示中文欄位名', () => {
    const store = makeStore([conflict])
    render(<WorkspaceMigrationReview store={store} onNavigate={() => {}} />)
    expect(screen.getByRole('heading', { name: '品質政策 第 1 題：客觀證據' })).toBeTruthy()
    const first = screen.getByRole('region', { name: '來源資料一內容' })
    const second = screen.getByRole('region', { name: '來源資料二內容' })
    expect(within(first).getByText('品質政策公告照片')).toBeTruthy()
    expect(within(second).getByText('公布欄巡查紀錄')).toBeTruthy()
    fireEvent.click(within(second).getByRole('button', { name: /採用來源資料二/ }))
    expect(store.resolveWorkspaceConflict).toHaveBeenCalledWith('review-1', 1)
  })

  it('沒有候選值時須勾選已核對才能完成覆核', () => {
    const store = makeStore([{ ...conflict, candidates: undefined, target: { kind: 'manual' } }])
    render(<WorkspaceMigrationReview store={store} onNavigate={() => {}} />)
    const done = screen.getByRole('button', { name: '完成覆核' }) as HTMLButtonElement
    expect(done.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('已核對並整理資料'))
    expect(done.disabled).toBe(false)
  })
})
