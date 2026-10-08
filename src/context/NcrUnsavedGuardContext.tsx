import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

export interface NcrUnsavedGuardHandle {
  hasUnsaved: () => boolean
}

interface NcrUnsavedGuardContextValue {
  register: (handle: NcrUnsavedGuardHandle | null) => void
  confirmIfUnsaved: () => boolean
  peekUnsaved: () => boolean
}

const NcrUnsavedGuardContext = createContext<NcrUnsavedGuardContextValue | null>(null)

export function NcrUnsavedGuardProvider({ children }: { children: ReactNode }) {
  const handleRef = useRef<NcrUnsavedGuardHandle | null>(null)

  const register = useCallback((handle: NcrUnsavedGuardHandle | null) => {
    handleRef.current = handle
  }, [])

  const peekUnsaved = useCallback(() => handleRef.current?.hasUnsaved() ?? false, [])

  const confirmIfUnsaved = useCallback(() => {
    if (!handleRef.current?.hasUnsaved()) return true
    return window.confirm('QR-28-03 報告有未存檔變更，確定離開？未存檔內容將捨棄。')
  }, [])

  const value = useMemo(
    () => ({ register, confirmIfUnsaved, peekUnsaved }),
    [register, confirmIfUnsaved, peekUnsaved],
  )

  return <NcrUnsavedGuardContext.Provider value={value}>{children}</NcrUnsavedGuardContext.Provider>
}

// biome-ignore lint/react/onlyExportComponents: Context hooks are standardly exported with the Provider
export function useNcrUnsavedGuardRegistration(hasUnsaved: () => boolean) {
  const ctx = useContext(NcrUnsavedGuardContext)
  useEffect(() => {
    if (!ctx) return
    ctx.register({ hasUnsaved })
    return () => ctx.register(null)
  }, [ctx, hasUnsaved])
}

// biome-ignore lint/react/onlyExportComponents: Context hooks are standardly exported with the Provider
export function useNcrUnsavedGuardActions() {
  const ctx = useContext(NcrUnsavedGuardContext)
  if (!ctx) {
    return { confirmIfUnsaved: () => true, peekUnsaved: () => false }
  }
  return { confirmIfUnsaved: ctx.confirmIfUnsaved, peekUnsaved: ctx.peekUnsaved }
}
