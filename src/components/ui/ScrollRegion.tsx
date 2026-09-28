import type { ReactNode } from 'react'

interface ScrollRegionProps {
  children: ReactNode
  /** Accessible name for the scrollable table region */
  ariaLabel?: string
  className?: string
}

/** Wraps wide tables with horizontal scroll when the content is wider than the viewport. */
export function ScrollRegion({ children, ariaLabel, className = '' }: ScrollRegionProps) {
  return (
    <div className={`min-w-0 max-w-full ${className}`.trim()}>
      <div
        className="max-w-full overflow-x-auto"
        role={ariaLabel ? 'region' : undefined}
        aria-label={ariaLabel}
        tabIndex={ariaLabel ? 0 : undefined}
      >
        {children}
      </div>
    </div>
  )
}
