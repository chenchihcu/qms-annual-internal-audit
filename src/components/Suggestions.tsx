import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { exportSuggestionsExcel } from '../lib/formExport'
import type { SuggestionStatus } from '../types'
import { Badge, Button, Card, Input, Select } from './ui/Badge'

export function Suggestions({ store }: { store: AuditStore }) {
  const { state, updateSuggestion, carryForwardSuggestion, addSuggestion } = store
  const { company, settings } = state
  const currentYear = settings.auditYear
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    procedure: company.planRows[0]?.qpCode ?? '',
    departmentId: company.planRows[0]?.departmentId ?? '',
    issue: '',
    progress: '',
    responsibleUnit: '',
  })
  const [carryDept, setCarryDept] = useState<Record<string, string>>({})

  const statusLabel: Record<SuggestionStatus, string> = {
    open: '待追蹤',
    closed: '已結案',
  }

  const allSuggestions = useMemo(() => [
    ...company.suggestions,
    ...Object.entries(state.yearArchives)
      .filter(([year]) => year !== String(currentYear))
      .flatMap(([, archive]) => archive.companies[state.activeCompanyId]?.suggestions ?? []),
  ], [company.suggestions, state.yearArchives, state.activeCompanyId, currentYear])

  const prior = allSuggestions.filter((s) => s.year < currentYear)
  const current = allSuggestions.filter((s) => s.year >= currentYear)

  const planRowsForProcedure = (qp: string) =>
    company.planRows.filter((row) => row.qpCode === qp)

  return (
    <div className="space-y-6 print-area">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-2 text-lg font-semibold">第三方稽核建議事項一覽表</h2>
            <p className="text-sm text-slate-500">
              對應紙本建議追蹤表：程序、問題、進度、負責單位；可帶入新年度查檢表。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? '收起登錄' : '登錄建議'}</Button>
            <Button variant="secondary" onClick={() => exportSuggestionsExcel(state, state.activeCompanyId)}>匯出 Excel</Button>
          </div>
        </div>

        {showForm && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 no-print">
            <h3 className="mb-3 font-semibold">登錄第三方建議</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="程序 QP"
                value={form.procedure}
                onChange={(value) => {
                  const rows = planRowsForProcedure(value)
                  setForm({ ...form, procedure: value, departmentId: rows[0]?.departmentId ?? '' })
                }}
                options={company.planRows.map((row) => ({ value: row.qpCode, label: `${row.qpCode} · ${row.process}` }))}
              />
              <Select
                label="責任單位"
                value={form.departmentId}
                onChange={(value) => setForm({ ...form, departmentId: value })}
                options={planRowsForProcedure(form.procedure).map((row) => ({ value: row.departmentId, label: row.department }))}
              />
              <Input label="問題描述" value={form.issue} onChange={(value) => setForm({ ...form, issue: value })} />
              <Input label="負責單位（文字）" value={form.responsibleUnit} onChange={(value) => setForm({ ...form, responsibleUnit: value })} />
              <Input label="進度" value={form.progress} onChange={(value) => setForm({ ...form, progress: value })} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                disabled={!form.issue.trim()}
                onClick={() => {
                  addSuggestion({
                    year: currentYear,
                    procedure: form.procedure,
                    departmentId: form.departmentId || undefined,
                    issue: form.issue,
                    progress: form.progress,
                    responsibleUnit: form.responsibleUnit,
                    status: 'open',
                  })
                  setForm({ procedure: form.procedure, departmentId: form.departmentId, issue: '', progress: '', responsibleUnit: '' })
                  setShowForm(false)
                }}
              >
                儲存
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </div>
        )}

        {allSuggestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">尚無建議事項，請點「登錄建議」新增。</p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border p-2">年度</th>
                <th className="border p-2">程序</th>
                <th className="border p-2">問題描述</th>
                <th className="border p-2">進度</th>
                <th className="border p-2">負責單位</th>
                <th className="border p-2">狀態</th>
                <th className="border p-2 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {[...prior, ...current].map((sug) => {
                const rows = planRowsForProcedure(sug.procedure)
                const deptId = carryDept[sug.id] ?? sug.departmentId ?? rows[0]?.departmentId ?? ''
                return (
                <tr key={sug.id} className={sug.status === 'open' ? 'bg-amber-50/30' : ''}>
                  <td className="border p-2">{sug.year}</td>
                  <td className="border p-2 font-medium">{sug.procedure}</td>
                  <td className="border p-2">{sug.issue}</td>
                  <td className="border p-2">
                    <textarea
                      className="w-full min-w-[160px] rounded border border-slate-200 px-2 py-1 no-print"
                      rows={2}
                      aria-label={`${sug.year} ${sug.procedure} 建議進度`}
                      value={sug.progress}
                      onChange={(e) => updateSuggestion(sug.id, { progress: e.target.value })}
                    />
                    <span className="print-only">{sug.progress}</span>
                  </td>
                  <td className="border p-2">{sug.responsibleUnit}</td>
                  <td className="border p-2">
                    <div className="no-print">
                      <Select
                        ariaLabel={`${sug.year} ${sug.procedure} 建議狀態`}
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
                  <td className="border p-2 no-print">
                    {sug.status === 'open' && !sug.carriedToYear && rows.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {rows.length > 1 && (
                          <Select
                            label="帶入部門"
                            value={deptId}
                            onChange={(value) => setCarryDept({ ...carryDept, [sug.id]: value })}
                            options={rows.map((row) => ({ value: row.departmentId, label: row.department }))}
                          />
                        )}
                        <Button
                          variant="secondary"
                          disabled={!deptId}
                          onClick={() => carryForwardSuggestion(sug.id, sug.procedure, deptId)}
                        >
                          帶入 {currentYear} 年
                        </Button>
                      </div>
                    )}
                    {sug.carriedToYear && (
                      <span className="text-xs text-blue-600">已帶入 {sug.carriedToYear}</span>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </Card>
    </div>
  )
}
