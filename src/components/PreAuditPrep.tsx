import { Fragment } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { AuditedProduct, AuditedProductCompanyScope, ExternalAuditPrepItemState } from '../types'
import type { PrepScopeMode } from '../lib/externalAuditPrep'
import {
  EXTERNAL_AUDIT_PREP_SEED,
  HEADER_RULE_LABELS,
  countPrepProgress,
  describePrepBlockers,
  evaluatePrepSequence,
  getPrepTemplateById,
  isItemDone,
  itemHasCallout,
  listPrepGaps,
  prepItemLabel,
} from '../lib/externalAuditPrep'
import { Button, Card } from './ui/Badge'
import { PrintDocHeader } from './ui/PrintDocHeader'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

const SCOPE_LABELS: Record<PrepScopeMode, string> = {
  both_separate: '◎◎',
  merged: '合併',
  site_scope: '稽核廠區範圍',
}

const COMPANY_SCOPE_LABELS: Record<AuditedProductCompanyScope, string> = {
  jiurun: '九潤',
  zhenglongxing: '正隆興',
  both: '兩家',
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
}: {
  mode: PrepScopeMode
  item: ExternalAuditPrepItemState
  onUpdate: (patch: Partial<ExternalAuditPrepItemState>) => void
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
            onChange={(e) => onUpdate({ mergedDone: e.target.checked })}
          />
          <span className="print-only text-xs">{item.mergedDone ? '■' : '□'}</span>
          <span className="text-xs font-medium text-slate-600">合併（表頭兩家）</span>
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
}: {
  mode: PrepScopeMode
  item: ExternalAuditPrepItemState
  done: boolean
  onUpdate: (patch: Partial<ExternalAuditPrepItemState>) => void
}) {
  if (mode === 'site_scope') {
    return (
      <td className="border p-2 text-center align-top">
        <label className="inline-flex flex-col items-center gap-1">
          <input
            type="checkbox"
            className="no-print h-4 w-4"
            checked={item.completed}
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

function AuditedProductsSection({
  products,
  onChange,
}: {
  products: AuditedProduct[]
  onChange: (products: AuditedProduct[]) => void
}) {
  const addRow = () => {
    onChange([
      ...products,
      {
        id: `audited-product-${Date.now()}`,
        name: '',
        companyScope: 'both',
        note: '',
      },
    ])
  }

  const updateRow = (id: string, patch: Partial<AuditedProduct>) => {
    onChange(products.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const removeRow = (id: string) => {
    onChange(products.filter((p) => p.id !== id))
  }

  return (
    <div className="mt-6 border-t border-line pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">當日受稽產品／機種</p>
        <Button variant="secondary" className="no-print" onClick={addRow}>
          新增產品
        </Button>
      </div>
      {products.length === 0 ? (
        <p className="text-xs text-muted">尚未登錄；外部稽核日期已設定時會顯示警告。</p>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[1fr_120px_1fr_auto]"
            >
              <input
                className="rounded border border-slate-200 px-2 py-1 text-sm no-print"
                placeholder="產品／機種名稱"
                value={product.name}
                onChange={(e) => updateRow(product.id, { name: e.target.value })}
              />
              <select
                className="rounded border border-slate-200 px-2 py-1 text-sm no-print"
                value={product.companyScope}
                onChange={(e) =>
                  updateRow(product.id, {
                    companyScope: e.target.value as AuditedProductCompanyScope,
                  })
                }
              >
                {(Object.keys(COMPANY_SCOPE_LABELS) as AuditedProductCompanyScope[]).map((scope) => (
                  <option key={scope} value={scope}>
                    {COMPANY_SCOPE_LABELS[scope]}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-200 px-2 py-1 text-sm no-print"
                placeholder="備註（料號、製令等）"
                value={product.note ?? ''}
                onChange={(e) => updateRow(product.id, { note: e.target.value })}
              />
              <button
                type="button"
                className="text-xs text-red-600 no-print hover:underline"
                onClick={() => removeRow(product.id)}
              >
                刪除
              </button>
              <div className="print-only col-span-full text-xs">
                {product.name} · {COMPANY_SCOPE_LABELS[product.companyScope]}
                {product.note ? ` · ${product.note}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PreAuditPrep({ store }: { store: AuditStore }) {
  const { state, updateExternalPrepItem, updateExternalPrepSequence } = store
  const { settings, externalAuditPrep, company } = state
  const prepContext = { company, rules: settings.scoringRules }
  const { done, total } = countPrepProgress(
    externalAuditPrep,
    company,
    settings.auditYear,
    settings.scoringRules,
  )
  const warnings = evaluatePrepSequence(
    externalAuditPrep,
    company,
    settings,
    settings.scoringRules,
  )
  const seed = EXTERNAL_AUDIT_PREP_SEED
  const gaps = listPrepGaps(externalAuditPrep, prepContext)

  return (
    <div className="space-y-6 print-area qr-form">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{seed.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {seed.companies.join(' | ')} · 兩張證書 · 合併稽核行程 · 同一組執行人員
            </p>
            <p className="mt-1 text-xs text-muted">
              執行人員同一組；法人義務證據（◎◎）不可共用抬頭，合併項須表頭兩家並列。勾選後須對應 QP 兩家查檢完成才計入。
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
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
              warnings.internalAuditComplete
                ? 'border-green-300 bg-green-50'
                : 'border-amber-300 bg-amber-50'
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                warnings.internalAuditComplete
                  ? 'bg-green-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {warnings.internalAuditComplete ? '✓' : '!'}
            </span>
            <span className="font-medium">1. 內部稽核完成（系統判定）</span>
          </div>
          <span className="text-muted">→</span>
          <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
            <input
              type="checkbox"
              className={`h-4 w-4 ${FOCUS_RING}`}
              checked={externalAuditPrep.managementReviewComplete}
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

        <div className="mb-4 grid gap-2 sm:grid-cols-3 text-xs">
          <div className="rounded-md border border-blue-200 bg-blue-50/50 px-3 py-2 text-blue-900">
            <p className="font-semibold">◎◎ 法人證據</p>
            <p className="mt-0.5 text-blue-800">兩家都勾 · 兩份獨立抬頭</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800">
            <p className="font-semibold">合併 共用過程</p>
            <p className="mt-0.5">勾一次 · 一份，表頭九潤＋正隆興</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-amber-900">
            <p className="font-semibold">廠區 現場追溯</p>
            <p className="mt-0.5 text-amber-800">勾一次 · 製令／實物指到哪張證書</p>
          </div>
        </div>

        {(gaps.separateHalfDone.length > 0 ||
          gaps.separateOpen.length > 0 ||
          gaps.mergedOpen.length > 0 ||
          gaps.siteOpen.length > 0 ||
          gaps.qpBlocked.length > 0) && (
          <p className="mb-4 text-xs text-muted">
            缺口：分開項未齊 {gaps.separateOpen.length + gaps.separateHalfDone.length} · 合併未勾{' '}
            {gaps.mergedOpen.length} · 廠區未勾 {gaps.siteOpen.length} · QP 未達{' '}
            {gaps.qpBlocked.length}
            {gaps.separateHalfDone.length > 0 && (
              <span className="ml-2 font-medium text-amber-700">
                （{gaps.separateHalfDone.length} 項只勾一家）
              </span>
            )}
          </p>
        )}

        <AuditedProductsSection
          products={externalAuditPrep.auditedProducts ?? []}
          onChange={(auditedProducts) => updateExternalPrepSequence({ auditedProducts })}
        />

        <PrintDocHeader
          companyName={seed.companies.join(' / ')}
          auditYear={settings.auditYear}
          formTitle={seed.title}
        />

        <div className="mt-6 overflow-x-auto">
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
                const template = getPrepTemplateById(itemState.id)
                if (!template) return null
                const mode = template.scope.mode
                const done = isItemDone(template, itemState, prepContext)
                const blockers = describePrepBlockers(template, itemState, prepContext)
                const callout = itemHasCallout(template.no)
                const formsText = template.forms.length ? template.forms.join('、') : ''
                const remarkDisplay = [formsText, itemState.remark].filter(Boolean).join(' · ')
                const isHalfDone =
                  mode === 'both_separate' &&
                  ((itemState.jiurunDone && !itemState.zhenglongxingDone) ||
                    (!itemState.jiurunDone && itemState.zhenglongxingDone))
                const scopeCheckedButBlocked = blockers.length > 0
                const linkedLabel = template.linkedQp?.map((l) => l.qpCode).join('、')

                return (
                  <Fragment key={itemState.id}>
                    {template.groupTitle && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={7} className="border p-2 text-sm font-semibold text-ink">
                          項次 {template.no} · {template.groupTitle}
                        </td>
                      </tr>
                    )}
                    <tr
                      className={
                        done
                          ? 'bg-green-50/30'
                          : scopeCheckedButBlocked
                            ? 'bg-amber-50/60'
                            : isHalfDone
                              ? 'bg-amber-50/50'
                              : undefined
                      }
                    >
                      <td className="border p-2 text-center align-top font-medium">
                        {prepItemLabel(template)}
                      </td>
                      <td className="border p-2 align-top">
                        <div className="font-medium">{template.title}</div>
                        {template.notes && (
                          <p className="mt-1 text-xs text-slate-500">{template.notes}</p>
                        )}
                        {callout && <CalloutBadge type={callout} />}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-block text-xs text-muted">{SCOPE_LABELS[mode]}</span>
                          <span
                            className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700"
                            title={template.doneWhen}
                          >
                            {HEADER_RULE_LABELS[template.headerRule]}
                          </span>
                          {linkedLabel && (
                            <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-800">
                              連結 {linkedLabel}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{template.doneWhen}</p>
                        {isHalfDone && (
                          <p className="mt-1 text-xs font-medium text-amber-800">
                            只完成其中一家，另一張證書會漏準備
                          </p>
                        )}
                        {blockers.map((msg) => (
                          <p key={msg} className="mt-1 text-xs font-medium text-amber-800">
                            {msg}
                          </p>
                        ))}
                      </td>
                      <td className="border p-2 align-top text-xs">{template.owner}</td>
                      <ScopeCells
                        mode={mode}
                        item={itemState}
                        onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                      />
                      <DoneCell
                        mode={mode}
                        item={itemState}
                        done={done}
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
                          onChange={(e) =>
                            updateExternalPrepItem(itemState.id, { remark: e.target.value })
                          }
                        />
                        <span className="print-only text-xs">{remarkDisplay}</span>
                      </td>
                    </tr>
                  </Fragment>
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
