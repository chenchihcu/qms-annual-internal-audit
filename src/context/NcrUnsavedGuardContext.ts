import { createContext, useContext, useEffect } from 'react'

export interface NcrUnsavedGuardHandle {
  hasUnsaved: () => boolean
}

interface NcrUnsavedGuardContextValue {
  register: (handle: NcrUnsavedGuardHandle | null) => void
  confirmIfUnsaved: () => boolean
  peekUnsaved: () => boolean
}

export const NcrUnsavedGuardContext = createContext<NcrUnsavedGuardContextValue | null>(null)

export function useNcrUnsavedGuardRegistration(hasUnsaved: () => boolean) {
  const ctx = useContext(NcrUnsavedGuardContext)
  useEffect(() => {
    if (!ctx) return
    ctx.register({ hasUnsaved })
    return () => ctx.register(null)
  }, [ctx, hasUnsaved])
}

export function useNcrUnsavedGuardActions() {
  const ctx = useContext(NcrUnsavedGuardContext)
  if (!ctx) {
    return { confirmIfUnsaved: () => true, peekUnsaved: () => false }
  }
  return { confirmIfUnsaved: ctx.confirmIfUnsaved, peekUnsaved: ctx.peekUnsaved }
}
