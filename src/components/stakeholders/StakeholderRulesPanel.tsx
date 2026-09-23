import {
  ARRANGEMENT_IMPACT_RULES,
  OCCURRENCE_BAND_GUIDE,
  OS_BAND_LABELS,
  OS_BAND_ORDER,
  osBandToScale,
  SEVERITY_BAND_GUIDE,
  STAKEHOLDER_WEIGHTS,
  STAKEHOLDER_WORKFLOW_REFERENCES,
} from '../../lib/planner'
import { buildAppHash, tabLabel } from '../../lib/navigation'
import { STAKEHOLDER_TAGS } from '../../types'

export function StakeholderRulesPanel() {
  return (
    <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
        評分規則與編排影響
      </summary>
      <div className="space-y-4 border-t border-slate-200 p-3 text-xs text-slate-700">
        <p className="text-sm text-slate-600">
          優先分數 = Σ(標籤權重)×2 + O×S（系統將低／中／高換算為 1／3／5 再計算）。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-slate-700">發生度（不符合／客訴／稽核缺失有多常出現）</p>
            <ul className="mt-1 space-y-0.5">
              {OS_BAND_ORDER.map((band) => (
                <li key={`o-${band}`}>
                  {OS_BAND_LABELS[band]} → {osBandToScale(band)}：{OCCURRENCE_BAND_GUIDE[band]}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-700">嚴重度（一旦發生對客戶／法規／經營的衝擊）</p>
            <ul className="mt-1 space-y-0.5">
              {OS_BAND_ORDER.map((band) => (
                <li key={`s-${band}`}>
                  {OS_BAND_LABELS[band]} → {osBandToScale(band)}：{SEVERITY_BAND_GUIDE[band]}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {STAKEHOLDER_TAGS.map((tag) => (
            <div key={tag}>
              <dt className="inline font-medium">{tag}</dt>
              <dd className="inline">：{STAKEHOLDER_WEIGHTS[tag] ?? 0}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="font-semibold text-slate-800">編排影響（預覽自動編排時）</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li><span className="font-medium">包含：</span>{ARRANGEMENT_IMPACT_RULES.scope}</li>
            <li><span className="font-medium">觸發：</span>{ARRANGEMENT_IMPACT_RULES.trigger}</li>
            <li><span className="font-medium">不含：</span>{ARRANGEMENT_IMPACT_RULES.excludes}</li>
            <li><span className="font-medium">本欄：</span>{ARRANGEMENT_IMPACT_RULES.columnNote}</li>
          </ul>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
          <p className="font-semibold text-slate-800">對應程序／章節／使用表單</p>
          <table className="mt-2 w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border border-slate-200 p-2">類別</th>
                <th className="border border-slate-200 p-2">代碼</th>
                <th className="border border-slate-200 p-2">名稱／條文</th>
                <th className="border border-slate-200 p-2">與本頁關係</th>
              </tr>
            </thead>
            <tbody>
              {STAKEHOLDER_WORKFLOW_REFERENCES.procedures.map((row) => (
                <tr key={row.code}>
                  <td className="border border-slate-200 p-2">程序</td>
                  <td className="border border-slate-200 p-2 font-medium">{row.code}</td>
                  <td className="border border-slate-200 p-2">{row.name}</td>
                  <td className="border border-slate-200 p-2">{row.note}</td>
                </tr>
              ))}
              {STAKEHOLDER_WORKFLOW_REFERENCES.clauses.map((row) => (
                <tr key={`${row.standard}-${row.clause}`}>
                  <td className="border border-slate-200 p-2">章節</td>
                  <td className="border border-slate-200 p-2 font-medium">{row.standard} {row.clause}</td>
                  <td className="border border-slate-200 p-2">{row.label}</td>
                  <td className="border border-slate-200 p-2">方案規劃輸入</td>
                </tr>
              ))}
              {STAKEHOLDER_WORKFLOW_REFERENCES.forms.map((row) => (
                <tr key={row.code}>
                  <td className="border border-slate-200 p-2">表單</td>
                  <td className="border border-slate-200 p-2 font-medium">{row.code}</td>
                  <td className="border border-slate-200 p-2">{row.name}</td>
                  <td className="border border-slate-200 p-2">
                    {row.role}
                    {'storage' in row ? (
                      <span className="text-slate-500"> · {row.storage}</span>
                    ) : (
                      <>
                        {' · '}
                        <a className="font-medium text-blue-700 underline" href={buildAppHash(row.tab)}>
                          {tabLabel(row.tab)}
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}
