import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import type { AuditStore } from '../hooks/useAuditStore'
import { useTablePagination } from '../hooks/useTablePagination'
import { FOCUS_RING } from '../lib/focusRing'
import { buildAppHash } from '../lib/navigation'
import { resolveLeadAuditorPersonId } from '../lib/personnel'
import { OVERRIDE_REASONS, UNAVAILABLE_REASONS, isReasonFilled } from '../lib/reasonOptions'
import {
  FACTOR_DEFINITIONS,
  RISK_FACTOR_KEYS,
  RISK_STATUS_LABELS,
  assessProcedurePriority,
  assessRiskRecord,
  effectiveRiskStatus,
  factorKind,
  factorNames,
  formatFactorLabel,
  riskConfirmBlockers,
} from '../lib/risk'
import { buildRiskDerivationPool, deriveRiskFactors, type DerivedFactor, type DerivedRiskFactors } from '../lib/riskDerivation'
import {
  buildWorkingValues,
  workingInput,
  workingUnavailable,
  type FactorText,
  type FactorValues,
} from '../lib/riskWorkingValues'
import { WORKSPACE_COMPANY_ID } from '../lib/singleWorkspaceMigration'
import type { PlanRow, ProcedureRiskFactorKey, ProcedureRiskOverride, ProcedureRiskRecord } from '../types'
import { Badge, Button } from './ui/Badge'
import { EmptyState } from './ui/EmptyState'
import { PrintDocHeader } from './ui/PrintDocHeader'
import { ReasonSelect } from './ui/ReasonSelect'
import { ScrollRegion } from './ui/ScrollRegion'
import { TablePagination } from './ui/TablePagination'

/** 欄位標題用短名；完整名稱與定義在標題提示與「因素定義」說明。 */
const FACTOR_SHORT: Record<ProcedureRiskFactorKey, string> = {
  inherentRisk: '固有',
  previousInternalNcrCount: '內稽NCR',
  previousThirdPartyNcrCount: '第三方NCR',
  overdueOpenNcrCount: '未結NCR',
  customerComplaintLevel: '客訴',
  changeImpact: '重大變更',
  monthsSinceLastAudit: '距上次稽核',
}

/** 欄位預設來源（表頭第二行）；格內只標例外（人工、與系統不同、待確認）。 */
const FACTOR_ORIGIN: Record<ProcedureRiskFactorKey, string> = {
  inherentRisk: '系統',
  previousInternalNcrCount: '系統',
  previousThirdPartyNcrCount: '系統',
  overdueOpenNcrCount: '系統',
  customerComplaintLevel: '登錄',
  changeImpact: '登錄',
  monthsSinceLastAudit: '系統',
}

/** 這些因素的「已全部登錄」盤點在風險來源登錄頁設定。 */
const COVERAGE_FACTORS: ProcedureRiskFactorKey[] = ['previousThirdPartyNcrCount', 'customerComplaintLevel', 'changeImpact']

type SortMode = 'attention' | 'plan'

/** 待處理優先：未評估／舊紀錄 → 草稿 → 已確認 → 已核准；同級維持計畫順序。 */
const STATUS_RANK: Record<string, number> = { none: 0, legacy: 0, stale: 0, draft: 1, confirmed: 2, approved: 3 }

/**
 * 每列的工作值：有系統來源的因子自動帶入（不在 manual 內）；
 * 人工改值的因子列在 manual，須選理由。
 */
type RowDraft = {
  values: FactorValues
  manual: ProcedureRiskFactorKey[]
  /** 有鍵即表示勾選「未取得」，值為理由。 */
  unavailable: FactorText
  reasons: FactorText
  evidenceReference: string
}

function rowKey(row: Pick<PlanRow, 'qpCode' | 'departmentId'>): string {
  return `${row.qpCode}|${row.departmentId}`
}

function savedRecord(records: ProcedureRiskRecord[] | undefined, row: PlanRow): ProcedureRiskRecord | undefined {
  return records?.find((item) => item.qpCode === row.qpCode && item.departmentId === row.departmentId)
}

function buildDraft(saved: ProcedureRiskRecord | undefined, derived: DerivedRiskFactors): RowDraft {
  return { ...buildWorkingValues(saved, derived), reasons: {}, evidenceReference: saved?.evidenceReference ?? '' }
}

/** 與已存內容比較用（不含理由暫存）。 */
type FactorSources = Partial<Record<ProcedureRiskFactorKey, string[]>>

function isManualDraft(draft: RowDraft, derived: DerivedRiskFactors, key: ProcedureRiskFactorKey): boolean {
  const value = draft.values[key]
  return draft.manual.includes(key) && value != null && value !== derived[key].suggested
}

/** 自動帶入因子的來源紀錄 ID；存檔與未存判斷共用，來源增減（即使分級不變）也會標示未存。 */
function draftSources(draft: RowDraft, derived: DerivedRiskFactors): FactorSources {
  const sources: FactorSources = {}
  for (const key of RISK_FACTOR_KEYS) {
    if (isManualDraft(draft, derived, key) || draft.values[key] == null || derived[key].sources.length === 0) continue
    sources[key] = derived[key].sources.map((source) => source.id)
  }
  return sources
}

function normalizedSources(sources: FactorSources | undefined): FactorSources {
  const result: FactorSources = {}
  for (const key of RISK_FACTOR_KEYS) {
    const ids = sources?.[key]
    if (ids && ids.length > 0) result[key] = [...ids].sort()
  }
  return result
}

function storedSignature(saved: ProcedureRiskRecord): string {
  const values: FactorValues = {}
  for (const key of RISK_FACTOR_KEYS) if (saved[key] != null) values[key] = saved[key]
  return JSON.stringify({
    values,
    unavailable: saved.unavailableFactors ?? {},
    sources: normalizedSources(saved.factorSources),
    evidence: saved.evidenceReference ?? '',
  })
}

function draftSignature(draft: RowDraft, derived: DerivedRiskFactors): string {
  const values: FactorValues = {}
  for (const key of RISK_FACTOR_KEYS) if (draft.values[key] != null) values[key] = draft.values[key]
  const unavailable: FactorText = {}
  for (const key of RISK_FACTOR_KEYS) if (draft.values[key] == null && key in draft.unavailable) unavailable[key] = draft.unavailable[key] ?? ''
  return JSON.stringify({
    values,
    unavailable,
    sources: normalizedSources(draftSources(draft, derived)),
    evidence: draft.evidenceReference.trim(),
  })
}

/** 人工值與系統值不同（或系統無值）且為本次新改 → 須選理由。 */
function reasonRequired(
  key: ProcedureRiskFactorKey,
  draft: RowDraft,
  saved: ProcedureRiskRecord | undefined,
  derived: DerivedRiskFactors,
): boolean {
  const value = draft.values[key]
  if (value == null || !draft.manual.includes(key)) return false
  if (value === derived[key].suggested) return false
  return value !== saved?.[key] || !saved?.overrides?.some((override) => override.factor === key && override.value === value)
}

interface SavePlan {
  patch: Partial<ProcedureRiskRecord>
  overrides: ProcedureRiskOverride[]
}

function buildSavePlan(
  draft: RowDraft,
  saved: ProcedureRiskRecord | undefined,
  derived: DerivedRiskFactors,
): { ok: true; plan: SavePlan } | { ok: false; error: string } {
  const now = new Date().toISOString()
  if (draft.values.inherentRisk == null) return { ok: false, error: '固有風險須選擇。' }
  const patch: Partial<ProcedureRiskRecord> = { evidenceReference: draft.evidenceReference.trim(), inherentRisk: draft.values.inherentRisk }
  const overrides: ProcedureRiskOverride[] = []
  const unavailableFactors: FactorText = {}
  const manualFactors: ProcedureRiskFactorKey[] = []

  for (const key of RISK_FACTOR_KEYS) {
    const value = draft.values[key]
    if (key !== 'inherentRisk') patch[key] = value
    if (value == null && key in draft.unavailable) {
      if (!isReasonFilled(draft.unavailable[key])) return { ok: false, error: `${factorNames[key]}勾選未取得時須選理由。` }
      unavailableFactors[key] = draft.unavailable[key]!.trim()
    }
    if (isManualDraft(draft, derived, key)) manualFactors.push(key)
    if (reasonRequired(key, draft, saved, derived)) {
      if (!isReasonFilled(draft.reasons[key])) return { ok: false, error: `${factorNames[key]}為人工值，須選調整理由。` }
      overrides.push({ factor: key, suggested: derived[key].suggested, value: value!, reason: draft.reasons[key]!.trim(), at: now })
    }
  }
  patch.unavailableFactors = unavailableFactors
  patch.factorSources = draftSources(draft, derived)
  patch.manualFactors = manualFactors
  return { ok: true, plan: { patch, overrides } }
}

function sourceHref(kind: 'ncr' | 'audit' | 'event', id: string, row: PlanRow): string | null {
  if (kind === 'event') return null
  return kind === 'ncr' ? buildAppHash('ncr', { recordId: id }) : buildAppHash('audit', { auditKey: rowKey(row) })
}

function savedThisYearStatus(status: string): boolean {
  return status !== 'none' && status !== 'legacy' && status !== 'stale'
}

function factorValueOptions(key: ProcedureRiskFactorKey): number[] {
  return factorKind(key) === 'inherent' ? [1, 3, 5] : [1, 2, 3, 4, 5]
}

/** 格內第二行：值的來源（自動／人工／待確認），不只靠顏色表達。 */
function cellMarker(draft: RowDraft, info: DerivedFactor, key: ProcedureRiskFactorKey) {
  const value = draft.values[key]
  if (value == null) {
    if (key in draft.unavailable) return { text: '未取得', tone: 'text-muted' }
    return { text: '待確認', tone: 'text-tone-warning-fg' }
  }
  if (!draft.manual.includes(key) || value === info.suggested) {
    return { text: info.sources.length > 0 ? `自動・${info.sources.length}筆` : '自動', tone: 'text-muted' }
  }
  if (info.suggested == null) return { text: '人工', tone: 'text-tone-warning-fg' }
  return { text: `人工（系統 ${formatFactorLabel(key, info.suggested)}）`, tone: 'text-tone-warning-fg' }
}

/** 格內可見的例外標記；與欄位預設來源相同時不顯示。 */
function cellException(draft: RowDraft, info: DerivedFactor, key: ProcedureRiskFactorKey): string | null {
  const value = draft.values[key]
  if (value == null || !draft.manual.includes(key) || value === info.suggested) return null
  return info.suggested == null ? '✎ 人工' : `✎ 系統 ${formatFactorLabel(key, info.suggested)}`
}

/** 分級 4–5 加淡底色（同格仍有文字值，不只靠顏色）。 */
function gradeTint(value: number | undefined): string {
  if (value == null) return ''
  if (value >= 5) return 'bg-tone-danger-bg/60'
  if (value >= 4) return 'bg-tone-warning-bg/60'
  return ''
}

function orderKeys(mode: SortMode, rows: PlanRow[], records: ProcedureRiskRecord[] | undefined, auditYear: number): string[] {
  const keyed = rows.map((row, index) => ({
    key: rowKey(row),
    index,
    rank: STATUS_RANK[effectiveRiskStatus(savedRecord(records, row), auditYear)] ?? 0,
  }))
  if (mode === 'attention') keyed.sort((a, b) => a.rank - b.rank || a.index - b.index)
  return keyed.map((item) => item.key)
}

interface EditorTarget {
  row: PlanRow
  factor: ProcedureRiskFactorKey
  anchor: HTMLButtonElement
}

function FactorCellEditor({
  target,
  draft,
  info,
  needReason,
  onSetValue,
  onUseSystem,
  onToggleUnavailable,
  onReason,
  onClose,
}: {
  target: EditorTarget
  draft: RowDraft
  info: DerivedFactor
  needReason: boolean
  onSetValue: (value: number | undefined) => void
  onUseSystem: () => void
  onToggleUnavailable: (checked: boolean) => void
  onReason: (field: 'unavailable' | 'reasons', text: string) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { factor, row, anchor } = target
  const value = draft.values[factor]
  const manual = draft.manual.includes(factor) && value !== info.suggested
  const unavailableChecked = value == null && factor in draft.unavailable
  const definition = FACTOR_DEFINITIONS[factor]

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const node = event.target
      if (!(node instanceof Node)) return
      if (panelRef.current?.contains(node) || anchor.contains(node)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"], button')?.focus()
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  const rect = anchor.getBoundingClientRect()
  const width = Math.min(352, window.innerWidth - 16)
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
  const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 420))

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${row.qpCode} ${row.department} ${factorNames[factor]}`}
      className="fixed z-40 max-h-[calc(100vh-1rem)] space-y-3 overflow-y-auto rounded-lg border border-line bg-surface p-3 text-sm shadow-lg"
      style={{ top, left, width }}
    >
      <div>
        <p className="font-bold text-ink">{row.qpCode} {row.department}・{factorNames[factor]}</p>
        <p className="text-xs text-muted">{definition.definition}；{definition.scale}</p>
      </div>

      <div className="space-y-1 rounded border border-line p-2 text-xs">
        <p className="text-ink">
          系統值：{info.suggested != null ? formatFactorLabel(factor, info.suggested) : '無（待確認）'}
          {info.count != null && info.suggested != null ? `（${info.count}）` : ''}
        </p>
        <p className="text-muted">{info.note}</p>
        {info.sources.length > 0 && (
          <p className="text-muted">
            來源：
            {info.sources.map((source, index) => {
              const href = sourceHref(source.kind, source.id, row)
              return (
                <Fragment key={source.id}>
                  {index > 0 && '、'}
                  {href ? <a className={`text-link hover:underline ${FOCUS_RING}`} href={href}>{source.label}</a> : <span className="text-ink">{source.label}</span>}
                </Fragment>
              )
            })}
          </p>
        )}
        {manual && info.suggested != null && (
          <Button variant="secondary" className="min-h-9 px-3 py-1" onClick={onUseSystem}>改回系統值</Button>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs text-muted">人工改值（須選理由）</p>
        <div role="radiogroup" aria-label={`${factorNames[factor]}值`} className="flex flex-wrap gap-1">
          {factorValueOptions(factor).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              className={`min-h-9 rounded border px-2 text-xs ${value === option ? 'border-primary bg-row-selected font-bold text-ink' : 'border-line text-ink hover:bg-page'} ${FOCUS_RING}`}
              onClick={() => onSetValue(option)}
            >
              {formatFactorLabel(factor, option)}
            </button>
          ))}
          {factor !== 'inherentRisk' && value != null && info.suggested == null && (
            <button type="button" className={`min-h-9 rounded px-2 text-xs text-muted hover:bg-page ${FOCUS_RING}`} onClick={() => onSetValue(undefined)}>
              清除
            </button>
          )}
        </div>
      </div>

      {needReason && (
        <ReasonSelect label="調整理由" required options={OVERRIDE_REASONS} value={draft.reasons[factor]} onChange={(text) => onReason('reasons', text)} />
      )}
      {factor !== 'inherentRisk' && value == null && info.suggested == null && (
        <label className="flex min-h-9 items-center gap-2 text-xs">
          <input type="checkbox" className={FOCUS_RING} checked={unavailableChecked} onChange={(event) => onToggleUnavailable(event.target.checked)} />
          未取得（以 3 保守計分）
        </label>
      )}
      {unavailableChecked && (
        <ReasonSelect label="未取得理由" required options={UNAVAILABLE_REASONS} value={draft.unavailable[factor]} onChange={(text) => onReason('unavailable', text)} />
      )}
      <div className="flex justify-end">
        <Button variant="secondary" className="min-h-9 px-3 py-1" onClick={onClose}>完成</Button>
      </div>
    </div>,
    document.body,
  )
}

export function RiskAssessment({ store }: { store: AuditStore }) {
  const { state, saveProcedureRisk, confirmProcedureRisks, approveProcedureRisks } = store
  const { company, settings } = state
  const auditYear = settings.auditYear
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({})
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)

  const rows = company.planRows
  /** 排序在切換或計畫列增減時才重算，編輯或存檔中列不跳動。 */
  const rowsSignature = `${auditYear}|${rows.map(rowKey).join(',')}`
  const [order, setOrder] = useState(() => ({
    signature: rowsSignature,
    mode: 'attention' as SortMode,
    keys: orderKeys('attention', rows, company.procedureRisks, auditYear),
  }))
  if (order.signature !== rowsSignature) {
    setOrder({ signature: rowsSignature, mode: order.mode, keys: orderKeys(order.mode, rows, company.procedureRisks, auditYear) })
  }
  const applySort = (mode: SortMode) =>
    setOrder({ signature: rowsSignature, mode, keys: orderKeys(mode, rows, company.procedureRisks, auditYear) })
  /** 列印 QR-02-01 一律用年度計畫順序，不受畫面排序影響。 */
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true))
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])
  const pool = useMemo(
    () => buildRiskDerivationPool({ workspace: state.workspace, yearArchives: state.yearArchives, settings }),
    [state.workspace, state.yearArchives, settings],
  )
  const derivedByKey = useMemo(() => {
    const map = new Map<string, DerivedRiskFactors>()
    for (const row of rows) {
      map.set(rowKey(row), deriveRiskFactors(pool, row.qpCode, row.departmentId, { seedFallback: row.riskLevel }))
    }
    return map
  }, [pool, rows])

  const leadAuditorName = useMemo(() => {
    const personId = resolveLeadAuditorPersonId(
      state.people,
      WORKSPACE_COMPANY_ID,
      auditYear,
      state.annualPersonnelAssignments,
      settings.planWindowEnd || `${auditYear}-12-31`,
    )
    return state.people.find((person) => person.id === personId)?.name ?? null
  }, [state.people, state.annualPersonnelAssignments, auditYear, settings.planWindowEnd])

  const derivedFor = (row: PlanRow) => derivedByKey.get(rowKey(row))!
  const getDraft = (row: PlanRow): RowDraft =>
    drafts[rowKey(row)] ?? buildDraft(savedRecord(company.procedureRisks, row), derivedFor(row))

  const updateDraft = (row: PlanRow, update: (draft: RowDraft) => RowDraft) => {
    const key = rowKey(row)
    setDrafts((prev) => ({
      ...prev,
      [key]: update(prev[key] ?? buildDraft(savedRecord(company.procedureRisks, row), derivedFor(row))),
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** 人工改值；與系統值相同時自動回到「自動」。 */
  const setManualValue = (row: PlanRow, key: ProcedureRiskFactorKey, value: number | undefined) => {
    const suggested = derivedFor(row)[key].suggested
    updateDraft(row, (draft) => {
      const unavailable = { ...draft.unavailable }
      if (value != null) delete unavailable[key]
      const manual = draft.manual.filter((item) => item !== key)
      if (value != null && value !== suggested) manual.push(key)
      return { ...draft, values: { ...draft.values, [key]: value }, manual, unavailable }
    })
  }

  const flashSaved = (key: string) => {
    setSavedFlash((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => {
      setSavedFlash((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 2000)
  }

  /** 存一列；回傳錯誤訊息（null 表示已存）。 */
  const persistRow = (row: PlanRow): string | null => {
    const key = rowKey(row)
    const result = buildSavePlan(getDraft(row), savedRecord(company.procedureRisks, row), derivedFor(row))
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [key]: result.error }))
      return result.error
    }
    saveProcedureRisk(row.qpCode, row.departmentId, result.plan.patch, result.plan.overrides)
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    flashSaved(key)
    return null
  }

  const closeEditor = useCallback(() => {
    setEditor((current) => {
      current?.anchor.focus()
      return null
    })
  }, [])

  const rowStates = rows.map((row) => {
    const saved = savedRecord(company.procedureRisks, row)
    const status = effectiveRiskStatus(saved, auditYear)
    const draft = getDraft(row)
    const savedThisYear = savedThisYearStatus(status)
    /** 已存列：工作值（含自動帶入的新來源）與已存值不同即待存檔。 */
    const dirty = savedThisYear ? draftSignature(draft, derivedFor(row)) !== storedSignature(saved!) : false
    /** 列印只呈現已存（本年度）的值，避免未存或未核准的畫面值被印成正式結果。 */
    const printed = savedThisYear ? assessRiskRecord(saved!) : null
    const blockers = saved ? riskConfirmBlockers(saved) : []
    const assessment = assessProcedurePriority(workingInput(draft.values), workingUnavailable(draft))
    return { row, saved, status, draft, dirty, savedThisYear, blockers, assessment, printed }
  })
  const statesByKey = new Map(rowStates.map((item) => [rowKey(item.row), item]))
  const displayStates = (printing ? rows.map(rowKey) : order.keys).flatMap((key) => statesByKey.get(key) ?? [])
  /** 缺資料摘要：每個因素的待確認列數與人工（無系統值）列數，附系統判定原因。 */
  const factorGaps = RISK_FACTOR_KEYS.flatMap((factor) => {
    let pending = 0
    let manualOnly = 0
    const notes = new Map<string, number>()
    for (const { row, draft } of rowStates) {
      const info = derivedFor(row)[factor]
      const value = draft.values[factor]
      const isPending = value == null && !(factor in draft.unavailable)
      const isManualOnly = value != null && info.suggested == null && draft.manual.includes(factor)
      if (!isPending && !isManualOnly) continue
      if (isPending) pending += 1
      else manualOnly += 1
      notes.set(info.note, (notes.get(info.note) ?? 0) + 1)
    }
    if (pending === 0 && manualOnly === 0) return []
    const note = [...notes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    return [{ factor, pending, manualOnly, note }]
  })
  const pendingRows = rowStates.filter((item) => !item.savedThisYear || item.dirty)
  const confirmable = rowStates.filter((item) => item.status === 'draft' && !item.dirty && item.blockers.length === 0)
  const confirmedCount = rowStates.filter((item) => item.status === 'confirmed').length
  const approvedCount = rowStates.filter((item) => item.status === 'approved').length
  const allApproved = rows.length > 0 && approvedCount === rows.length

  const saveAll = () => {
    const failed = pendingRows.filter(({ row }) => persistRow(row) != null)
    const saved = pendingRows.length - failed.length
    setBulkMessage(failed.length > 0
      ? `已存 ${saved} 列；${failed.length} 列未存，請看該列的錯誤說明。`
      : `已存 ${saved} 列。`)
  }

  const pagination = useTablePagination(rows.length)
  const editorState = editor ? rowStates.find((item) => rowKey(item.row) === rowKey(editor.row)) : undefined

  return (
    <div className="space-y-6 print-area">
      <PrintDocHeader companyName={company.name} auditYear={auditYear} formTitle="程序風險評估 QR-02-01" />

      <div className="space-y-3 no-print">
        <p className="text-sm text-ink">
          各因素自動統計；客訴與重大變更請先到
          <a href={buildAppHash('risk-sources')} className={`mx-1 text-link hover:underline ${FOCUS_RING}`}>風險來源登錄</a>
          點選關聯程序。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm text-ink" role="status">
            {auditYear} 年度：已核准 {approvedCount}・已確認 {confirmedCount}・未完成 {rows.length - approvedCount - confirmedCount}
          </p>
          <Button variant="secondary" disabled={pendingRows.length === 0} onClick={saveAll}>
            儲存全部（{pendingRows.length}）
          </Button>
          <Button
            variant="secondary"
            disabled={confirmable.length === 0}
            onClick={() => confirmProcedureRisks(confirmable.map((item) => item.row))}
          >
            確認可確認列（{confirmable.length}）
          </Button>
          <Button
            disabled={confirmedCount === 0 || !leadAuditorName}
            title={!leadAuditorName ? '主任稽核員任命完成後才可核准' : undefined}
            onClick={() => leadAuditorName && approveProcedureRisks(leadAuditorName)}
          >
            核准已確認列（{confirmedCount}）
          </Button>
          {allApproved && (
            <a href={buildAppHash('plan')} className={`text-sm text-link hover:underline ${FOCUS_RING}`}>前往年度計畫預覽編排</a>
          )}
        </div>
        {bulkMessage && <p className="text-sm text-ink" role="status">{bulkMessage}</p>}

        <details className="text-xs">
          <summary className={`cursor-pointer text-sm text-tone-info-fg ${FOCUS_RING}`}>因素定義與計分規則</summary>
          <ScrollRegion ariaLabel="因素定義">
            <table className="worksheet-table mt-2 min-w-[40rem]">
              <colgroup>
                <col className="col-name" />
                <col />
                <col />
                <col className="col-date" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>因素</th>
                  <th>定義</th>
                  <th>資料來源</th>
                  <th>期間</th>
                  <th>分級</th>
                </tr>
              </thead>
              <tbody>
                {RISK_FACTOR_KEYS.map((key) => (
                  <tr key={key}>
                    <td>{factorNames[key]}</td>
                    <td className="break-words">{FACTOR_DEFINITIONS[key].definition}</td>
                    <td className="break-words">{FACTOR_DEFINITIONS[key].source}</td>
                    <td>{FACTOR_DEFINITIONS[key].period}</td>
                    <td className="break-words">{FACTOR_DEFINITIONS[key].scale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
          <p className="mt-2 text-muted">
            優先分＝Σ（分級÷5×權重）。有系統來源的因素自動帶入；待確認＝資料不足，不給等級也不參與編排；未取得以 3 保守計分；等級 ≥70 高、≥40 中，固有風險高者至少為中（公司自訂規則）。評估期間：{auditYear - 1} 年度封存＋本年度。
          </p>
        </details>
      </div>

      {pendingRows.length > 0 && (
        <p className="rounded-lg border border-tone-warning-line bg-row-warning px-3 py-2 text-sm text-tone-warning-fg no-print" role="status">
          尚有 {pendingRows.length} 列的自動統計或修改未存檔；PDCA 就緒與自動編排只計本年度已確認列。
        </p>
      )}

      <div className="flex flex-wrap items-start gap-3 no-print">
        {factorGaps.length > 0 ? (
          <div className="min-w-[min(100%,20rem)] flex-1 rounded-lg border border-line px-3 py-2 text-sm" role="status" aria-label="缺資料摘要">
            <p className="font-bold text-ink">缺資料摘要</p>
            <ul className="mt-1 space-y-1">
              {factorGaps.map(({ factor, pending, manualOnly, note }) => (
                <li key={factor} className="break-words text-ink">
                  <span className="font-bold">{FACTOR_SHORT[factor]}</span>
                  {pending > 0 && <span className="ml-2 text-tone-warning-fg">待確認 {pending} 列</span>}
                  {manualOnly > 0 && <span className="ml-2 text-tone-warning-fg">人工 {manualOnly} 列</span>}
                  <span className="ml-2 text-xs text-muted">{note}</span>
                  {COVERAGE_FACTORS.includes(factor) && (
                    <a href={buildAppHash('risk-sources')} className={`ml-2 text-xs text-link hover:underline ${FOCUS_RING}`}>
                      前往風險來源登錄
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="列排序">
          <span className="text-sm text-muted">排序</span>
          {([['attention', '待處理優先'], ['plan', '計畫順序']] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={order.mode === mode}
              className={`min-h-11 rounded-lg border px-3 text-sm ${FOCUS_RING} ${order.mode === mode
                ? 'border-primary bg-tone-info-bg font-bold text-tone-info-fg'
                : 'border-line bg-surface text-ink hover:bg-page'}`}
              onClick={() => applySort(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {rows.length === 0 ? (
          <EmptyState message="尚無年度計畫列。" />
        ) : (
          <ScrollRegion ariaLabel="程序風險評估一覽">
            <table className="worksheet-table print-risk-table min-w-[68rem]">
              <colgroup>
                <col className="col-code col-print-code" />
                <col className="col-risk-dept col-print-name" />
                {RISK_FACTOR_KEYS.map((key) => <col key={key} className="col-risk-factor col-print-factor" />)}
                <col className="col-risk-result col-print-result" />
                <col className="col-print-evidence-ref" />
                <col className="col-action no-print" />
              </colgroup>
              <thead>
                <tr>
                  <th>QP</th>
                  <th>部門</th>
                  {RISK_FACTOR_KEYS.map((key) => (
                    <th key={key} title={`${factorNames[key]}：${FACTOR_DEFINITIONS[key].definition}（${FACTOR_DEFINITIONS[key].scale}）`}>
                      {FACTOR_SHORT[key]}
                      <span className="block font-normal no-print">{FACTOR_ORIGIN[key]}</span>
                    </th>
                  ))}
                  <th>結果</th>
                  <th>證據引用</th>
                  <th className="no-print">操作</th>
                </tr>
              </thead>
              <tbody>
                {displayStates.map(({ row, saved, status, draft, dirty, savedThisYear, blockers, assessment, printed }, rowIndex) => {
                  const key = rowKey(row)
                  const derived = derivedFor(row)
                  const hiddenClass = !pagination.isVisible(rowIndex) ? 'pagination-hidden-row ' : ''
                  const revisions = saved?.revisions ?? []
                  const needsSave = !savedThisYear || dirty
                  const statusNote = dirty
                    ? { text: '有更新未存', title: undefined }
                    : status === 'draft' && blockers.length > 0
                      ? { text: `待補 ${blockers.length} 項`, title: blockers.join('、') }
                      : !assessment.level
                        ? { text: `缺 ${assessment.missingKeys.length} 項`, title: `待確認：${assessment.missingFactors.join('、')}` }
                        : null
                  return (
                    <tr key={key} className={`${hiddenClass}${!savedThisYear ? 'bg-row-warning/50' : ''}`}>
                      <td className="font-normal text-ink">{row.qpCode}</td>
                      <td className="break-words">{row.department}</td>
                      {RISK_FACTOR_KEYS.map((factor) => {
                        const value = draft.values[factor]
                        const unavailable = value == null && factor in draft.unavailable
                        const pending = value == null && !unavailable
                        const info = derived[factor]
                        const marker = cellMarker(draft, info, factor)
                        const exception = cellException(draft, info, factor)
                        const label = value == null ? (unavailable ? '未取得' : '待確認') : formatFactorLabel(factor, value)
                        const open = editor != null && rowKey(editor.row) === key && editor.factor === factor
                        const frame = open
                          ? 'border-primary'
                          : pending
                            ? 'border-dashed border-tone-warning-fg/50'
                            : 'border-transparent hover:border-line'
                        return (
                          <td key={factor} className="align-top">
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-expanded={open}
                              aria-label={`${row.qpCode} ${row.department} ${factorNames[factor]}：${value == null ? (unavailable ? '未取得' : '—') : label}（${marker.text}）`}
                              title={info.note}
                              className={`no-print flex min-h-11 w-full flex-col items-start justify-center rounded border px-1.5 py-1 text-left ${frame} ${gradeTint(value)} ${FOCUS_RING}`}
                              onClick={(event) => {
                                const anchor = event.currentTarget
                                setEditor(open ? null : { row, factor, anchor })
                              }}
                            >
                              <span className={`text-xs ${pending ? 'text-tone-warning-fg' : unavailable ? 'text-muted' : 'font-bold text-ink'}`}>{label}</span>
                              {exception && <span className="text-xs text-tone-warning-fg">{exception}</span>}
                            </button>
                            <span className="print-only text-xs">
                              {!savedThisYear || !saved
                                ? '—'
                                : saved[factor] != null
                                  ? formatFactorLabel(factor, saved[factor])
                                  : saved.unavailableFactors?.[factor] ? '未取得' : '—'}
                            </span>
                          </td>
                        )
                      })}
                      <td
                        className="align-top text-xs"
                        title={revisions.length > 0
                          ? `核准紀錄：${revisions.map((revision) => `${revision.changedAt.slice(0, 10)} ${revision.approvedBy ?? ''}（${revision.snapshot.score} ${revision.snapshot.level ?? '資料不足'}）`).join('；')}`
                          : undefined}
                      >
                        <span className="print-only">
                          {printed ? `${printed.score} ${printed.level ?? '資料不足'}` : '未存檔'}
                        </span>
                        <span className="no-print block">
                          {assessment.level ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span className="text-sm font-bold text-ink">{assessment.score}</span>
                              <Badge label={assessment.level} />
                              {assessment.provisional && <span className="text-muted">暫估</span>}
                              {assessment.floorApplied && <span className="text-muted" title={`公式等級 ${assessment.formulaLevel}`}>地板</span>}
                            </span>
                          ) : (
                            <span className="text-muted" title="資料不足，不給等級也不參與編排">暫估 {assessment.score}</span>
                          )}
                        </span>
                        <span className="mt-1 block">
                          <span>{RISK_STATUS_LABELS[status]}</span>
                          {statusNote && (
                            <span className="text-tone-warning-fg no-print" title={statusNote.title}>・{statusNote.text}</span>
                          )}
                        </span>
                      </td>
                      <td className="align-top">
                        <input
                          value={draft.evidenceReference}
                          onChange={(event) => updateDraft(row, (current) => ({ ...current, evidenceReference: event.target.value }))}
                          aria-label={`${row.qpCode} 證據引用`}
                          placeholder="—"
                          title={draft.evidenceReference || '點選輸入證據引用'}
                          className={`no-print min-h-11 w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-muted hover:border-line focus:border-primary focus:bg-surface ${FOCUS_RING}`}
                        />
                        <span className="print-only text-xs">{(savedThisYear && saved?.evidenceReference) || '—'}</span>
                      </td>
                      <td className="align-top no-print">
                        {errors[key] && <p className="mb-1 text-xs font-bold text-danger" role="alert">{errors[key]}</p>}
                        {savedFlash[key] ? (
                          <Button variant="secondary" disabled>已存檔</Button>
                        ) : needsSave ? (
                          <Button variant="secondary" onClick={() => persistRow(row)}>存檔</Button>
                        ) : (
                          <span className="text-xs text-muted">已存</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollRegion>
        )}
        <TablePagination pagination={pagination} label="方案風險" />
      </div>

      {editor && editorState && (
        <FactorCellEditor
          target={editor}
          draft={editorState.draft}
          info={derivedFor(editor.row)[editor.factor]}
          needReason={reasonRequired(editor.factor, editorState.draft, editorState.saved, derivedFor(editor.row))}
          onSetValue={(value) => setManualValue(editor.row, editor.factor, value)}
          onUseSystem={() => setManualValue(editor.row, editor.factor, derivedFor(editor.row)[editor.factor].suggested)}
          onToggleUnavailable={(checked) => updateDraft(editor.row, (current) => {
            const unavailable = { ...current.unavailable }
            if (checked) unavailable[editor.factor] = unavailable[editor.factor] ?? ''
            else delete unavailable[editor.factor]
            return { ...current, unavailable }
          })}
          onReason={(field, text) => updateDraft(editor.row, (current) => ({ ...current, [field]: { ...current[field], [editor.factor]: text } }))}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}
