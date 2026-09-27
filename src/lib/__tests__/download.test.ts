import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from '../download'

describe('downloadBlob', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the object URL available after the click before revoking it', () => {
    vi.useFakeTimers()
    const objectUrl = 'blob:http://localhost/backup'
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl)
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true)
    })

    downloadBlob(new Blob(['{}'], { type: 'application/json' }), 'backup.json')

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download="backup.json"]')).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)

    expect(revokeObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl)
  })
})
