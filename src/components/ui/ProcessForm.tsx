import type { FormEvent, ReactNode } from 'react'

interface ProcessFormProps {
  formId: string
  label: string
  children: ReactNode
}

/**
 * One workflow page is one semantic form. Controls still save immediately
 * through the existing store; preventing submit avoids an accidental browser
 * reload when a user presses Enter in a text field.
 */
export function ProcessForm({ formId, label, children }: ProcessFormProps) {
  const preventNavigation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <form id={formId} aria-label={label} data-process-form={formId} onSubmit={preventNavigation}>
      {children}
    </form>
  )
}
