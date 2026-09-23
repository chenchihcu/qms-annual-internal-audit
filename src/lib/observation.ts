import { ncrCompanyScopeForDualSide } from './certificateScope'
import { generateNCRNumber } from './ncr'
import { countObservationJudgments } from './scoring'
import type { CompanyData, CompanyId, NCR, Observation, ProcedureAudit } from '../types'
import { COMPANY_LABELS } from '../types'

export interface AuditObservationEntry {
  id: string
  auditId: string
  qpCode: string
  departmentId: string
  label: string
  content: string
  description: string
  sourceYear?: number
  sideLabel?: string
}

function observationKey(checklistItemId: string, side?: CompanyId): string {
  return side ? `${checklistItemId}|${side}` : checklistItemId
}

function observationIdForItem(itemId: string, side?: CompanyId): string {
  return side ? `obs-chk-${itemId}-${side}` : `obs-chk-${itemId}`
}

export function listAuditObservationEntries(audits: ProcedureAudit[]): AuditObservationEntry[] {
  const entries: AuditObservationEntry[] = []
  for (const audit of audits) {
    for (const item of audit.items) {
      if (countObservationJudgments(item) === 0) continue
      const scope = item.certificateScope ?? 'shared'
      if (scope === 'dual' && item.judgmentByCompany) {
        for (const side of ['jiurun', 'zhenglongxing'] as CompanyId[]) {
          if (item.judgmentByCompany[side] !== '觀察') continue
          entries.push({
            id: `${item.id}-${side}`,
            auditId: audit.id,
            qpCode: audit.qpCode,
            departmentId: audit.departmentId,
            label: `${audit.qpCode} · ${audit.department}`,
            content: item.content,
            description: item.description,
            sourceYear: item.sourceYear,
            sideLabel: COMPANY_LABELS[side],
          })
        }
      } else if (item.judgment === '觀察') {
        entries.push({
          id: item.id,
          auditId: audit.id,
          qpCode: audit.qpCode,
          departmentId: audit.departmentId,
          label: `${audit.qpCode} · ${audit.department}`,
          content: item.content,
          description: item.description,
          sourceYear: item.sourceYear,
        })
      }
    }
  }
  return entries
}

export function ncrIdFromObservation(observationId: string): string {
  return `ncr-from-obs-${observationId}`
}

export function promoteObservationToNcr(
  company: CompanyData,
  observationId: string,
  auditYear: number,
): { ncrs: NCR[]; observations: Observation[]; ncrId: string } | null {
  const obs = company.observations.find((o) => o.id === observationId)
  if (!obs) return null

  const ncrId = ncrIdFromObservation(observationId)
  const existing = company.ncrs.find((n) => n.id === ncrId)
  let ncrs = company.ncrs

  if (!existing) {
    const description = obs.description
      ? `${obs.content}\n${obs.description}`
      : obs.content
    const companyScope = obs.companySide
      ? ncrCompanyScopeForDualSide(obs.companySide)
      : 'both'
    const ncr: NCR = {
      id: ncrId,
      ncrNumber: generateNCRNumber(auditYear, company.ncrs.length + 1),
      qpCode: obs.qpCode,
      departmentId: obs.departmentId,
      department: obs.department,
      process: obs.process,
      description,
      date: new Date().toISOString().slice(0, 10),
      status: '開立',
      companyScope,
      sourceYear: obs.year,
    }
    ncrs = [...company.ncrs, ncr]
  }

  const observations = company.observations.map((o) =>
    o.id === observationId ? { ...o, status: 'became_ncr' as const } : o,
  )

  return { ncrs, observations, ncrId }
}

export function findObservationByChecklistItem(
  observations: Observation[],
  checklistItemId: string,
  companySide?: CompanyId,
): Observation | undefined {
  return observations.find(
    (o) =>
      o.carriedToChecklistId === checklistItemId &&
      (companySide ? o.companySide === companySide : !o.companySide),
  )
}

export function isObservationStale(obs: Observation, audits: ProcedureAudit[]): boolean {
  if (!obs.carriedToChecklistId) return false
  for (const audit of audits) {
    const item = audit.items.find((i) => i.id === obs.carriedToChecklistId)
    if (!item) continue
    if (obs.companySide) {
      const byCo = item.judgmentByCompany
      if (byCo && byCo[obs.companySide] !== '觀察') return true
      continue
    }
    if (item.judgment !== '觀察') return true
  }
  return false
}

export function collectObservationsFromAudits(
  audits: ProcedureAudit[],
  year: number,
  existing: Observation[] = [],
): Observation[] {
  const byKey = new Map(
    existing
      .filter((o) => o.carriedToChecklistId)
      .map((o) => [observationKey(o.carriedToChecklistId!, o.companySide), o]),
  )

  const result: Observation[] = [...existing]

  for (const audit of audits) {
    for (const item of audit.items) {
      const scope = item.certificateScope ?? 'shared'

      if (scope === 'dual' && item.judgmentByCompany) {
        for (const side of ['jiurun', 'zhenglongxing'] as CompanyId[]) {
          if (item.judgmentByCompany[side] !== '觀察') continue
          const key = observationKey(item.id, side)
          const existingObs = byKey.get(key)
          if (existingObs) {
            if (existingObs.status === 'closed') continue
            const idx = result.findIndex((o) => o.id === existingObs.id)
            if (idx >= 0) {
              result[idx] = {
                ...existingObs,
                content: item.content,
                description: item.description || existingObs.description,
                year,
                qpCode: audit.qpCode,
                departmentId: audit.departmentId,
                department: audit.department,
                process: audit.process,
                status: 'open',
                companySide: side,
              }
            }
            continue
          }

          const obs: Observation = {
            id: observationIdForItem(item.id, side),
            year,
            qpCode: audit.qpCode,
            departmentId: audit.departmentId,
            department: audit.department,
            process: audit.process,
            content: item.content,
            description: item.description || '',
            status: 'open',
            carriedToChecklistId: item.id,
            companySide: side,
          }
          result.push(obs)
          byKey.set(key, obs)
        }
        continue
      }

      if (item.judgment !== '觀察') continue

      const key = observationKey(item.id)
      const existingObs = byKey.get(key)
      if (existingObs) {
        if (existingObs.status === 'closed') continue
        const idx = result.findIndex((o) => o.id === existingObs.id)
        if (idx >= 0) {
          result[idx] = {
            ...existingObs,
            content: item.content,
            description: item.description || existingObs.description,
            year,
            qpCode: audit.qpCode,
            departmentId: audit.departmentId,
            department: audit.department,
            process: audit.process,
            status: 'open',
          }
        }
        continue
      }

      const obs: Observation = {
        id: observationIdForItem(item.id),
        year,
        qpCode: audit.qpCode,
        departmentId: audit.departmentId,
        department: audit.department,
        process: audit.process,
        content: item.content,
        description: item.description || '',
        status: 'open',
        carriedToChecklistId: item.id,
      }
      result.push(obs)
      byKey.set(key, obs)
    }
  }

  return result
}
