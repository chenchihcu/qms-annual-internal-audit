import { useState } from 'react'
import type { AuditStore } from '../hooks/useAuditStore'
import type { CompanyRelationship, ExternalAuditPrepItemState, ExternalAuditPrepState } from '../types'
import { COMPANY_LABELS, relationshipCheckKey } from '../types'
import type { PrepScopeMode } from '../lib/externalAuditPrep'
import {
  EXTERNAL_AUDIT_PREP_SEED,
  countPrepProgress,
  getPrepTemplateForState,
  isItemDone,
  itemHasCallout,
  relationshipsForPrepItem,
} from '../lib/externalAuditPrep'
import { buildMergedCertificateCoverage } from '../lib/coverage'
import { exportPrepExcel } from '../lib/formExport'
import { buildAppHash, tabLabel } from '../lib/navigation'
import { ACTION_ICONS } from '../lib/uiIcons'
import { Button, Input } from './ui/Badge'
import { PageToolbar } from './ui/PageToolbar'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { ScrollRegion } from './ui/ScrollRegion'
import { PERSONNEL_ROLE_LABELS, personRoles } from '../lib/personnel'

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
  prepItemNo,
  itemTitle,
  onUpdate,
}: {
  mode: PrepScopeMode
  item: ExternalAuditPrepItemState
  prepItemNo: number
  itemTitle: string
  onUpdate: (patch: Partial<ExternalAuditPrepItemState>) => void
}) {
  if (mode === 'both_separate') {
    return (
      <>
        <td className="border p-2 text-center align-top">
          <label className="inline-flex flex-col items-center gap-1">
            <input
              type="checkbox"
              className="no-print h-4 w-4"
              checked={item.jiurunDone}
              aria-label={`第 ${prepItemNo} 項 ${itemTitle} · ${COMPANY_LABELS.jiurun} 已完成`}
              onChange={(e) => onUpdate({ jiurunDone: e.target.checked })}
            />
            <span className="print-only text-xs">{item.jiurunDone ? '■' : '□'}</span>
            <span className="text-xs text-slate-400 no-print" aria-hidden="true">◎</span>
          </label>
        </td>
        <td className="border p-2 text-center align-top">
          <label className="inline-flex flex-col items-center gap-1">
            <input
              type="checkbox"
              className="no-print h-4 w-4"
              checked={item.zhenglongxingDone}
              aria-label={`第 ${prepItemNo} 項 ${itemTitle} · ${COMPANY_LABELS.zhenglongxing} 已完成`}
              onChange={(e) => onUpdate({ zhenglongxingDone: e.target.checked })}
            />
            <span className="print-only text-xs">{item.zhenglongxingDone ? '■' : '□'}</span>
            <span className="text-xs text-slate-400 no-print" aria-hidden="true">◎</span>
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
            aria-label={`第 ${prepItemNo} 項 ${itemTitle} · 合併共用證據已完成`}
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
  prepItemNo,
  itemTitle,
  done,
  onUpdate,
}: {
  mode: PrepScopeMode
  item: ExternalAuditPrepItemState
  prepItemNo: number
  itemTitle: string
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
            aria-label={`第 ${prepItemNo} 項 ${itemTitle} · 依稽核廠區範圍已完成`}
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
        role="status"
        aria-label={`第 ${prepItemNo} 項 ${itemTitle} · ${done ? '已完成' : '未完成'}`}
        title={done ? '已完成' : '未完成'}
      >
        {done ? '✓' : '—'}
      </span>
    </td>
  )
}

function RelationshipChecks({
  prepItemNo,
  prep,
  relationships,
  onToggle,
}: {
  prepItemNo: number
  prep: ExternalAuditPrepState
  relationships: CompanyRelationship[]
  onToggle: (key: string, checked: boolean) => void
}) {
  const gates = relationshipsForPrepItem(prepItemNo, relationships)
  if (gates.length === 0) return null
  return (
    <div className="mt-2 space-y-1">
      {gates.map((gate) => {
        const key = relationshipCheckKey(gate.from, gate.to, gate.relation)
        return (
          <label key={gate.id} className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 no-print"
              checked={Boolean(prep.relationshipChecks[key])}
              onChange={(e) => onToggle(key, e.target.checked)}
            />
            <span>{gate.label}</span>
          </label>
        )
      })}
    </div>
  )
}

export function PreAuditPrep({ store }: { store: AuditStore }) {
  const {
    state,
    updateExternalPrepItem,
    updateExternalPrepSequence,
    updateExternalPrepRelationship,
    switchPrepYear,
  } = store
  const { settings, externalAuditPrep, companyRelationships } = state
  const { done, total } = countPrepProgress(externalAuditPrep, companyRelationships)
  const seed = EXTERNAL_AUDIT_PREP_SEED
  const externalTeam = state.people.filter((person) => personRoles(person, settings.auditYear, state.annualPersonnelAssignments).some((role) => role === 'third_party_lead_auditor' || role === 'third_party_auditor'))
  const escorts = state.people.filter((person) => state.annualPersonnelAssignments.some((item) => item.year === settings.auditYear && item.role === 'annual_escort' && item.personId === person.id))
  const [prepYearDraft, setPrepYearDraft] = useState<string | null>(null)
  const [pendingPrepYear, setPendingPrepYear] = useState<number | null>(null)
  const prepYearInput = prepYearDraft ?? String(externalAuditPrep.year)

  const handlePrepYearDraftChange = (value: string) => {
    setPrepYearDraft(value)
    const year = Number(value)
    if (!Number.isInteger(year) || value.length !== 4 || year < 2000 || year > 2200) return
    if (year === externalAuditPrep.year) {
      setPrepYearDraft(null)
      setPendingPrepYear(null)
      return
    }
    setPendingPrepYear(year)
  }

  const confirmPrepYearSwitch = () => {
    if (pendingPrepYear == null) return
    switchPrepYear(pendingPrepYear)
    setPendingPrepYear(null)
    setPrepYearDraft(null)
  }

  const cancelPrepYearSwitch = () => {
    setPendingPrepYear(null)
    setPrepYearDraft(null)
  }

  const activeCompany = state.companies[state.activeCompanyId]
  const mergedCoverage = buildMergedCertificateCoverage(
    activeCompany,
    settings.auditYear,
    settings.scoringRules,
  )
  const derivedInternalComplete = mergedCoverage.allInternalAuditComplete
  const internalGapCount = mergedCoverage.gaps.length + mergedCoverage.dualPendingItems.length
  const managementReviewDate = settings.managementReviewDate?.trim() ?? ''

  return (
    <div className="space-y-6 print-area qr-form">
      <details className="rounded-lg border border-slate-200 bg-white no-print">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">外部稽核團隊與陪稽安排</summary>
        <div className="border-t border-slate-100 px-4 pb-4">
        <div className="grid gap-4 sm:grid-cols-2 pt-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">第三方稽核團隊</h3>
            {externalTeam.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {externalTeam.map((person) => (
                  <li key={person.id}>
                    {person.name} · {personRoles(person, settings.auditYear, state.annualPersonnelAssignments).filter((role) => role.startsWith('third_party')).map((role) => PERSONNEL_ROLE_LABELS[role]).join('、')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-amber-800">尚未確認第三方團隊</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">受稽方陪同／協調人員</h3>
            {escorts.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {escorts.map((person) => <li key={person.id}>{person.name}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-amber-800">尚未安排本年度陪稽人員</p>
            )}
          </div>
        </div>
        {(externalTeam.length === 0 || escorts.length === 0) && (
          <p className="mt-3 text-sm text-amber-800">
            請至
            <a className="mx-1 font-medium text-blue-700 underline" href={buildAppHash('personnel')}>{tabLabel('personnel')}</a>
            確認團隊與陪稽安排
          </p>
        )}
        </div>
      </details>
      <div>
        <PageToolbar
          title="外稽準備"
          actions={(
            <>
              <Button variant="secondary" icon={ACTION_ICONS.exportExcel} onClick={() => exportPrepExcel(state)}>匯出 Excel</Button>
              <span className="text-sm text-muted">準備清單 {done}/{total}</span>
            </>
          )}
        />

        <div className="mb-4 grid gap-3 sm:grid-cols-2 no-print">
          <Input
            label="準備表年度"
            type="number"
            value={prepYearInput}
            onChange={(value) => handlePrepYearDraftChange(value)}
            ariaLabel="外稽準備表年度"
          />
          <Input
            label="外部稽核日期"
            type="date"
            value={externalAuditPrep.externalAuditDate ?? ''}
            onChange={(value) => updateExternalPrepSequence({ externalAuditDate: value })}
          />
        </div>

        {/* 序位橫幅 */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">稽核序位</p>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-slate-300 bg-white px-3 py-2">
              <span className="font-medium text-slate-700">1. 內部稽核完成</span>
              <p className="mt-1 text-xs text-slate-600">
                兩證覆蓋（唯讀）：
                {derivedInternalComplete
                  ? '計畫與查檢已覆蓋'
                  : `尚有 ${internalGapCount} 項缺口`}
                <a className="ml-1 font-medium text-blue-700 underline" href={buildAppHash('dashboard')}>
                  至稽核總覽
                </a>
              </p>
            </div>
            <div>
              <label className="flex items-start gap-2 rounded-md border border-slate-300 bg-white px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={externalAuditPrep.managementReviewComplete}
                  onChange={(e) =>
                    updateExternalPrepSequence({ managementReviewComplete: e.target.checked })
                  }
                />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-700">2. 管理審查完成</span>
                  <p className="mt-1 text-xs text-slate-600">
                    管審日期：
                    {managementReviewDate || '尚未填寫'}
                    <a className="ml-1 font-medium text-blue-700 underline" href={buildAppHash('plan')}>
                      至年度稽核計畫
                    </a>
                  </p>
                  {externalAuditPrep.managementReviewComplete && !managementReviewDate && (
                    <p className="mt-1 text-xs font-medium text-amber-800" role="status">
                      已勾選，但年度計畫尚未填管審日期
                    </p>
                  )}
                </div>
              </label>
            </div>
            <div className="rounded-md border border-slate-300 bg-white px-3 py-2">
              <span className="font-medium">3. 外部稽核</span>
            </div>
          </div>
        </div>

        {/* 範圍圖例 */}
        <p className="mb-4 text-xs text-slate-500 no-print">
          ◎◎ 兩公司各自準備 · 合併 共用證據 · 稽核廠區範圍 依現場
        </p>

        <PrintDocHeader
          companyName={seed.companies.join(' / ')}
          auditYear={externalAuditPrep.year}
          formTitle={seed.title}
          subtitle={seed.source}
        />

        <ScrollRegion ariaLabel="外部稽核前準備清單">
          <table className="qr-checklist w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
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
                const template = getPrepTemplateForState(itemState)
                if (!template) return null
                const mode = template.scope.mode
                const done = isItemDone(template, itemState, externalAuditPrep, companyRelationships)
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
                      <RelationshipChecks
                        prepItemNo={template.no}
                        prep={externalAuditPrep}
                        relationships={companyRelationships}
                        onToggle={updateExternalPrepRelationship}
                      />
                      <span className="mt-1 inline-block text-xs text-slate-400">
                        {SCOPE_LABELS[mode]}
                      </span>
                    </td>
                    <td className="border p-2 align-top text-xs">{template.owner}</td>
                    <ScopeCells
                      mode={mode}
                      item={itemState}
                      prepItemNo={template.no}
                      itemTitle={template.title}
                      onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                    />
                    <DoneCell
                      mode={mode}
                      item={itemState}
                      prepItemNo={template.no}
                      itemTitle={template.title}
                      done={done}
                      onUpdate={(patch) => updateExternalPrepItem(itemState.id, patch)}
                    />
                    <td className="border p-2 align-top">
                      {formsText && (
                        <p className="mb-1 text-xs text-slate-600">{formsText}</p>
                      )}
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs no-print"
                        aria-label={`第 ${template.no} 項備註／表單`}
                        placeholder="備註"
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
        </ScrollRegion>

        {/* 序位規則摘要 */}
        <details className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">稽核要點</summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
            {seed.sequenceRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>

        {/* 頁尾 otherNotes */}
        <details className="mt-4 border-t border-slate-200 pt-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">其他注意事項</summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
            {seed.otherNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      </div>
      {pendingPrepYear != null && (
        <ConfirmDialog
          open
          title={`切換外稽準備至 ${pendingPrepYear} 年？`}
          description={`外稽準備表為雙公司共用；切換後將載入 ${pendingPrepYear} 年準備進度，不會改動各公司年度台帳（目前台帳年度 ${settings.auditYear}）。`}
          confirmLabel="確認切換"
          onConfirm={confirmPrepYearSwitch}
          onCancel={cancelPrepYearSwitch}
        />
      )}
    </div>
  )
}
