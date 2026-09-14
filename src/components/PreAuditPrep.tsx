import type { AuditStore } from '../hooks/useAuditStore'
import type { CompanyId, ExternalAuditPrepItemState } from '../types'
import { COMPANY_LABELS } from '../types'
import type { PrepScopeMode } from '../lib/externalAuditPrep'
import { companyFocusLabel } from '../lib/externalAuditSchedule'
import { canEditExternalPrep, isReadOnlyRole } from '../lib/userRole'
import {
  EXTERNAL_AUDIT_PREP_SEED,
  computeInternalAuditComplete,
  countPrepProgress,
  evaluatePrepSequence,
  getEffectiveInternalAuditComplete,
  getInternalAuditCompleteOverride,
  getPrepTemplate,
  isItemDone,
  itemHasCallout,
} from '../lib/externalAuditPrep'
import { Button } from './ui/Badge'
import { Card } from './ui/Badge'
import { PrintDocHeader } from './ui/PrintDocHeader'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

const SCOPE_LABELS: Record<PrepScopeMode, string> = {
  both_separate: '◎◎',
  merged: '合併',
  site_scope: '稽核廠區範圍',
}

function CalloutBadge({ type }: { type: 'quality-objectives' | 'risk-climate' | 'satisfaction' }) {
  const config = {
    'quality-objectives': {
      className: 'border-blue-200 bg-blue-50 text-blue-900',
      text: '品質目標統計須至稽核前一個月；初次稽核至少 3 個月資料；未達成須有因應處置。',
    },
    'risk-climate': {
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      text: '氣候變遷須納入風險評估；當年改善措施評估結果隔年再填。',
    },
    satisfaction: {
      className: 'border-rose-200 bg-rose-50 text-rose-900',
      text: '正隆興須對主要客戶（九潤精密科技）做客戶滿意度調查；兩公司分開調查。',
    },
  }[type]

  return (
    <p className={`mt-2 rounded-md border px-2 py-1.5 text-xs font-medium ${config.className}`}>
      {config.text}
    </p>
  )
}

function ScopeCells({
  mode,
  item,
  onUpdate,
  disabled = false,
}: {
  mode: PrepScopeMode
  item: ExternalAuditPrepItemState
  onUpdate: (patch: Partial<ExternalAuditPrepItemState>) => void
  disabled?: boolean
}) {
  if (mode === 'both_separate') {
    return (
      <>
        <td className="border border-line p-2 text-center align-top">
          <label className="inline-flex flex-col items-center gap-1">
            <input
              type="checkbox"
              aria-label="九潤精密"
              className={`no-print h-4 w-4 ${FOCUS_RING}`}
              checked={item.jiurunDone}
              disabled={disabled}
              onChange={(e) => onUpdate({ jiurunDone: e.target.checked })}
            />
            <span className="print-only text-xs">{item.jiurunDone ? '■' : '□'}</span>
            <span className="text-xs text-muted no-print">九潤</span>
          </label>
        </td>
        <td className="border border-line p-2 text-center align-top">
          <label className="inline-flex flex-col items-center gap-1">
            <input
              type="checkbox"
              aria-label="正隆興精密"
              className={`no-print h-4 w-4 ${FOCUS_RING}`}
              checked={item.zhenglongxingDone}
              disabled={disabled}
              onChange={(e) => onUpdate({ zhenglongxingDone: e.target.checked })}
            />
            <span className="print-only text-xs">{item.zhenglongxingDone ? '■' : '□'}</span>
            <span className="text-xs text-muted no-print">正隆興</span>
          </label>
        </td>
      </>
    )
  }

  if (mode === 'merged') {
    return (
      <td colSpan={2} className="border p-2 text-center align-top">
        <label className="inline-flex flex-col items-center gap-1">
          <input
            type="checkbox"
            className="no-print h-4 w-4"
            checked={item.mergedDone}
            disabled={disabled}
            onChange={(e) => onUpdate({ mergedDone: e.target.checked })}
          />
          <span className="print-only text-xs">{item.mergedDone ? '■' : '□'}</span>
          <span className="text-xs font-medium text-slate-600">合併</span>
        </label>
      </td>
    )
  }

  return (
    <>
      <td colSpan={2} className="border p-2 text-center align-top">
        <span className="inline-block rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          稽核廠區範圍
        </span>
      </td>
    </>
  )
}

function DoneCell({
  mode,
  item,
  done,
  onUpdate,
  disabled = false,
}: {
  mode: PrepScopeMode
  item: ExternalAuditPrepItemState
  done: boolean
  onUpdate: (patch: Partial<ExternalAuditPrepItemState>) => void
  disabled?: boolean
}) {
  if (mode === 'site_scope') {
    return (
      <td className="border p-2 text-center align-top">
        <label className="inline-flex flex-col items-center gap-1">
          <input
            type="checkbox"
            className="no-print h-4 w-4"
            checked={item.completed}
            disabled={disabled}
            onChange={(e) => onUpdate({ completed: e.target.checked })}
          />
          <span className="print-only text-xs">{item.completed ? '■' : '□'}</span>
        </label>
      </td>
    )
  }

  return (
    <td className="border p-2 text-center align-top">
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-400'
        }`}
        title={done ? '已完成' : '未完成'}
      >
        {done ? '✓' : '—'}
      </span>
    </td>
  )
}

export function PreAuditPrep({ store }: { store: AuditStore }) {
  const {
    state,
    updateExternalPrepItem,
    updateExternalPrepSequence,
    resetInternalAuditCompleteOverride,
    updateExternalAuditSchedule,
    updateExternalScheduleEntry,
    addExternalScheduleEntry,
  } = store
  const { settings, externalAuditPrep, externalAuditSchedule, companies } = state
  const readOnly = isReadOnlyRole(settings.viewRole)
  const canEdit = canEditExternalPrep(settings.viewRole)
  const schedule = externalAuditSchedule
  const { done, total } = countPrepProgress(externalAuditPrep)
  const warnings = evaluatePrepSequence(externalAuditPrep, companies)
  const internalAuditSummary = computeInternalAuditComplete(companies)
  const effectiveInternalComplete = getEffectiveInternalAuditComplete(externalAuditPrep, companies)
  const internalAuditOverride = getInternalAuditCompleteOverride(externalAuditPrep)
  const seed = EXTERNAL_AUDIT_PREP_SEED

  return (
    <div className="space-y-6 print-area qr-form">
      {schedule && (
        <Card>
          <h2 className="mb-2 text-lg font-semibold text-ink">外稽當日行程／機種</h2>
          <p className="mb-4 text-sm text-muted">
            雙公司合併取證 — 供第三方稽核員當日參考；機種摘要依公司分開維護。
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(COMPANY_LABELS) as CompanyId[]).map((id) => (
              <label key={id} className="block text-sm">
                <span className="mb-1 block font-medium text-ink">{COMPANY_LABELS[id]} 重點機種</span>
                <input
                  className={`w-full rounded border border-line bg-surface px-3 py-2 text-sm no-print ${FOCUS_RING}`}
                  value={schedule.companyProductHighlights[id]}
                  disabled={readOnly || !canEdit}
                  onChange={(e) =>
                    updateExternalAuditSchedule({
                      companyProductHighlights: {
                        ...schedule.companyProductHighlights,
                        [id]: e.target.value,
                      },
                    })
                  }
                />
                <span className="print-only">{schedule.companyProductHighlights[id]}</span>
              </label>
            ))}
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-ink">外稽日期</span>
              <input
                type="date"
                className={`w-full max-w-xs rounded border border-line bg-surface px-3 py-2 text-sm no-print ${FOCUS_RING}`}
                value={schedule.auditDate}
                disabled={readOnly || !canEdit}
                onChange={(e) => updateExternalAuditSchedule({ auditDate: e.target.value })}
              />
              <span className="print-only">{schedule.auditDate}</span>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-page text-left text-muted">
                  <th className="border border-line p-2 w-24">時間</th>
                  <th className="border border-line p-2">活動</th>
                  <th className="border border-line p-2 w-28">地點</th>
                  <th className="border border-line p-2 w-36">機種／產品</th>
                  <th className="border border-line p-2 w-28">公司</th>
                  <th className="border border-line p-2 w-32">備註</th>
                </tr>
              </thead>
              <tbody>
                {schedule.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border border-line p-2 align-top">
                      <div className="flex gap-1 no-print">
                        <input
                          type="time"
                          className="w-full rounded border border-line px-1 py-1 text-xs"
                          value={entry.timeStart}
                          disabled={readOnly || !canEdit}
                          onChange={(e) =>
                            updateExternalScheduleEntry(entry.id, { timeStart: e.target.value })
                          }
                        />
                        <input
                          type="time"
                          className="w-full rounded border border-line px-1 py-1 text-xs"
                          value={entry.timeEnd}
                          disabled={readOnly || !canEdit}
                          onChange={(e) =>
                            updateExternalScheduleEntry(entry.id, { timeEnd: e.target.value })
                          }
                        />
                      </div>
                      <span className="print-only">
                        {entry.timeStart}–{entry.timeEnd}
                      </span>
                    </td>
                    <td className="border border-line p-2 align-top">
                      <input
                        className="w-full rounded border border-line px-2 py-1 text-sm no-print"
                        value={entry.activity}
                        disabled={readOnly || !canEdit}
                        onChange={(e) =>
                          updateExternalScheduleEntry(entry.id, { activity: e.target.value })
                        }
                      />
                      <span className="print-only">{entry.activity}</span>
                    </td>
                    <td className="border border-line p-2 align-top">
                      <input
                        className="w-full rounded border border-line px-2 py-1 text-sm no-print"
                        value={entry.location}
                        disabled={readOnly || !canEdit}
                        onChange={(e) =>
                          updateExternalScheduleEntry(entry.id, { location: e.target.value })
                        }
                      />
                      <span className="print-only">{entry.location}</span>
                    </td>
                    <td className="border border-line p-2 align-top">
                      <input
                        className="w-full rounded border border-line px-2 py-1 text-sm no-print"
                        value={entry.productModels}
                        disabled={readOnly || !canEdit}
                        onChange={(e) =>
                          updateExternalScheduleEntry(entry.id, { productModels: e.target.value })
                        }
                      />
                      <span className="print-only">{entry.productModels}</span>
                    </td>
                    <td className="border border-line p-2 align-top">
                      <select
                        className="w-full rounded border border-line px-1 py-1 text-xs no-print"
                        value={entry.companyFocus}
                        disabled={readOnly || !canEdit}
                        onChange={(e) =>
                          updateExternalScheduleEntry(entry.id, {
                            companyFocus: e.target.value as CompanyId | 'both',
                          })
                        }
                      >
                        <option value="both">雙公司</option>
                        <option value="jiurun">{COMPANY_LABELS.jiurun}</option>
                        <option value="zhenglongxing">{COMPANY_LABELS.zhenglongxing}</option>
                      </select>
                      <span className="print-only">{companyFocusLabel(entry.companyFocus)}</span>
                    </td>
                    <td className="border border-line p-2 align-top">
                      <input
                        className="w-full rounded border border-line px-2 py-1 text-xs no-print"
                        value={entry.remark}
                        disabled={readOnly || !canEdit}
                        onChange={(e) =>
                          updateExternalScheduleEntry(entry.id, { remark: e.target.value })
                        }
                      />
                      <span className="print-only">{entry.remark}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && !readOnly && (
            <Button variant="secondary" className="mt-3" onClick={() => addExternalScheduleEntry()}>
              新增行程列
            </Button>
          )}
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{seed.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {seed.companies.join(' | ')} · 雙公司合併取證（一張證書）
            </p>
            <p className="text-sm text-muted">
              外部稽核預定：{settings.externalAuditDate || '未設定'} · 完成 {done}/{total}
            </p>
            <p className="mt-1 text-xs text-muted">資料來源：{seed.source}</p>
          </div>
          <div
            className="h-3 w-32 rounded-full bg-page"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="外部稽核準備完成度"
          >
            <div
              className="h-3 rounded-full bg-green-500 transition-all"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <p className="mb-4 text-sm font-semibold text-ink">稽核序位（須依序完成）</p>
        <div className="mb-2 text-xs text-muted">
          內部稽核完成度（自動）：
          {internalAuditSummary.details.map((d) => (
            <span key={d.companyId} className="ml-2">
              {d.companyName} {d.completedCount}/{d.plannedCount}
            </span>
          ))}
          {internalAuditSummary.complete ? ' · 兩公司程序皆已足夠完成' : ' · 尚有未完成程序'}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
              <input
                type="checkbox"
                className={`h-4 w-4 ${FOCUS_RING}`}
                checked={effectiveInternalComplete}
                disabled={readOnly || !canEdit}
                onChange={(e) =>
                  updateExternalPrepSequence({
                    internalAuditCompleteOverride: e.target.checked,
                  })
                }
              />
              <span className="font-medium">1. 內部稽核完成</span>
              {internalAuditOverride === undefined && (
                <span className="text-xs text-muted">（自動）</span>
              )}
            </label>
            {internalAuditOverride !== undefined && canEdit && !readOnly && (
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => resetInternalAuditCompleteOverride()}
              >
                重設為自動判定
              </Button>
            )}
            <span className="text-muted">→</span>
            <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
              <input
                type="checkbox"
                className={`h-4 w-4 ${FOCUS_RING}`}
                checked={externalAuditPrep.managementReviewComplete}
                disabled={readOnly || !canEdit}
                onChange={(e) =>
                  updateExternalPrepSequence({ managementReviewComplete: e.target.checked })
                }
              />
              <span className="font-medium">2. 管理審查完成</span>
            </label>
            <span className="text-muted">→</span>
            <div className="rounded-md border border-line bg-surface px-3 py-2">
              <span className="font-medium text-ink">3. 外部稽核</span>
              <span className="ml-2 text-muted">
                {settings.externalAuditDate || '（日期未設定）'}
              </span>
            </div>
        </div>

        {/* 警告 */}
        {warnings.messages.length > 0 && (
          <div className="mb-4 space-y-2">
            {warnings.messages.map((msg) => (
              <div
                key={msg}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  warnings.sequenceWarning
                    ? 'border-red-300 bg-red-50 text-red-900'
                    : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}
              >
                ⚠ {msg}
              </div>
            ))}
          </div>
        )}

        {/* 範圍圖例 */}
        <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted">
          <span>
            <strong>◎◎</strong> 兩公司各自準備
          </span>
          <span>
            <strong>合併</strong> 共用證據
          </span>
          <span>
            <strong>稽核廠區範圍</strong> 依現場稽核範圍
          </span>
        </div>

        <PrintDocHeader
          companyName={seed.companies.join(' / ')}
          auditYear={settings.auditYear}
          formTitle={seed.title}
        />

        <div className="overflow-x-auto">
          <p className="mb-2 text-xs text-muted no-print">表格可左右滑動</p>
          <table className="qr-checklist w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-page text-left text-muted">
                <th className="border p-2 w-12">項次</th>
                <th className="border p-2">稽核前準備事項</th>
                <th className="border p-2 w-28">負責人</th>
                <th className="border p-2 w-20 text-center">九潤</th>
                <th className="border p-2 w-20 text-center">正隆興</th>
                <th className="border p-2 w-16 text-center">完成</th>
                <th className="border p-2 w-48">備註/表單</th>
              </tr>
            </thead>
            <tbody>
              {externalAuditPrep.items.map((itemState) => {
                const template = getPrepTemplate(itemState.no)
                if (!template) return null
                const mode = template.scope.mode
                const done = isItemDone(template, itemState)
                const callout = itemHasCallout(template.no)
                const formsText = template.forms.length ? template.forms.join('、') : ''
                const remarkDisplay = [formsText, itemState.remark].filter(Boolean).join(' · ')

                return (
                  <tr key={itemState.id} className={done ? 'bg-green-50/30' : undefined}>
                    <td className="border p-2 text-center align-top font-medium">{template.no}</td>
                    <td className="border p-2 align-top">
                      <div className="font-medium">{template.title}</div>
                      {template.notes && (
                        <p className="mt-1 text-xs text-slate-500">{template.notes}</p>
                      )}
                      {callout && <CalloutBadge type={callout} />}
                      <span className="mt-1 inline-block text-xs text-muted">
                        {SCOPE_LABELS[mode]}
                      </span>
                    </td>
                    <td className="border p-2 align-top text-xs">{template.owner}</td>
                    <ScopeCells
                      mode={mode}
                      item={itemState}
                      disabled={readOnly || !canEdit}
                      onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                    />
                    <DoneCell
                      mode={mode}
                      item={itemState}
                      done={done}
                      disabled={readOnly || !canEdit}
                      onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                    />
                    <td className="border p-2 align-top">
                      {formsText && (
                        <p className="mb-1 text-xs text-slate-600">{formsText}</p>
                      )}
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs no-print"
                        placeholder="備註"
                        value={itemState.remark}
                        disabled={readOnly || !canEdit}
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
          <p className="mb-2 text-xs font-semibold text-muted">稽核要點</p>
          <ul className="list-inside list-disc space-y-1 text-xs text-muted">
            {seed.sequenceRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs font-semibold text-muted">其他注意事項</p>
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
