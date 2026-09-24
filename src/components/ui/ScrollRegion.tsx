import { useEffect, useRef, useState, type ReactNode } from 'react'

interface ScrollRegionProps {
  children: ReactNode
  /** Accessible name for the scrollable table region */
  ariaLabel?: string
  className?: string
}

/**
 * Wraps wide tables with horizontal scroll. Shows a swipe hint only when
 * content actually overflows at the current viewport width.
 */
export function ScrollRegion({ children, ariaLabel, className = '' }: ScrollRegionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const checkOverflow = () => {
      setShowHint(el.scrollWidth > el.clientWidth)
    }

    checkOverflow()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', checkOverflow)
      return () => window.removeEventListener('resize', checkOverflow)
    }

    const observer = new ResizeObserver(checkOverflow)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children])

  return (
    <div className={className}>
      {showHint && (
        <p className="mb-2 text-xs text-muted no-print" aria-hidden="true">
          此表可左右滑動查看完整欄位
        </p>
      )}
      <div
        ref={scrollRef}
        className="overflow-x-auto"
        role={ariaLabel ? 'region' : undefined}
        aria-label={ariaLabel}
        tabIndex={ariaLabel ? 0 : undefined}
      >
        {children}
      </div>
    </div>
  )
}
