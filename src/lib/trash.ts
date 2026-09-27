import type {
  AppState,
  CompanyData,
  CompanyId,
  NCR,
  Observation,
  ThirdPartySuggestion,
  TrashCompanyRecordKind,
  TrashEntry,
} from '../types'
import { isSeedChecklistItem } from './checklistItem'
import { ncrNumberLabel } from './ncr'

type CompanyCollection = 'ncrs' | 'observations' | 'suggestions'
type CompanyRecord = NCR | Observation | ThirdPartySuggestion

const COLLECTION_BY_KIND: Record<TrashCompanyRecordKind, CompanyCollection> = {
  ncr: 'ncrs',
  observation: 'observations',
  suggestion: 'suggestions',
}

export const TRASH_KIND_LABELS: Record<TrashEntry['kind'], string> = {
  ncr: '不符合',
  observation: '觀察事項',
  suggestion: '第三方建議',
  person: '人員',
  onsite_slot: '外稽行程',
  checklist_item: '自訂查檢項',
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isTrashEntry(value: unknown): value is TrashEntry {
  if (!isObject(value)) return false
  if (
    typeof value.id !== 'string' || !value.id
    || typeof value.recordId !== 'string' || !value.recordId
    || typeof value.deletedAt !== 'string' || !value.deletedAt
    || typeof value.originalIndex !== 'number' || !Number.isInteger(value.originalIndex) || value.originalIndex < 0
    || !isObject(value.record) || value.record.id !== value.recordId
    || !isObject(value.location)
  ) return false

  const location = value.location
  switch (value.kind) {
    case 'ncr':
    case 'observation':
    case 'suggestion':
      return (location.companyId === 'jiurun' || location.companyId === 'zhenglongxing')
        && typeof location.year === 'number'
        && Number.isInteger(location.year)
        && (location.archiveYear === undefined || typeof location.archiveYear === 'string')
    case 'person':
      return location.scope === 'people'
    case 'onsite_slot':
      return typeof location.prepYear === 'number' && Number.isInteger(location.prepYear)
    case 'checklist_item':
      return (location.companyId === 'jiurun' || location.companyId === 'zhenglongxing')
        && typeof location.auditId === 'string'
        && typeof location.year === 'number'
        && Number.isInteger(location.year)
        && (location.archiveYear === undefined || typeof location.archiveYear === 'string')
    default:
      return false
  }
}

function companyRecords(data: CompanyData, collection: CompanyCollection): CompanyRecord[] {
  return data[collection] as CompanyRecord[]
}

function withCompanyRecords(
  state: AppState,
  companyId: CompanyId,
  archiveYear: string | undefined,
  collection: CompanyCollection,
  records: CompanyRecord[],
): AppState {
  if (!archiveYear) {
    return {
      ...state,
      companies: {
        ...state.companies,
        [companyId]: { ...state.companies[companyId], [collection]: records },
      },
    }
  }

  const archive = state.yearArchives[archiveYear]
  const company = archive?.companies[companyId]
  if (!archive || !company) return state
  return {
    ...state,
    yearArchives: {
      ...state.yearArchives,
      [archiveYear]: {
        ...archive,
        companies: {
          ...archive.companies,
          [companyId]: { ...company, [collection]: records },
        },
      },
    },
  }
}

function findCompanyRecord(
  state: AppState,
  companyId: CompanyId,
  collection: CompanyCollection,
  recordId: string,
): { record: CompanyRecord; index: number; archiveYear?: string } | null {
  const current = companyRecords(state.companies[companyId], collection)
  const currentIndex = current.findIndex((item) => item.id === recordId)
  if (currentIndex >= 0) return { record: current[currentIndex], index: currentIndex }

  for (const [archiveYear, archive] of Object.entries(state.yearArchives)) {
    const company = archive.companies[companyId]
    if (!company) continue
    const records = companyRecords(company, collection)
    const index = records.findIndex((item) => item.id === recordId)
    if (index >= 0) return { record: records[index], index, archiveYear }
  }
  return null
}

export function moveCompanyRecordToTrash(
  state: AppState,
  kind: TrashCompanyRecordKind,
  recordId: string,
  companyId: CompanyId,
  trashId: string,
  deletedAt: string,
): AppState {
  const collection = COLLECTION_BY_KIND[kind]
  const found = findCompanyRecord(state, companyId, collection, recordId)
  if (!found) return state
  if ((state.trash ?? []).some((entry) => entry.kind === kind && entry.recordId === recordId
    && 'companyId' in entry.location && entry.location.companyId === companyId
    && ('archiveYear' in entry.location ? entry.location.archiveYear : undefined) === found.archiveYear)) return state

  const locationYear = found.archiveYear
    ? Number(found.archiveYear)
    : state.companySettings[companyId].auditYear
  const source = found.archiveYear
    ? state.yearArchives[found.archiveYear]?.companies[companyId]
    : state.companies[companyId]
  if (!source) return state
  const records = companyRecords(source, collection).filter((item) => item.id !== recordId)
  const next = withCompanyRecords(state, companyId, found.archiveYear, collection, records)
  const location = {
    companyId,
    year: Number.isInteger(locationYear) ? locationYear : state.companySettings[companyId].auditYear,
    ...(found.archiveYear ? { archiveYear: found.archiveYear } : {}),
  }
  const common = {
    id: trashId,
    recordId,
    deletedAt,
    originalIndex: found.index,
    location,
  }
  const entry: TrashEntry = kind === 'ncr'
    ? { ...common, kind, record: found.record as NCR }
    : kind === 'observation'
      ? { ...common, kind, record: found.record as Observation }
      : { ...common, kind, record: found.record as ThirdPartySuggestion }

  return { ...next, trash: [...(state.trash ?? []), entry] }
}

export function movePersonToTrash(
  state: AppState,
  recordId: string,
  trashId: string,
  deletedAt: string,
): AppState {
  const originalIndex = state.people.findIndex((person) => person.id === recordId)
  if (originalIndex < 0 || (state.trash ?? []).some((entry) => entry.kind === 'person' && entry.recordId === recordId)) return state
  const record = state.people[originalIndex]
  const entry: TrashEntry = {
    id: trashId,
    recordId,
    kind: 'person',
    record,
    deletedAt,
    originalIndex,
    location: { scope: 'people' },
  }
  return {
    ...state,
    people: state.people.filter((person) => person.id !== recordId),
    trash: [...(state.trash ?? []), entry],
  }
}

export function moveOnsiteSlotToTrash(
  state: AppState,
  recordId: string,
  trashId: string,
  deletedAt: string,
): AppState {
  const currentSlots = state.externalAuditPrep.onsiteSlots ?? []
  const currentIndex = currentSlots.findIndex((slot) => slot.id === recordId)
  if (currentIndex >= 0) {
    return removeOnsiteSlotFromPrep(state, state.externalAuditPrep.year, currentIndex, trashId, deletedAt)
  }
  for (const [year, prep] of Object.entries(state.prepArchives ?? {})) {
    const slots = prep.onsiteSlots ?? []
    const index = slots.findIndex((slot) => slot.id === recordId)
    if (index >= 0) return removeOnsiteSlotFromPrep(state, Number(year), index, trashId, deletedAt)
  }
  return state
}

function removeOnsiteSlotFromPrep(
  state: AppState,
  year: number,
  originalIndex: number,
  trashId: string,
  deletedAt: string,
): AppState {
  const trash = state.trash ?? []
  const source = state.externalAuditPrep.year === year
    ? state.externalAuditPrep
    : state.prepArchives?.[String(year)]
  if (!source) return state
  const slots = source?.onsiteSlots ?? []
  const record = slots[originalIndex]
  if (!record || trash.some((entry) => entry.kind === 'onsite_slot' && entry.recordId === record.id
    && entry.location.prepYear === year)) return state
  const nextSlots = slots.filter((slot) => slot.id !== record.id)
  const next: AppState = state.externalAuditPrep.year === year
    ? { ...state, externalAuditPrep: { ...state.externalAuditPrep, onsiteSlots: nextSlots } }
    : {
        ...state,
        prepArchives: {
          ...state.prepArchives,
          [String(year)]: { ...source, onsiteSlots: nextSlots },
        },
      }
  const entry: TrashEntry = {
    id: trashId,
    recordId: record.id,
    kind: 'onsite_slot',
    record,
    deletedAt,
    originalIndex,
    location: { prepYear: year },
  }
  return { ...next, trash: [...trash, entry] }
}

export function moveChecklistItemToTrash(
  state: AppState,
  auditId: string,
  recordId: string,
  trashId: string,
  deletedAt: string,
): AppState {
  const companyId = state.activeCompanyId
  const company = state.companies[companyId]
  const audit = company.audits.find((item) => item.id === auditId)
  if (!audit || audit.status === '已回報') return state
  const originalIndex = audit.items.findIndex((item) => item.id === recordId)
  if (originalIndex < 0 || isSeedChecklistItem(audit.items[originalIndex])
    || (state.trash ?? []).some((entry) => entry.kind === 'checklist_item' && entry.recordId === recordId
      && entry.location.companyId === companyId && entry.location.auditId === auditId)) return state

  const record = audit.items[originalIndex]
  const items = audit.items.filter((item) => item.id !== recordId).map((item, index) => ({ ...item, no: index + 1 }))
  const entry: TrashEntry = {
    id: trashId,
    recordId,
    kind: 'checklist_item',
    record,
    deletedAt,
    originalIndex,
    location: { companyId, auditId, year: audit.year ?? state.companySettings[companyId].auditYear },
  }
  return {
    ...state,
    companies: {
      ...state.companies,
      [companyId]: {
        ...company,
        audits: company.audits.map((item) => item.id === auditId ? { ...item, items } : item),
      },
    },
    trash: [...(state.trash ?? []), entry],
  }
}

function insertAt<T>(records: T[], index: number, record: T): T[] {
  const next = [...records]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, record)
  return next
}

function targetCompanyArchiveYear(state: AppState, companyId: CompanyId, year: number, archiveYear?: string): string | undefined | null {
  if (archiveYear && state.yearArchives[archiveYear]?.companies[companyId]) return archiveYear
  if (state.companySettings[companyId].auditYear === year) return undefined
  const key = String(year)
  return state.yearArchives[key]?.companies[companyId] ? key : null
}

function restoreCompanyRecord(
  state: AppState,
  entry: Extract<TrashEntry, { kind: TrashCompanyRecordKind }>,
): AppState | null {
  const collection = COLLECTION_BY_KIND[entry.kind]
  const archiveYear = targetCompanyArchiveYear(state, entry.location.companyId, entry.location.year, entry.location.archiveYear)
  if (archiveYear === null) return null
  const data = archiveYear
    ? state.yearArchives[archiveYear].companies[entry.location.companyId]
    : state.companies[entry.location.companyId]
  if (!data) return null
  const records = companyRecords(data, collection)
  if (records.some((record) => record.id === entry.recordId)) return null
  return withCompanyRecords(
    state,
    entry.location.companyId,
    archiveYear,
    collection,
    insertAt(records, entry.originalIndex, entry.record),
  )
}

function restorePerson(state: AppState, entry: Extract<TrashEntry, { kind: 'person' }>): AppState | null {
  if (state.people.some((person) => person.id === entry.recordId)) return null
  return { ...state, people: insertAt(state.people, entry.originalIndex, entry.record) }
}

function restoreOnsiteSlot(state: AppState, entry: Extract<TrashEntry, { kind: 'onsite_slot' }>): AppState | null {
  const year = entry.location.prepYear
  if (state.externalAuditPrep.year === year) {
    const slots = state.externalAuditPrep.onsiteSlots ?? []
    if (slots.some((slot) => slot.id === entry.recordId)) return null
    return { ...state, externalAuditPrep: { ...state.externalAuditPrep, onsiteSlots: insertAt(slots, entry.originalIndex, entry.record) } }
  }
  const archive = state.prepArchives?.[String(year)]
  if (!archive || (archive.onsiteSlots ?? []).some((slot) => slot.id === entry.recordId)) return null
  return {
    ...state,
    prepArchives: {
      ...state.prepArchives,
      [String(year)]: { ...archive, onsiteSlots: insertAt(archive.onsiteSlots ?? [], entry.originalIndex, entry.record) },
    },
  }
}

function restoreChecklistItem(state: AppState, entry: Extract<TrashEntry, { kind: 'checklist_item' }>): AppState | null {
  const { companyId, auditId, year } = entry.location
  const archiveYear = targetCompanyArchiveYear(state, companyId, year, entry.location.archiveYear)
  if (archiveYear === null) return null
  const company = archiveYear
    ? state.yearArchives[archiveYear].companies[companyId]
    : state.companies[companyId]
  if (!company) return null
  const audit = company.audits.find((item) => item.id === auditId)
  if (!audit || audit.status === '已回報' || audit.items.some((item) => item.id === entry.recordId)) return null
  const items = insertAt(audit.items, entry.originalIndex, entry.record).map((item, index) => ({ ...item, no: index + 1 }))
  const audits = company.audits.map((item) => item.id === auditId ? { ...item, items } : item)
  if (!archiveYear) {
    return {
      ...state,
      companies: { ...state.companies, [companyId]: { ...company, audits } },
    }
  }
  const archive = state.yearArchives[archiveYear]
  return {
    ...state,
    yearArchives: {
      ...state.yearArchives,
      [archiveYear]: {
        ...archive,
        companies: { ...archive.companies, [companyId]: { ...company, audits } },
      },
    },
  }
}

export interface RestoreTrashResult {
  ok: boolean
  state: AppState
  reason?: 'missing' | 'conflict' | 'source_missing'
}

export function restoreTrashRecord(state: AppState, trashId: string): RestoreTrashResult {
  const trash = state.trash ?? []
  const trashIndex = trash.findIndex((entry) => entry.id === trashId)
  if (trashIndex < 0) return { ok: false, state, reason: 'missing' }
  const entry = trash[trashIndex]
  const restored = entry.kind === 'ncr' || entry.kind === 'observation' || entry.kind === 'suggestion'
    ? restoreCompanyRecord(state, entry)
    : entry.kind === 'person'
      ? restorePerson(state, entry)
      : entry.kind === 'onsite_slot'
        ? restoreOnsiteSlot(state, entry)
        : restoreChecklistItem(state, entry)
  if (!restored) {
    const reason = entry.kind === 'checklist_item' && entry.location.archiveYear === undefined
      && state.companySettings[entry.location.companyId].auditYear !== entry.location.year
      && !state.yearArchives[String(entry.location.year)]?.companies[entry.location.companyId]
      ? 'source_missing'
      : entry.kind !== 'person' && entry.kind !== 'onsite_slot'
        && 'companyId' in entry.location
        && targetCompanyArchiveYear(state, entry.location.companyId, entry.location.year, entry.location.archiveYear) === null
        ? 'source_missing'
        : 'conflict'
    return { ok: false, state, reason }
  }
  const restoredState: AppState = {
    ...restored,
    trash: trash.filter((item) => item.id !== trashId),
  }
  if (entry.kind === 'ncr' || entry.kind === 'observation') {
    restoredState.permanentlyDeletedGeneratedRecords = (state.permanentlyDeletedGeneratedRecords ?? []).filter((item) => !(
      item.kind === entry.kind
      && item.recordId === entry.recordId
      && item.companyId === entry.location.companyId
      && item.year === (entry.kind === 'ncr' ? entry.record.sourceYear ?? entry.location.year : entry.record.year)
    ))
  }
  return {
    ok: true,
    state: restoredState,
  }
}

export function permanentlyDeleteTrashRecord(state: AppState, trashId: string): AppState {
  const trash = state.trash ?? []
  const entry = trash.find((item) => item.id === trashId)
  if (!entry) return state
  const generatedRecord = entry.kind === 'ncr' && (entry.record.checklistItemId || entry.record.sourceAuditId)
    ? { kind: 'ncr' as const, recordId: entry.recordId, companyId: entry.location.companyId, year: entry.record.sourceYear ?? entry.location.year }
    : entry.kind === 'observation' && entry.record.sourceChecklistItemId
      ? { kind: 'observation' as const, recordId: entry.recordId, companyId: entry.location.companyId, year: entry.record.year }
      : null
  const permanentlyDeletedGeneratedRecords = generatedRecord
    ? [
        ...(state.permanentlyDeletedGeneratedRecords ?? []).filter((item) => !(
          item.kind === generatedRecord.kind
          && item.recordId === generatedRecord.recordId
          && item.companyId === generatedRecord.companyId
          && item.year === generatedRecord.year
        )),
        generatedRecord,
      ]
    : state.permanentlyDeletedGeneratedRecords
  return {
    ...state,
    trash: trash.filter((item) => item.id !== trashId),
    ...(permanentlyDeletedGeneratedRecords ? { permanentlyDeletedGeneratedRecords } : {}),
  }
}

export function isRecordInTrash(
  trash: TrashEntry[] | undefined,
  kind: TrashCompanyRecordKind,
  companyId: CompanyId,
  recordId: string,
  year?: number,
): boolean {
  return (trash ?? []).some((entry) => entry.kind === kind && entry.recordId === recordId
    && 'companyId' in entry.location && entry.location.companyId === companyId
    && (year === undefined || entry.location.year === year))
}

export function isGeneratedRecordPermanentlyDeleted(
  state: Pick<AppState, 'permanentlyDeletedGeneratedRecords'>,
  kind: 'ncr' | 'observation',
  companyId: CompanyId,
  recordId: string,
  year: number,
): boolean {
  return (state.permanentlyDeletedGeneratedRecords ?? []).some((entry) => (
    entry.kind === kind && entry.companyId === companyId && entry.recordId === recordId && entry.year === year
  ))
}

export function trashEntrySummary(entry: TrashEntry): string {
  switch (entry.kind) {
    case 'ncr':
      return `${ncrNumberLabel(entry.record.ncrNumber)} · ${entry.record.department} · ${entry.record.description}`
    case 'observation':
      return `${entry.record.year} · ${entry.record.department} · ${entry.record.content}`
    case 'suggestion':
      return `${entry.record.year} · ${entry.record.procedure} · ${entry.record.issue}`
    case 'person':
      return `${entry.record.name}${entry.record.employeeNumber ? ` · ${entry.record.employeeNumber}` : ''}`
    case 'onsite_slot':
      return `${entry.record.date} ${entry.record.startTime}${entry.record.endTime ? `–${entry.record.endTime}` : ''} · ${entry.record.note}`
    case 'checklist_item':
      return `${entry.record.category} ${entry.record.no} · ${entry.record.content}`
  }
}
