import { buildAppHash } from '../../lib/navigation'
import type { FollowupRecordLinkResult } from '../../lib/followupRecordLink'

export function FollowupRecordLinkNotice({ result }: { result: FollowupRecordLinkResult }) {
  if (result.status === 'found' || !result.message) return null
  return (
    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
      {result.message}
      {result.settingsTab === 'system-settings' && (
        <>
          {' '}
          <a className="font-medium text-link underline" href={buildAppHash('system-settings')}>
            至系統設定
          </a>
          （回收區在「回收區」分頁）。
        </>
      )}
    </p>
  )
}
