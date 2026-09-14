import { describe, expect, it } from 'vitest'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TARGET,
  canAddAttachment,
  createAttachmentFromDataUrl,
  validateAttachmentSize,
} from '../attachments'

describe('attachments', () => {
  it('rejects files over size cap', () => {
    const result = validateAttachmentSize(MAX_ATTACHMENT_BYTES + 1)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('上限')
  })

  it('allows files within cap', () => {
    expect(validateAttachmentSize(1024).ok).toBe(true)
  })

  it('enforces max attachment count', () => {
    const existing = Array.from({ length: MAX_ATTACHMENTS_PER_TARGET }, (_, i) =>
      createAttachmentFromDataUrl(`f${i}.txt`, 'text/plain', 10, 'data:text/plain;base64,'),
    )
    const gate = canAddAttachment(existing)
    expect(gate.ok).toBe(false)
  })
})
