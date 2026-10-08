import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { NcrUnsavedGuardContext, type NcrUnsavedGuardHandle } from './NcrUnsavedGuardContext'

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

