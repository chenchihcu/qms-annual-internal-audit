import type { IconName } from '../../lib/uiIcons'
import { PATHS } from '../../lib/iconPaths'


export interface IconProps {
  name: IconName
  className?: string
  size?: 'sm' | 'md'
}

export function Icon({ name, className = '', size = 'md' }: IconProps) {
  const sizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const path = PATHS[name]
  if (!path) return null

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`no-print shrink-0 ${sizeClass} ${className}`}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}
