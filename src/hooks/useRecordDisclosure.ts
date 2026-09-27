import { useState } from 'react'

/** Presentation state only; a new year or record link starts a new disclosure. */
export function useRecordDisclosure(scope: string, requestedId?: string) {
  const [selection, setSelection] = useState({ scope, requestedId, id: requestedId ?? null as string | null })
  const changed = selection.scope !== scope || selection.requestedId !== requestedId
  if (changed) setSelection({ scope, requestedId, id: requestedId ?? null })
  const expandedId = changed ? requestedId ?? null : selection.id
  const setExpandedId = (id: string | null) => setSelection({ scope, requestedId, id })
  return [expandedId, setExpandedId] as const
}
