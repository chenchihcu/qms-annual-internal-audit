import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MigrationGate } from '../MigrationGate'

function MigrationGateHarness({ onContinue }: { onContinue: () => boolean }) {
  const [downloadRequested, setDownloadRequested] = useState(false)
  const [backupConfirmed, setBackupConfirmed] = useState(false)

  return (
    <MigrationGate
      downloadRequested={downloadRequested}
      backupConfirmed={backupConfirmed}
      warning={null}
      onDownload={() => {
        setDownloadRequested(true)
        setBackupConfirmed(false)
        return true
      }}
      onVerifyBackup={async (file) => {
        const verified = file.name === 'current.json'
        setBackupConfirmed(verified)
        return verified
      }}
      onContinue={onContinue}
    />
  )
}

describe('MigrationGate', () => {
  it('requires selecting the matching downloaded backup before applying the new format', async () => {
    const onContinue = vi.fn(() => true)
    render(<MigrationGateHarness onContinue={onContinue} />)

    const apply = screen.getByRole('button', { name: '驗證並套用升級' })
    expect((apply as HTMLButtonElement).disabled).toBe(true)

    const fileInput = screen.getByLabelText('選取遷移前原始備份 JSON') as HTMLInputElement
    expect(fileInput.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '下載原始備份' }))
    expect(fileInput.disabled).toBe(false)
    expect((apply as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('已啟動備份下載')
    expect(screen.getByRole('status').textContent).not.toContain('下載完成')

    fireEvent.change(fileInput, { target: { files: [new File(['stale'], 'stale.json', { type: 'application/json' })] } })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('不一致'))
    expect((apply as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(fileInput, { target: { files: [new File(['current'], 'current.json', { type: 'application/json' })] } })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('驗證通過'))
    expect((apply as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(apply)
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
