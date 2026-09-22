import type { Observation, ProcedureAudit } from '../types'

export function findObservationByChecklistItem(
  observations: Observation[],
  checklistItemId: string,
): Observation | undefined {
  return observations.find((o) => o.carriedToChecklistId === checklistItemId)
}

export function isObservationStale(obs: Observation, audits: ProcedureAudit[]): boolean {
  if (!obs.carriedToChecklistId) return false
  for (const audit of audits) {
    const item = audit.items.find((i) => i.id === obs.carriedToChecklistId)
    if (item && item.judgment !== '觀察') return true
  }
  return false
}

export function collectObservationsFromAudits(
  audits: ProcedureAudit[],
  year: number,
  existing: Observation[] = [],
): Observation[] {
  const byItemId = new Map(
    existing
      .filter((o) => o.carriedToChecklistId)
      .map((o) => [o.carriedToChecklistId!, o]),
  )

  const result: Observation[] = [...existing]

  for (const audit of audits) {
    for (const item of audit.items) {
      if (item.judgment !== '觀察') continue

      const existingObs = byItemId.get(item.id)
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
        id: `obs-chk-${item.id}`,
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
      byItemId.set(item.id, obs)
    }
  }

  return result
}
