import {
  ARRANGEMENT_IMPACT_RULES,
  OCCURRENCE_BAND_GUIDE,
  OS_BAND_LABELS,
  OS_BAND_ORDER,
  osBandToScale,
  SEVERITY_BAND_GUIDE,
  STAKEHOLDER_WEIGHTS,
} from '../../lib/planner'
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
      </div>
    </details>
  )
}
