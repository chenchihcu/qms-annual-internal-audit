import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FormalRecordLocationDialog } from '../FormalRecordLocationDialog'

describe('FormalRecordLocationDialog', () => {
  it('resets its draft when opened again or when the current location changes while open', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { rerender } = render(
      <FormalRecordLocationDialog
        open
        currentLocation="既有保存位置"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    const locationInput = screen.getByLabelText('正式紀錄保存位置') as HTMLInputElement
    expect(locationInput.value).toBe('既有保存位置')

    fireEvent.change(locationInput, { target: { value: '尚未儲存的修改' } })
    rerender(
      <FormalRecordLocationDialog
        open
        currentLocation="更新後的保存位置"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByLabelText('正式紀錄保存位置')).toHaveProperty('value', '更新後的保存位置')

    rerender(
      <FormalRecordLocationDialog
        open={false}
        currentLocation="關閉期間的位置"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    rerender(
      <FormalRecordLocationDialog
        open
        currentLocation="重新開啟的位置"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByLabelText('正式紀錄保存位置')).toHaveProperty('value', '重新開啟的位置')
  })
})
