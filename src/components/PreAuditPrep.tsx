import type { AuditStore } from '../hooks/useAuditStore'
import type { ExternalAuditPrepItemState } from '../types'
import type { PrepScopeMode } from '../lib/externalAuditPrep'
import {
  EXTERNAL_AUDIT_PREP_SEED,
  countPrepProgress,
  evaluatePrepSequence,
  getPrepTemplate,
  isItemDone,
} from '../lib/externalAuditPrep'
import { Card } from './ui/Badge'
import { PrintDocHeader } from './ui/PrintDocHeader'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

function ScopeCells({
  mode,
  companyChecks,
  item,
  itemTitle,
  onUpdate,
}: {
  mode: PrepScopeMode
  companyChecks: boolean
  item: ExternalAuditPrepItemState
  itemTitle: string
  onUpdate: (patch: Partial<ExternalAuditPrepItemState>) => void
}) {
  if (mode === 'both_separate' || companyChecks) {
    return (
      <>
        <td data-label="九潤精密" className="border border-line p-2 text-center align-top">
          <label className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-1">
            <input
              type="checkbox"
              aria-label={`${itemTitle}：九潤精密科技完成狀態`}
              className={`no-print h-4 w-4 ${FOCUS_RING}`}
              checked={item.jiurunDone}
              onChange={(e) => onUpdate({ jiurunDone: e.target.checked })}
            />
            <span className="print-only text-xs">{item.jiurunDone ? '■' : '□'}</span>
          </label>
        </td>
        <td data-label="正隆興精密" className="border border-line p-2 text-center align-top">
          <label className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-1">
            <input
              type="checkbox"
              aria-label={`${itemTitle}：正隆興精密完成狀態`}
              className={`no-print h-4 w-4 ${FOCUS_RING}`}
              checked={item.zhenglongxingDone}
              onChange={(e) => onUpdate({ zhenglongxingDone: e.target.checked })}
            />
            <span className="print-only text-xs">{item.zhenglongxingDone ? '■' : '□'}</span>
          </label>
        </td>
      </>
    )
  }

  if (mode === 'merged') {
    return (
      <td data-label="公司範圍" colSpan={2} className="border p-2 text-center align-top">
        <label className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-1">
          <input
            type="checkbox"
            aria-label={`${itemTitle}：合併證據已完成`}
            className={`no-print h-5 w-5 ${FOCUS_RING}`}
            checked={item.mergedDone}
            onChange={(e) => onUpdate({ mergedDone: e.target.checked })}
          />
          <span className="print-only text-xs">{item.mergedDone ? '■' : '□'}</span>
          <span className="text-xs font-medium text-muted">合併</span>
        </label>
      </td>
    )
  }

  return (
    <td data-label="稽核廠區" colSpan={2} className="border border-line p-2 align-top">
      <label className="block text-xs font-medium text-muted no-print" htmlFor={`site-scope-${item.id}`}>
        填寫廠區／區域
      </label>
      <input
        id={`site-scope-${item.id}`}
        className={`mt-1 min-h-11 w-full rounded border border-line bg-surface px-2 py-1 text-sm text-ink no-print ${FOCUS_RING}`}
        aria-label={`${itemTitle}：填寫廠區／區域`}
        value={item.siteScope ?? ''}
        onChange={(e) => onUpdate({ siteScope: e.target.value })}
        placeholder="請填實際廠區或區域"
      />
      <span className="print-only text-xs">{item.siteScope?.trim() || '待填範圍'}</span>
    </td>
  )
}

function DoneCell({
  mode,
  companyChecks,
  item,
  itemTitle,
  done,
  onUpdate,
}: {
  mode: PrepScopeMode
  companyChecks: boolean
  item: ExternalAuditPrepItemState
  itemTitle: string
  done: boolean
  onUpdate: (patch: Partial<ExternalAuditPrepItemState>) => void
}) {
  if (mode === 'site_scope') {
    return (
      <td data-label="完成" className="border p-2 text-center align-top">
        <label className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-1">
          <input
            type="checkbox"
            aria-label={`${itemTitle}：完成狀態`}
            className={`no-print h-5 w-5 ${FOCUS_RING}`}
            checked={item.completed}
            onChange={(e) => onUpdate({ completed: e.target.checked })}
          />
          <span className="print-only text-xs">{item.completed ? '■' : '□'}</span>
          <span role="status" className="text-xs text-muted">{done ? '已完成' : item.completed ? '待填範圍' : '待確認'}</span>
        </label>
      </td>
    )
  }

  if (mode === 'merged' && companyChecks) {
    return (
      <td data-label="共用完成" className="border border-line p-2 text-center align-top">
        <label className="inline-flex min-h-11 flex-col items-center justify-center gap-1">
          <input
            type="checkbox"
            aria-label={`${itemTitle}：共用彙整已完成`}
            className={`no-print h-5 w-5 ${FOCUS_RING}`}
            checked={item.mergedDone}
            onChange={(e) => onUpdate({ mergedDone: e.target.checked })}
          />
          <span className="print-only text-xs">{item.mergedDone ? '■' : '□'}</span>
          <span role="status" className="text-xs text-muted">{done ? '已完成' : '待三項'}</span>
        </label>
      </td>
    )
  }

  return (
    <td data-label="完成" className="border p-2 text-center align-top">
      <span
        role="status"
        aria-label={`${itemTitle}：${done ? '已完成' : '未完成'}`}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }`}
        title={done ? '已完成' : '未完成'}
      >
        {done ? '✓' : '—'}
      </span>
    </td>
  )
}

export function PreAuditPrep({ store }: { store: AuditStore }) {
  const { state, updateExternalPrepItem } = store
  const { settings, externalAuditPrep, companies } = state
  const { done, total } = countPrepProgress(externalAuditPrep)
  const warnings = evaluatePrepSequence(externalAuditPrep, companies)
  const seed = EXTERNAL_AUDIT_PREP_SEED
  const internalItem = externalAuditPrep.items.find((item) => item.no === 2)
  const reviewItem = externalAuditPrep.items.find((item) => item.no === 4)
  const companySequence = [
    { label: '九潤精密', key: 'jiurunDone' },
    { label: '正隆興精密', key: 'zhenglongxingDone' },
  ] as const

  return (
    <div className="space-y-6 print-area qr-form">
      <Card>
        <div className="mb-4 grid gap-3 border-b border-line pb-4 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-start">
          <div>
            <h2 className="text-lg font-semibold text-ink">外部稽核準備</h2>
            <p className="mt-1 text-sm text-muted">雙公司共用清單；依各公司範圍確認。</p>
            <p className="mt-1 text-xs text-muted">來源：{seed.source}</p>
          </div>
          <div className="space-y-1 sm:pt-1">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">
              <span>完成度</span>
              <span>{done}/{total}</span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-page"
              role="progressbar"
              aria-valuenow={done}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuetext={`${done}/${total} 已完成`}
              aria-label="外部稽核準備完成度"
            >
              <div
                className="h-2 rounded-full bg-green-500 transition-all"
                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <p className="mb-2 text-sm font-semibold text-ink">稽核順序與日期</p>
        <p className="mb-2 text-xs text-muted">依第 2、4 項顯示</p>
        <div className="mb-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {companySequence.map(({ label, key }) => (
            <div key={key} className="border-b border-line py-2 last:border-b-0 sm:last:border-b">
              <strong className="text-ink">{label}</strong>
              <span className="ml-2 text-muted">內部稽核：{internalItem?.[key] ? '已確認' : '待確認'}</span>
              <span className="mx-1 text-muted">→</span>
              <span className="text-muted">管理審查：{reviewItem?.[key] ? '已確認' : '待確認'}</span>
            </div>
          ))}
        </div>
        <p className="mb-4 text-sm text-muted">外稽日期：{settings.externalAuditDate || '日期未設定'}</p>

        {/* 警告 */}
        {warnings.messages.length > 0 && (
          <div className="mb-3 space-y-2">
            {warnings.messages.map((msg) => (
              <div
                key={msg}
                className={`rounded border px-3 py-2 text-sm ${
                  warnings.sequenceMessages.includes(msg)
                    ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
                    : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'
                }`}
              >
                ⚠ {msg}
              </div>
            ))}
          </div>
        )}

        {/* 範圍圖例 */}
        <details open className="mb-4 border-t border-line pt-3">
          <summary className={`cursor-pointer list-none text-xs font-semibold text-muted ${FOCUS_RING}`}>
            範圍圖例
          </summary>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              <strong>◎◎</strong> 兩公司各自準備
            </span>
            <span>
              <strong>合併</strong> 共用證據
            </span>
            <span>
              <strong>合併＋◎◎</strong> 共用＋雙公司來源
            </span>
            <span>
              <strong>稽核廠區</strong> 填寫範圍後才可計入完成
            </span>
          </div>
        </details>

        <PrintDocHeader
          companyName={seed.companies.join(' / ')}
          auditYear={settings.auditYear}
          formTitle={seed.title}
        />

        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="外部稽核準備清單，可橫向捲動">
          <p className="table-scroll-hint mb-2 text-xs text-muted no-print">可橫向捲動</p>
          <table className="qr-checklist stacked-table w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border p-2 w-12">項次</th>
                <th className="border p-2">準備事項</th>
                <th className="border p-2 w-28">負責人</th>
                <th className="border p-2 w-20 text-center">九潤</th>
                <th className="border p-2 w-20 text-center">正隆興</th>
                <th className="border p-2 w-24 text-center">共用完成</th>
                <th className="border p-2 w-48">備註/表單</th>
              </tr>
            </thead>
            <tbody>
              {externalAuditPrep.items.length === 0 && (
                <tr><td colSpan={7} className="border border-line p-4 text-center text-muted">尚無準備項目。</td></tr>
              )}
              {externalAuditPrep.items.map((itemState) => {
                const template = getPrepTemplate(itemState.no)
                if (!template) return null
                const mode = template.scope.mode
                const done = isItemDone(template, itemState)
                const formsText = template.forms.length ? template.forms.join('、') : ''
                const remarkDisplay = [formsText, itemState.remark].filter(Boolean).join(' · ')

                return (
                  <tr key={itemState.id} className={done ? 'bg-green-50/30' : undefined}>
                    <td data-label="項次" className="border p-2 text-center align-top font-medium">{template.no}</td>
                    <td data-label="準備事項" className="border p-2 align-top">
                      <div className="font-medium">{template.title}</div>
                      {template.notes && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{template.notes}</p>
                      )}
                      {template.scope.companyChecks && (
                        <p className="mt-1 text-xs font-medium text-muted">共用＋雙公司來源</p>
                      )}
                    </td>
                    <td data-label="負責人" className="border p-2 align-top text-xs">{template.owner}</td>
                    <ScopeCells
                      mode={mode}
                      companyChecks={Boolean(template.scope.companyChecks)}
                      item={itemState}
                      itemTitle={`${template.no}. ${template.title}`}
                      onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                    />
                    <DoneCell
                      mode={mode}
                      companyChecks={Boolean(template.scope.companyChecks)}
                      item={itemState}
                      itemTitle={`${template.no}. ${template.title}`}
                      done={done}
                      onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                    />
                    <td data-label="備註／表單" className="border p-2 align-top">
                      {formsText && (
                        <p className="mb-1 text-xs text-slate-600 dark:text-slate-300">{formsText}</p>
                      )}
                      <input
                        className={`min-h-11 w-full rounded border border-line bg-surface px-2 py-1 text-sm text-ink no-print ${FOCUS_RING}`}
                        placeholder="備註"
                        aria-label={`${template.no}. ${template.title} 備註`}
                        value={itemState.remark}
                        onChange={(e) =>
                          updateExternalPrepItem(itemState.id, { remark: e.target.value })
                        }
                      />
                      <span className="print-only text-xs">{remarkDisplay}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs font-semibold text-muted">注意事項</p>
          <ul className="list-inside list-disc space-y-1 text-xs text-muted">
            {seed.otherNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  )
}
