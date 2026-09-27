import { useEffect, useRef } from 'react'

/** Focus an inline editor on open and return to its trigger on close. */
export function useInlineFormFocus(open: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) {
      formRef.current?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')?.focus()
    } else if (wasOpen.current) {
      triggerRef.current?.focus()
    }
    wasOpen.current = open
  }, [open])

  return { triggerRef, formRef }
}
