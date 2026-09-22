import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { FOCUS_RING } from '../lib/focusRing'
import type { SuggestionStatus } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'

export function Suggestions({ store }: { store: AuditStore }) {
  const { state, updateSuggestion, carryForwardSuggestion, addSuggestion } = store
  const { company, settings } = state
  const currentYear = settings.auditYear

  const [carryError, setCarryError] = useState<string | null>(null)
  const [issueError, setIssueError] = useState<string | undefined>()
  const [newSug, setNewSug] = useState({
    procedure: company.planRows[0]?.qpCode ?? 'QP-01',
    issue: '',
    progress: '',
    responsibleUnit: company.departments[0]?.name ?? '',
  })

  const statusLabel: Record<SuggestionStatus, string> = {
    open: '待追蹤',
    closed: '已結案',
  }

  const prior = company.suggestions.filter((s) => s.year < currentYear)
  const current = company.suggestions.filter((s) => s.year >= currentYear)
  const all = [...prior, ...current]

  const procedureOptions = [
    ...new Set(company.planRows.map((r) => r.qpCode)),
  ].map((qp) => ({ value: qp, label: qp }))

  const tryCarryForward = (sugId: string, procedure: string) => {
    const row = company.planRows.find((r) => r.qpCode === procedure)
    if (!row) {
      setCarryError(`找不到程序 ${procedure} 對應的年度計畫列，請先於年度計畫確認 QP。`)
      return
    }
    setCarryError(null)
    carryForwardSuggestion(sugId, row.qpCode, row.departmentId)
  }

  return (
    <div className="space-y-6 print-area">
      <PrintDocHeader
        companyName={company.name}
        auditYear={settings.auditYear}
        formTitle="第三方稽核建議事項一覽表"
      />

      <Card className="no-print">
        <h2 className="mb-3 text-lg font-semibold text-ink">新增建議事項</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="程序"
            value={newSug.procedure}
            onChange={(v) => setNewSug((s) => ({ ...s, procedure: v }))}
            options={procedureOptions}
          />
          <Input
            label="負責單位"
            value={newSug.responsibleUnit}
            onChange={(v) => setNewSug((s) => ({ ...s, responsibleUnit: v }))}
          />
          <Input
            label="問題描述"
            value={newSug.issue}
            error={issueError}
            onChange={(v) => {
              setNewSug((s) => ({ ...s, issue: v }))
              if (issueError && v.trim()) setIssueError(undefined)
            }}
          />
          <Input
            label="進度"
            value={newSug.progress}
            onChange={(v) => setNewSug((s) => ({ ...s, progress: v }))}
          />
          <div className="flex items-end">
            <Button
              onClick={() => {
                if (!newSug.issue.trim()) {
                  setIssueError('請填寫問題描述')
                  return
                }
                setIssueError(undefined)
                addSuggestion(newSug)
                setNewSug((s) => ({ ...s, issue: '', progress: '' }))
              }}
              disabled={!newSug.issue.trim()}
            >
              新增
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">第三方稽核建議事項一覽表</h2>
        <p className="mb-4 text-sm text-muted">
          對應紙本建議追蹤表：程序、問題、進度、負責單位；可帶入新年度查檢表。
        </p>

        {carryError && (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
            {carryError}
          </p>
        )}

        {all.length === 0 ? (
          <EmptyState message="尚無第三方建議事項，請使用上方表單新增。" />
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs text-muted no-print">表格可左右滑動</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-page text-left text-muted">
                  <th className="border border-line p-2">年度</th>
                  <th className="border border-line p-2">程序</th>
                  <th className="border border-line p-2">問題描述</th>
                  <th className="border border-line p-2">進度</th>
                  <th className="border border-line p-2">負責單位</th>
                  <th className="border border-line p-2">狀態</th>
                  <th className="border border-line p-2 no-print">操作</th>
                </tr>
              </thead>
              <tbody>
                {all.map((sug) => (
                  <tr key={sug.id} className={sug.status === 'open' ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}>
                    <td className="border border-line p-2">{sug.year}</td>
                    <td className="border border-line p-2 font-medium text-ink">{sug.procedure}</td>
                    <td className="border border-line p-2">{sug.issue}</td>
                    <td className="border border-line p-2">
                      <textarea
                        className={`w-full min-w-[160px] rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        rows={2}
                        value={sug.progress}
                        onChange={(e) => updateSuggestion(sug.id, { progress: e.target.value })}
                      />
                      <span className="print-only">{sug.progress}</span>
                    </td>
                    <td className="border border-line p-2">{sug.responsibleUnit}</td>
                    <td className="border border-line p-2">
                      <div className="no-print">
                        <Select
                          value={sug.status}
                          onChange={(v) => updateSuggestion(sug.id, { status: v as SuggestionStatus })}
                          options={[
                            { value: 'open', label: '待追蹤' },
                            { value: 'closed', label: '已結案' },
                          ]}
                        />
                      </div>
                      <span className="print-only"><Badge label={statusLabel[sug.status]} /></span>
                    </td>
                    <td className="border border-line p-2 no-print">
                      {sug.status === 'open' && !sug.carriedToYear && (
                        <Button
                          variant="secondary"
                          onClick={() => tryCarryForward(sug.id, sug.procedure)}
                        >
                          帶入 {currentYear} 年
                        </Button>
                      )}
                      {sug.carriedToYear && (
                        <span className="text-xs text-primary">已帶入 {sug.carriedToYear}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
