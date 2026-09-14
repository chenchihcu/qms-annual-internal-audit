import { useMemo, useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { AS9100_CLAUSE_SEED } from '../data/as9100Clauses'
import { buildClauseIndex, filterClauseMappings } from '../lib/clauseMapping'
import { Card, Select } from './ui/Badge'

export function ClauseMappingPanel({ store }: { store: AuditStore }) {
  const { state } = store
  const [filterClause, setFilterClause] = useState('')

  const index = useMemo(() => buildClauseIndex(state), [state])
  const filtered = useMemo(
    () => filterClauseMappings(index, filterClause),
    [index, filterClause],
  )

  const clauseOptions = [
    { value: '', label: '全部（含資料）' },
    ...AS9100_CLAUSE_SEED.map((c) => ({
      value: c.clause,
      label: `${c.clause} ${c.title}`,
    })),
  ]

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">AS9100 條款對照</h2>
        <p className="mb-4 text-sm text-muted">
          依查檢表 AS9100 欄位與 NCR 連結項目彙整；條款清單為摘要種子，非完整標準全文。
        </p>
        <div className="max-w-md">
          <Select
            label="篩選條款"
            value={filterClause}
            onChange={setFilterClause}
            options={clauseOptions}
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">目前無符合條件的查檢項或 NCR。</p>
        </Card>
      ) : (
        filtered.map((row) => (
          <Card key={row.clause}>
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h3 className="text-base font-semibold text-ink">
                {row.clause} · {row.title}
              </h3>
              <span className="rounded-full bg-page px-2 py-0.5 text-xs text-muted">{row.category}</span>
            </div>

            {row.checklistRefs.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-muted">查檢表項目</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-page text-left text-muted">
                        <th className="border border-line p-2">公司</th>
                        <th className="border border-line p-2">程序</th>
                        <th className="border border-line p-2">NO</th>
                        <th className="border border-line p-2">內容</th>
                        <th className="border border-line p-2">判定</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.checklistRefs.map((ref, i) => (
                        <tr key={`${ref.companyId}-${ref.qpCode}-${ref.itemNo}-${i}`}>
                          <td className="border border-line p-2">{ref.companyName}</td>
                          <td className="border border-line p-2">
                            {ref.qpCode} · {ref.department}
                          </td>
                          <td className="border border-line p-2 text-center">{ref.itemNo}</td>
                          <td className="border border-line p-2">{ref.content}</td>
                          <td className="border border-line p-2">{ref.judgment ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {row.ncrRefs.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">不符合（NCR）</p>
                <ul className="space-y-2 text-sm">
                  {row.ncrRefs.map((ref) => (
                    <li key={ref.ncrNumber} className="rounded-lg border border-line bg-page/40 p-3">
                      <p className="font-mono text-xs font-semibold">{ref.ncrNumber}</p>
                      <p className="text-muted">
                        {ref.companyName} · {ref.qpCode} · {ref.status}
                      </p>
                      <p className="mt-1">{ref.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
