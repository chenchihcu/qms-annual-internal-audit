import type { AuditStore } from '../hooks/useAuditStore'
import { FOCUS_RING } from '../lib/focusRing'
import { PROCESS_TYPES, PROCESS_TYPE_DEFINITIONS, processTypeKey } from '../lib/processTypes'
import { RISK_SOURCE_KIND_LABELS, type ProcessType } from '../types'
import { Select } from './ui/Badge'
import { ScrollRegion } from './ui/ScrollRegion'

/** 程序與風險來源對照：使用者指定程序類型，登錄事件時據以標示建議關聯（不限制其他關聯）。 */
export function ProcessTypeMatrix({ store }: { store: AuditStore }) {
  const { state, setProcedureProcessType } = store
  const { company } = state
  const types = company.procedureProcessTypes ?? {}
  const classified = company.planRows.filter((row) => types[processTypeKey(row.qpCode, row.departmentId)]).length

  return (
    <details className="text-sm">
      <summary className={`cursor-pointer text-tone-info-fg ${FOCUS_RING}`}>
        程序與風險來源對照（已分類 {classified}/{company.planRows.length}）
      </summary>
      <div className="mt-2 space-y-3">
        <p className="text-xs text-muted">
          用來引導事件該關聯哪些程序，不限制其他事件影響該程序；實際關聯仍依證據與控制責任判定。程序類型由你指定，系統不推定。
        </p>
        <ScrollRegion ariaLabel="程序類型與風險來源">
          <table className="worksheet-table min-w-[36rem] text-xs">
            <colgroup>
              <col className="col-name" />
              <col />
              <col className="col-inherent" />
            </colgroup>
            <thead>
              <tr>
                <th>程序類型</th>
                <th>主要關注的風險來源（範例）</th>
                <th>目前可登錄的來源</th>
              </tr>
            </thead>
            <tbody>
              {PROCESS_TYPES.map((type) => {
                const definition = PROCESS_TYPE_DEFINITIONS[type]
                return (
                  <tr key={type}>
                    <td>{definition.label}</td>
                    <td className="break-words">{definition.concerns.join('、')}</td>
                    <td>{definition.watchedKinds.length > 0 ? definition.watchedKinds.map((kind) => RISK_SOURCE_KIND_LABELS[kind]).join('、') : '尚無（待擴充來源類別）'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollRegion>
        <ScrollRegion ariaLabel="各程序類型指定">
          <table className="worksheet-table min-w-[36rem] text-xs">
            <colgroup>
              <col className="col-code" />
              <col />
              <col className="col-name" />
              <col className="col-inherent" />
            </colgroup>
            <thead>
              <tr>
                <th>QP</th>
                <th>程序名稱</th>
                <th>部門</th>
                <th>程序類型</th>
              </tr>
            </thead>
            <tbody>
              {company.planRows.map((row) => {
                const key = processTypeKey(row.qpCode, row.departmentId)
                return (
                  <tr key={key}>
                    <td>{row.qpCode}</td>
                    <td className="break-words">{row.process}</td>
                    <td>{row.department}</td>
                    <td>
                      <Select
                        ariaLabel={`${row.qpCode} ${row.department} 程序類型`}
                        value={types[key] ?? ''}
                        onChange={(value) => setProcedureProcessType(row.qpCode, row.departmentId, (value || null) as ProcessType | null)}
                        options={[
                          { value: '', label: '未分類' },
                          ...PROCESS_TYPES.map((type) => ({ value: type, label: PROCESS_TYPE_DEFINITIONS[type].label })),
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollRegion>
      </div>
    </details>
  )
}
