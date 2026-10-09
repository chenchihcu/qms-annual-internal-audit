import type { KeyboardEvent } from 'react'
import {
  OS_BAND_LABELS,
  OS_BAND_ORDER,
  osBandToScale,
  scaleToOsBand,
  type OsBand,
} from '../../lib/planner'

export function OsBandRadios({
  label,
  fieldId,
  value,
  guide,
  onChange,
}: {
  label: string
  fieldId: string
  value: number
  guide: Record<OsBand, string>
  onChange: (value: number) => void
}) {
  const selectedBand = scaleToOsBand(value)

  const moveBand = (band: OsBand, direction: -1 | 1) => {
    const index = OS_BAND_ORDER.indexOf(band)
    const next = OS_BAND_ORDER[index + direction]
    if (next) onChange(osBandToScale(next))
  }

  const handleBandKeyDown = (event: KeyboardEvent<HTMLButtonElement>, band: OsBand) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveBand(band, -1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveBand(band, 1)
    }
  }

  return (
    <div id={fieldId} className="space-y-1">
      <span className="text-sm font-bold text-muted">{label}</span>
      <div role="radiogroup" aria-label={`${label}（低／中／高）`} className="flex gap-1">
        {OS_BAND_ORDER.map((band) => {
          const selected = selectedBand === band
          const bandLabel = OS_BAND_LABELS[band]
          const fact = guide[band]
          return (
            <button
              key={band}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${bandLabel}：${fact}`}
              title={fact}
              tabIndex={selected ? 0 : -1}
              className={`min-h-9 flex-1 rounded border px-1 text-sm font-normal transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected
                  ? 'border-primary bg-row-selected text-tone-info-fg'
                  : 'border-line bg-white text-muted hover:bg-page'
              }`}
              onClick={() => onChange(osBandToScale(band))}
              onKeyDown={(event) => handleBandKeyDown(event, band)}
            >
              {bandLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}
