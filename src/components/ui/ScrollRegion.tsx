import type { ReactNode } from 'react'

interface ScrollRegionProps {
  children: ReactNode
  /** Accessible name for the scrollable table region */
  ariaLabel?: string
  className?: string
}

/**
 * Wraps wide tables with horizontal scroll and a mobile-only swipe hint.
 * Page-level overflow must not be hidden; scroll stays inside this region.
 */
export function ScrollRegion({ children, ariaLabel, className = '' }: ScrollRegionProps) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs text-muted lg:hidden" aria-hidden="true">
        此表可左右滑動查看完整欄位
      </p>
      <div className="overflow-x-auto" aria-label={ariaLabel} tabIndex={ariaLabel ? 0 : undefined}>
        {children}
      </div>
    </div>
  )
}
