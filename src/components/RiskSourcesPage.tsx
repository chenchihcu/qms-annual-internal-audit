import { useMemo } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import { FOCUS_RING } from '../lib/focusRing'
import { buildAppHash } from '../lib/navigation'
import { computeLiveRiskScores } from '../lib/riskWorkingValues'
import { RiskSourceRegister } from './RiskSourceRegister'

/** 風險來源登錄頁：只做輸入（事件→程序關聯）；受影響程序的優先分即時顯示，評估與核准在方案風險頁。 */
export function RiskSourcesPage({ store }: { store: AuditStore }) {
  const { state } = store
  const liveScores = useMemo(
    () => computeLiveRiskScores({ workspace: state.workspace, yearArchives: state.yearArchives, settings: state.settings }),
    [state.workspace, state.yearArchives, state.settings],
  )
  return (
    <div className="space-y-4">
      <RiskSourceRegister store={store} liveScores={liveScores} />
      <p className="text-sm text-ink no-print">
        登錄完成後，到
        <a href={buildAppHash('risk')} className={`mx-1 text-link hover:underline ${FOCUS_RING}`}>方案風險</a>
        儲存、確認與核准。
      </p>
    </div>
  )
}
