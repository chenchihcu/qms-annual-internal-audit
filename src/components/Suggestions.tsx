import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { SuggestionStatus } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

export function Suggestions({ store }: { store: AuditStore }) {
  const { state, updateSuggestion, carryForwardSuggestion, addSuggestion } = store
  const { company, settings } = state
  const currentYear = settings.auditYear

  const [carryError, setCarryError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
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
  const selectedProcedure = procedureOptions.some((option) => option.value === newSug.procedure)
    ? newSug.procedure
    : procedureOptions[0]?.value ?? ''

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
        formTitle="建議追蹤"
      />

      <Card className="no-print">
        <h2 className="mb-3 text-lg font-semibold text-ink">新增建議</h2>
        <form
          className="record-create-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedProcedure) {
              setFormSuccess(null)
              setFormError('請先建立年度計畫。')
              return
            }
            if (!newSug.issue.trim()) {
              setFormSuccess(null)
              setFormError('請填寫問題描述。')
              return
            }
            addSuggestion({ ...newSug, procedure: selectedProcedure })
            setNewSug((s) => ({ ...s, procedure: selectedProcedure, issue: '', progress: '' }))
            setFormError(null)
            setFormSuccess('已新增建議。')
          }}
        >
          <Select
            label="程序"
            value={selectedProcedure}
            onChange={(v) => setNewSug((s) => ({ ...s, procedure: v }))}
            options={procedureOptions}
            disabled={!procedureOptions.length}
            required
            error={formError && !selectedProcedure ? formError : undefined}
          />
          <Input
            label="負責單位"
            value={newSug.responsibleUnit}
            onChange={(v) => setNewSug((s) => ({ ...s, responsibleUnit: v }))}
          />
          <Input
            label="問題描述"
            value={newSug.issue}
            onChange={(v) => { setNewSug((s) => ({ ...s, issue: v })); setFormError(null); setFormSuccess(null) }}
            required
            error={formError && selectedProcedure ? formError : undefined}
          />
          <Input
            label="進度"
            value={newSug.progress}
            onChange={(v) => setNewSug((s) => ({ ...s, progress: v }))}
          />
          <div className="record-create-submit">
            <Button type="submit">
              新增建議
            </Button>
          </div>
          <div className="record-create-feedback" aria-live="polite">
            {formSuccess && <p role="status" className="text-sm font-medium text-green-800 dark:text-green-300">{formSuccess}</p>}
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">建議追蹤</h2>
        {carryError && (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
            {carryError}
          </p>
        )}

        {all.length === 0 ? (
          <EmptyState message="尚無建議；請先新增。" />
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="建議追蹤表">
            <table className="stacked-table w-full border-collapse text-sm">
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
                    <td data-label="年度" className="border border-line p-2">{sug.year}</td>
                    <td data-label="程序" className="border border-line p-2 font-medium text-ink">{sug.procedure}</td>
                    <td data-label="問題描述" className="border border-line p-2">{sug.issue}</td>
                    <td data-label="進度" className="border border-line p-2">
                      <textarea
                        className={`w-full min-w-[160px] rounded border border-line bg-surface px-2 py-1 no-print ${FOCUS_RING}`}
                        rows={2}
                        value={sug.progress}
                        aria-label={`${sug.year} 年 ${sug.procedure} ${sug.responsibleUnit} 進度`}
                        onChange={(e) => updateSuggestion(sug.id, { progress: e.target.value })}
                      />
                      <span className="print-only">{sug.progress}</span>
                    </td>
                    <td data-label="負責單位" className="border border-line p-2">{sug.responsibleUnit}</td>
                    <td data-label="狀態" className="border border-line p-2">
                      <div className="no-print">
                        <Select
                          value={sug.status}
                          ariaLabel={`${sug.year} 年 ${sug.procedure} ${sug.responsibleUnit} 狀態`}
                          onChange={(v) => updateSuggestion(sug.id, { status: v as SuggestionStatus })}
                          options={[
                            { value: 'open', label: '待追蹤' },
                            { value: 'closed', label: '已結案' },
                          ]}
                        />
                      </div>
                      <span className="print-only"><Badge label={statusLabel[sug.status]} /></span>
                    </td>
                    <td data-label="操作" className="border border-line p-2 no-print">
                      {sug.status === 'open' && !sug.carriedToYear && (
                        <Button
                          variant="secondary"
                          onClick={() => tryCarryForward(sug.id, sug.procedure)}
                        >
                          帶入本年
                        </Button>
                      )}
                      {sug.carriedToYear && (
                        <span className="text-xs text-link">已帶入 {sug.carriedToYear}</span>
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
